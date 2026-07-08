-- ============================================================================
-- Migration: one submission per worksheet + results for admin and student
-- Run in the Supabase SQL editor AFTER the previous migrations.
--
-- 1. submit_test now rejects a second attempt at the same worksheet
--    (ALREADY_SUBMITTED) for regular students. Admins are exempt so you can
--    test freely.
-- 2. get_my_submissions()    — students fetch their own results, so the site
--    can mark completed worksheets and show their scores.
-- 3. admin_list_submissions() — admins fetch every submission for the
--    results page.
-- ============================================================================

-- 1. One submission per worksheet (enforced server-side) ------------------------
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
    if exists (
      select 1 from public.submissions s
      where s.user_id = auth.uid() and s.subject = p_subject
    ) then
      raise exception 'ALREADY_SUBMITTED';
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

-- 2. Students read their own results --------------------------------------------
create or replace function public.get_my_submissions()
returns table (subject text, score int, total int, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.subject, s.score, s.total, s.created_at
  from public.submissions s
  where s.user_id = auth.uid()
  order by s.created_at desc;
$$;
grant execute on function public.get_my_submissions() to authenticated;

-- 3. Admins read every submission -------------------------------------------------
create or replace function public.admin_list_submissions()
returns table (id bigint, user_id uuid, name text, email text, subject text,
               score int, total int, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
    select s.id, s.user_id, s.name, s.email, s.subject, s.score, s.total, s.created_at
    from public.submissions s
    order by s.created_at desc;
end;
$$;
grant execute on function public.admin_list_submissions() to authenticated;
