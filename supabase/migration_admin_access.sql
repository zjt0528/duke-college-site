-- ============================================================================
-- Migration: admin-controlled test access
-- Run in the Supabase SQL editor AFTER setup.sql and migration_link_users.sql.
--
-- What it adds:
--   * admins        — which accounts are admins (enforced in the database).
--   * test_access   — per-user approval + which worksheets they may take.
--                     New sign-ups are auto-registered as PENDING (approved =
--                     false); an admin must approve them before they can test.
--   * get_questions / submit_test now check the caller's access.
--   * admin_* RPCs power the in-site admin panel.
--
-- FINAL STEP (manual): make yourself admin. First sign up on the site with
-- your email, then run the INSERT at the bottom of this file with that email.
-- ============================================================================

-- 1. Tables -------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create table if not exists public.test_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  approved   boolean not null default false,
  subjects   text[],                    -- null = all worksheets; {} = none
  updated_at timestamptz default now()
);
alter table public.test_access enable row level security;
revoke all on public.test_access from anon, authenticated;

-- 2. Auto-register new sign-ups as pending -------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.test_access (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts that signed up before this migration
insert into public.test_access (user_id, email, name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (user_id) do nothing;

-- 3. Admin check helper ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- 4. Access-aware question serving ----------------------------------------------
-- Admins see everything. Others must be approved, and only get their allowed
-- worksheets (subjects = null means all).
create or replace function public.get_questions(p_subject text default null)
returns table (id bigint, subject text, grade text, prompt text, choices jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approved boolean;
  v_subjects text[];
begin
  if public.is_admin() then
    return query
      select q.id, q.subject, q.grade, q.prompt, q.choices
      from public.questions q
      where p_subject is null or q.subject = p_subject
      order by q.subject, q.sort_order, q.id;
    return;
  end if;

  select a.approved, a.subjects into v_approved, v_subjects
  from public.test_access a where a.user_id = auth.uid();

  if v_approved is not true then
    raise exception 'PENDING_APPROVAL';
  end if;

  return query
    select q.id, q.subject, q.grade, q.prompt, q.choices
    from public.questions q
    where (p_subject is null or q.subject = p_subject)
      and (v_subjects is null or q.subject = any(v_subjects))
    order by q.subject, q.sort_order, q.id;
end;
$$;

-- 5. Access-aware grading ---------------------------------------------------------
create or replace function public.submit_test(
  p_name text, p_email text, p_subject text, p_answers jsonb
)
returns table (score int, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score int := 0;
  v_total int := 0;
  r record;
  v_pick int;
  v_approved boolean;
  v_subjects text[];
begin
  if not public.is_admin() then
    select a.approved, a.subjects into v_approved, v_subjects
    from public.test_access a where a.user_id = auth.uid();
    if v_approved is not true then
      raise exception 'PENDING_APPROVAL';
    end if;
    if v_subjects is not null and (p_subject is null or not (p_subject = any(v_subjects))) then
      raise exception 'SUBJECT_NOT_ALLOWED';
    end if;
  end if;

  for r in
    select id, correct_index
    from public.questions
    where p_subject is null or subject = p_subject
  loop
    v_total := v_total + 1;
    v_pick  := nullif(p_answers ->> r.id::text, '')::int;
    if v_pick is not null and v_pick = r.correct_index then
      v_score := v_score + 1;
    end if;
  end loop;

  insert into public.submissions(name, email, subject, answers, score, total, user_id)
  values (p_name, p_email, p_subject, p_answers, v_score, v_total, auth.uid());

  return query select v_score, v_total;
end;
$$;

-- 6. Admin RPCs (each verifies the caller is an admin) -----------------------------
create or replace function public.admin_list_users()
returns table (user_id uuid, email text, name text, approved boolean, subjects text[], created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
    select a.user_id, a.email, a.name, a.approved, a.subjects, u.created_at
    from public.test_access a
    join auth.users u on u.id = a.user_id
    order by u.created_at desc;
end;
$$;

create or replace function public.admin_set_access(p_user uuid, p_approved boolean, p_subjects text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  update public.test_access
  set approved = p_approved, subjects = p_subjects, updated_at = now()
  where user_id = p_user;
end;
$$;

create or replace function public.admin_list_subjects()
returns table (subject text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query select distinct q.subject from public.questions q order by 1;
end;
$$;

grant execute on function public.admin_list_users()                       to authenticated;
grant execute on function public.admin_set_access(uuid, boolean, text[])  to authenticated;
grant execute on function public.admin_list_subjects()                    to authenticated;

-- 7. MAKE YOURSELF ADMIN (manual step) ---------------------------------------------
-- First sign up on the website with your email, confirm it, then run this with
-- your address (uncomment the line and edit the email):
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'dukecollege8@gmail.com'
-- on conflict do nothing;
