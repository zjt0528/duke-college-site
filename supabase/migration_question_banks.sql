-- Duke College: additive question banks, validated draft imports, result snapshots.
-- Run AFTER setup.sql, migration_link_users.sql, migration_admin_access.sql,
-- migration_one_submission_results.sql, and migration_submission_detail.sql.
-- Run as the database owner in Supabase SQL Editor. Existing question IDs,
-- subjects, permissions, submissions, and student-facing RPC shapes are retained.
-- Safe to run again. This script never deletes existing questions or results.
-- Includes the legacy bank name "book reading vocabulary"; no separate rename
-- script is needed when running this file.

begin;

do $$
begin
  if to_regprocedure('public.admin_get_submission(bigint)') is null
     or to_regprocedure('public.get_my_submissions()') is null
     or to_regprocedure('public.admin_set_access(uuid,boolean,text[])') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'submissions'
         and column_name = 'user_id'
     ) then
    raise exception 'Run all five prerequisite schema/migration files first.';
  end if;
end;
$$;

create table if not exists public.test_question_banks (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name_zh text not null default '' check (char_length(name_zh) <= 160),
  name_en text not null default '' check (char_length(name_en) <= 160),
  description_zh text not null default '' check (char_length(description_zh) <= 4000),
  description_en text not null default '' check (char_length(description_en) <= 4000),
  published boolean not null default false,
  check (btrim(name_zh) <> '' or btrim(name_en) <> '')
);

create table if not exists public.test_worksheets (
  subject text primary key,
  bank_id bigint not null references public.test_question_banks(id),
  title_zh text not null default '' check (char_length(title_zh) <= 160),
  title_en text not null default '' check (char_length(title_en) <= 160),
  grade text check (char_length(grade) <= 32),
  sort_order int not null default 0,
  check (btrim(title_zh) <> '' or btrim(title_en) <> '')
);

alter table public.test_question_banks enable row level security;
alter table public.test_worksheets enable row level security;
revoke all on public.test_question_banks, public.test_worksheets
  from public, anon, authenticated;
revoke all on sequence public.test_question_banks_id_seq
  from public, anon, authenticated;

-- Exact historical subjects are kept as identifiers; only display names are new.
insert into public.test_question_banks(code, name_zh, name_en, published)
values ('legacy', 'book reading vocabulary', 'book reading vocabulary', true)
on conflict (code) do nothing;

-- Also rename an older installation's default label, without replacing names
-- subsequently customized through the admin panel.
update public.test_question_banks
set name_zh = 'book reading vocabulary',
    name_en = 'book reading vocabulary'
where code = 'legacy'
  and name_zh = '原有题库'
  and name_en = 'Existing question bank';

insert into public.test_worksheets(subject, bank_id, title_zh, title_en, grade, sort_order)
select q.subject, b.id, left(q.subject, 160), left(q.subject, 160),
       left(min(q.grade), 32), row_number() over (order by q.subject)::int
from public.questions q
cross join public.test_question_banks b
where b.code = 'legacy'
group by q.subject, b.id
on conflict (subject) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_worksheet_subject_fkey'
  ) then
    alter table public.questions add constraint questions_worksheet_subject_fkey
      foreign key (subject) references public.test_worksheets(subject);
  end if;
end;
$$;

create index if not exists questions_subject_order_idx
  on public.questions(subject, sort_order, id);
create index if not exists test_worksheets_bank_order_idx
  on public.test_worksheets(bank_id, sort_order, subject);
create index if not exists submissions_user_subject_idx
  on public.submissions(user_id, subject);
create index if not exists submissions_created_at_idx
  on public.submissions(created_at desc);

alter table public.submissions add column if not exists question_snapshot jsonb;
comment on column public.submissions.question_snapshot is
  'Immutable-at-submission array: id,prompt,choices,correct_index,picked_index,sort_order. NULL means historical result without a snapshot.';

-- Shared validation is also used by publish/submit to reject invalid legacy rows.
-- NOT VALID protects new writes without failing migration on historical bad data.
create or replace function public._test_question_is_valid(
  p_prompt text, p_choices jsonb, p_correct_index int
)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  v_choice jsonb;
begin
  if p_prompt is null or pg_catalog.btrim(p_prompt) = ''
     or pg_catalog.char_length(p_prompt) > 20000
     or p_choices is null or pg_catalog.jsonb_typeof(p_choices) <> 'array'
     or p_correct_index is null then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_choices) not between 2 and 10
     or p_correct_index < 0
     or p_correct_index >= pg_catalog.jsonb_array_length(p_choices) then
    return false;
  end if;
  for v_choice in select value from pg_catalog.jsonb_array_elements(p_choices)
  loop
    if pg_catalog.jsonb_typeof(v_choice) <> 'string'
       or pg_catalog.btrim(v_choice #>> '{}') = ''
       or pg_catalog.char_length(v_choice #>> '{}') > 2000 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_valid_single_choice'
  ) then
    alter table public.questions add constraint questions_valid_single_choice
      check (public._test_question_is_valid(prompt, choices, correct_index)) not valid;
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Students receive only published, approved, nonempty worksheets, never answers.
-- Administrators also receive draft and empty banks (NULL worksheet fields).
create or replace function public.get_test_catalog()
returns table (
  bank_id bigint, bank_code text, bank_name_zh text, bank_name_en text,
  bank_description_zh text, bank_description_en text, bank_published boolean,
  subject text, title_zh text, title_en text, grade text,
  question_count bigint, sort_order int
)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_approved boolean;
  v_subjects text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_admin := public.is_admin();
  if not v_admin then
    select a.approved, a.subjects into v_approved, v_subjects
    from public.test_access a where a.user_id = auth.uid();
    if v_approved is not true then raise exception 'PENDING_APPROVAL'; end if;
  end if;
  return query
    select b.id, b.code, b.name_zh, b.name_en, b.description_zh,
           b.description_en, b.published, w.subject, w.title_zh, w.title_en,
           w.grade, coalesce(c.n, 0::bigint), w.sort_order
    from public.test_question_banks b
    left join public.test_worksheets w on w.bank_id = b.id
    left join (
      select q.subject as worksheet_subject, count(*) as n
      from public.questions q group by q.subject
    ) c on c.worksheet_subject = w.subject
    where v_admin or (
      b.published and coalesce(c.n, 0::bigint) > 0
      and (v_subjects is null or w.subject = any(v_subjects))
    )
    order by b.id, w.sort_order, w.subject;
end;
$$;

create or replace function public.get_questions(p_subject text default null)
returns table (id bigint, subject text, grade text, prompt text, choices jsonb)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_approved boolean;
  v_subjects text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_admin := public.is_admin();
  if not v_admin then
    select a.approved, a.subjects into v_approved, v_subjects
    from public.test_access a where a.user_id = auth.uid();
    if v_approved is not true then raise exception 'PENDING_APPROVAL'; end if;
  end if;
  return query
    select q.id, q.subject, q.grade, q.prompt, q.choices
    from public.questions q
    join public.test_worksheets w on w.subject = q.subject
    join public.test_question_banks b on b.id = w.bank_id
    where (p_subject is null or q.subject = p_subject)
      and (v_admin or (b.published
        and (v_subjects is null or q.subject = any(v_subjects))))
    order by q.subject, q.sort_order, q.id;
end;
$$;

create or replace function public.admin_save_question_bank(
  p_id bigint default null, p_code text default null,
  p_name_zh text default '', p_name_en text default '',
  p_description_zh text default '', p_description_en text default ''
)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_bank public.test_question_banks%rowtype;
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_name_zh is null or p_name_en is null
     or p_description_zh is null or p_description_en is null
     or (pg_catalog.btrim(p_name_zh) = '' and pg_catalog.btrim(p_name_en) = '')
     or pg_catalog.char_length(p_name_zh) > 160
     or pg_catalog.char_length(p_name_en) > 160
     or pg_catalog.char_length(p_description_zh) > 4000
     or pg_catalog.char_length(p_description_en) > 4000 then
    raise exception 'INVALID_BANK: provide a name; names <=160, descriptions <=4000 characters';
  end if;
  if p_id is null then
    if p_code is null or p_code !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
      raise exception 'INVALID_BANK: code must be 1-64 lowercase letters/digits/hyphens';
    end if;
    begin
      insert into public.test_question_banks
        (code, name_zh, name_en, description_zh, description_en)
      values (p_code, pg_catalog.btrim(p_name_zh), pg_catalog.btrim(p_name_en),
              p_description_zh, p_description_en)
      returning id into v_id;
    exception when unique_violation then raise exception 'BANK_CODE_EXISTS';
    end;
  else
    select b.* into v_bank from public.test_question_banks b
    where b.id = p_id for update;
    if not found then raise exception 'BANK_NOT_FOUND'; end if;
    if p_code is not null and p_code <> v_bank.code then
      raise exception 'BANK_CODE_IMMUTABLE';
    end if;
    update public.test_question_banks b
    set name_zh = pg_catalog.btrim(p_name_zh), name_en = pg_catalog.btrim(p_name_en),
        description_zh = p_description_zh, description_en = p_description_en
    where b.id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_set_question_bank_published(
  p_bank_id bigint, p_published boolean
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_published is null then raise exception 'INVALID_BANK'; end if;
  select b.id into v_id from public.test_question_banks b
  where b.id = p_bank_id for update;
  if not found then raise exception 'BANK_NOT_FOUND'; end if;
  if p_published then
    if not exists (select 1 from public.test_worksheets w where w.bank_id = v_id) then
      raise exception 'EMPTY_BANK';
    end if;
    if exists (
      select 1 from public.test_worksheets w
      where w.bank_id = v_id and not exists (
        select 1 from public.questions q where q.subject = w.subject
      )
    ) or exists (
      select 1 from public.questions q
      join public.test_worksheets w on w.subject = q.subject
      where w.bank_id = v_id
        and not public._test_question_is_valid(q.prompt, q.choices, q.correct_index)
    ) then
      raise exception 'INVALID_QUESTIONS: every worksheet must contain valid questions';
    end if;
  end if;
  update public.test_question_banks b set published = p_published where b.id = v_id;
end;
$$;

-- Atomic import: only NEW worksheet codes in a draft bank. Never overwrites IDs.
-- Payload: [{code,title_zh,title_en,grade,questions:[{prompt,choices,correct_index}]}]
create or replace function public.admin_import_question_bank(
  p_bank_id bigint, p_worksheets jsonb
)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_bank public.test_question_banks%rowtype;
  v_sheet jsonb;
  v_question jsonb;
  v_subject text;
  v_code text;
  v_title_zh text;
  v_title_en text;
  v_grade text;
  v_correct int;
  v_count int := 0;
  v_sort int;
  v_qsort int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select b.* into v_bank from public.test_question_banks b
  where b.id = p_bank_id for update;
  if not found then raise exception 'BANK_NOT_FOUND'; end if;
  if v_bank.published then raise exception 'BANK_PUBLISHED'; end if;
  if p_worksheets is null or pg_catalog.jsonb_typeof(p_worksheets) <> 'array' then
    raise exception 'INVALID_IMPORT: worksheets must be an array';
  end if;
  if pg_catalog.jsonb_array_length(p_worksheets) not between 1 and 100 then
    raise exception 'INVALID_IMPORT: import 1-100 worksheets at a time';
  end if;
  if pg_catalog.pg_column_size(p_worksheets) > 16000000 then
    raise exception 'INVALID_IMPORT: payload is too large';
  end if;
  select coalesce(max(w.sort_order), 0) into v_sort
  from public.test_worksheets w where w.bank_id = v_bank.id;
  for v_sheet in select value from pg_catalog.jsonb_array_elements(p_worksheets)
  loop
    if pg_catalog.jsonb_typeof(v_sheet) <> 'object'
       or pg_catalog.jsonb_typeof(v_sheet -> 'code') is distinct from 'string'
       or (v_sheet ->> 'code') !~ '^[a-z0-9][a-z0-9-]{0,63}$'
       or pg_catalog.jsonb_typeof(v_sheet -> 'questions') is distinct from 'array' then
      raise exception 'INVALID_IMPORT: invalid worksheet code or questions array';
    end if;
    if (v_sheet ? 'title_zh' and pg_catalog.jsonb_typeof(v_sheet -> 'title_zh') <> 'string')
       or (v_sheet ? 'title_en' and pg_catalog.jsonb_typeof(v_sheet -> 'title_en') <> 'string')
       or (v_sheet ? 'grade' and pg_catalog.jsonb_typeof(v_sheet -> 'grade') not in ('string', 'null')) then
      raise exception 'INVALID_IMPORT: titles and grade must be strings';
    end if;
    v_code := v_sheet ->> 'code';
    v_title_zh := pg_catalog.btrim(coalesce(v_sheet ->> 'title_zh', ''));
    v_title_en := pg_catalog.btrim(coalesce(v_sheet ->> 'title_en', ''));
    v_grade := nullif(pg_catalog.btrim(v_sheet ->> 'grade'), '');
    if (v_title_zh = '' and v_title_en = '')
       or pg_catalog.char_length(v_title_zh) > 160
       or pg_catalog.char_length(v_title_en) > 160
       or pg_catalog.char_length(v_grade) > 32 then
      raise exception 'INVALID_IMPORT: provide a worksheet title <=160 and grade <=32 characters';
    end if;
    if pg_catalog.jsonb_array_length(v_sheet -> 'questions') < 1 then
      raise exception 'INVALID_IMPORT: each worksheet needs at least one question';
    end if;
    v_count := v_count + pg_catalog.jsonb_array_length(v_sheet -> 'questions');
    if v_count > 1000 then raise exception 'INVALID_IMPORT: maximum 1000 questions per import'; end if;
    v_subject := v_bank.code || ':' || v_code;
    if exists (select 1 from public.test_worksheets w where w.subject = v_subject) then
      raise exception 'WORKSHEET_EXISTS: %', v_subject;
    end if;
    v_sort := v_sort + 1;
    insert into public.test_worksheets(subject, bank_id, title_zh, title_en, grade, sort_order)
    values (v_subject, v_bank.id, v_title_zh, v_title_en, v_grade, v_sort);
    v_qsort := 0;
    for v_question in select value from pg_catalog.jsonb_array_elements(v_sheet -> 'questions')
    loop
      if pg_catalog.jsonb_typeof(v_question) <> 'object'
         or pg_catalog.jsonb_typeof(v_question -> 'prompt') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_question -> 'correct_index') is distinct from 'number'
         or (v_question ->> 'correct_index') !~ '^[0-9]$' then
        raise exception 'INVALID_IMPORT: question needs prompt and a 0-based integer correct_index';
      end if;
      v_correct := (v_question ->> 'correct_index')::int;
      if not public._test_question_is_valid(
        v_question ->> 'prompt', v_question -> 'choices', v_correct
      ) then
        raise exception 'INVALID_IMPORT: invalid question or choices in %', v_subject;
      end if;
      v_qsort := v_qsort + 1;
      insert into public.questions(subject, grade, prompt, choices, correct_index, sort_order)
      values (v_subject, v_grade, v_question ->> 'prompt', v_question -> 'choices',
              v_correct, v_qsort);
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_delete_draft_worksheet(p_subject text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_bank_id bigint;
  v_published boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select w.bank_id into v_bank_id from public.test_worksheets w where w.subject = p_subject;
  if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;
  select b.published into v_published from public.test_question_banks b
  where b.id = v_bank_id for update;
  if v_published then raise exception 'BANK_PUBLISHED'; end if;
  if exists (select 1 from public.submissions s where s.subject = p_subject) then
    raise exception 'WORKSHEET_HAS_SUBMISSIONS';
  end if;
  delete from public.questions q where q.subject = p_subject;
  delete from public.test_worksheets w where w.subject = p_subject;
end;
$$;

-- Preserved RPC parameters; email is sourced from auth.users, not p_email.
-- A shared bank lock serializes publication/import against a running submission.
-- A per-user/worksheet transaction lock prevents simultaneous duplicate attempts.
create or replace function public.submit_test(
  p_name text, p_email text, p_subject text, p_answers jsonb
)
returns table (score int, total int)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_approved boolean;
  v_subjects text[];
  v_published boolean;
  v_email text;
  v_name text;
  v_score int := 0;
  v_total int := 0;
  v_snapshot jsonb := '[]'::jsonb;
  v_answer record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_subject is null or pg_catalog.btrim(p_subject) = '' then
    raise exception 'SUBJECT_REQUIRED';
  end if;
  v_admin := public.is_admin();
  if not v_admin then
    select a.approved, a.subjects into v_approved, v_subjects
    from public.test_access a where a.user_id = v_uid;
    if v_approved is not true then raise exception 'PENDING_APPROVAL'; end if;
    if v_subjects is not null and not (p_subject = any(v_subjects)) then
      raise exception 'SUBJECT_NOT_ALLOWED';
    end if;
  end if;
  select b.published into v_published
  from public.test_question_banks b
  join public.test_worksheets w on w.bank_id = b.id
  where w.subject = p_subject for share of b;
  if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;
  if not v_admin and not v_published then raise exception 'SUBJECT_NOT_ALLOWED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::text || ':' || p_subject, 0)
  );
  if not v_admin and exists (
    select 1 from public.submissions s where s.user_id = v_uid and s.subject = p_subject
  ) then
    raise exception 'ALREADY_SUBMITTED';
  end if;
  if p_answers is null or pg_catalog.jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS';
  end if;
  for v_answer in select key, value from pg_catalog.jsonb_each(p_answers)
  loop
    if pg_catalog.jsonb_typeof(v_answer.value) <> 'number'
       or v_answer.value::text !~ '^[0-9]$' then
      raise exception 'INVALID_ANSWERS: choice must be a 0-based integer';
    end if;
    if not exists (
         select 1 from public.questions q
         where q.subject = p_subject and q.id::text = v_answer.key
           and (v_answer.value::text)::int < case
             when pg_catalog.jsonb_typeof(q.choices) = 'array'
             then pg_catalog.jsonb_array_length(q.choices) else 0 end
       ) then
      raise exception 'INVALID_ANSWERS: invalid question or choice';
    end if;
  end loop;
  if exists (
    select 1 from public.questions q where q.subject = p_subject
      and not public._test_question_is_valid(q.prompt, q.choices, q.correct_index)
  ) then
    raise exception 'INVALID_QUESTIONS';
  end if;
  select count(*)::int,
         (count(*) filter (where (p_answers ->> q.id::text)::int = q.correct_index))::int,
         pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', q.id, 'prompt', q.prompt, 'choices', q.choices,
           'correct_index', q.correct_index,
           'picked_index', (p_answers ->> q.id::text)::int, 'sort_order', q.sort_order
         ) order by q.sort_order, q.id)
  into v_total, v_score, v_snapshot
  from public.questions q where q.subject = p_subject;
  if v_total = 0 then raise exception 'INVALID_QUESTIONS: empty worksheet'; end if;
  select u.email, coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
                          nullif(pg_catalog.left(p_name, 160), ''), '')
  into v_email, v_name from auth.users u where u.id = v_uid;
  insert into public.submissions
    (name, email, subject, answers, score, total, user_id, question_snapshot)
  values (v_name, v_email, p_subject, p_answers, v_score, v_total, v_uid, v_snapshot);
  return query select v_score, v_total;
end;
$$;

create or replace function public.admin_get_submission(p_id bigint)
returns table (
  question_id bigint, prompt text, choices jsonb, correct_index int,
  picked_index int, sort_order int
)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_answers jsonb;
  v_subject text;
  v_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select s.answers, s.subject, s.question_snapshot
  into v_answers, v_subject, v_snapshot
  from public.submissions s where s.id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_snapshot is not null then
    return query
      select x.id, x.prompt, x.choices, x.correct_index, x.picked_index, x.sort_order
      from pg_catalog.jsonb_to_recordset(v_snapshot) as x(
        id bigint, prompt text, choices jsonb, correct_index int,
        picked_index int, sort_order int
      ) order by x.sort_order, x.id;
  else
    -- Historical fallback cannot reconstruct rows already deleted/changed.
    return query
      select q.id, q.prompt, q.choices, q.correct_index,
             case when (v_answers ->> q.id::text) ~ '^[0-9]$'
                  then (v_answers ->> q.id::text)::int else null end,
             q.sort_order
      from public.questions q
      where v_subject is null or q.subject = v_subject
      order by q.sort_order, q.id;
  end if;
end;
$$;

-- The old admin permission picker remains compatible, now listing drafts too.
create or replace function public.admin_list_subjects()
returns table (subject text)
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query select w.subject from public.test_worksheets w
    where exists (select 1 from public.questions q where q.subject = w.subject)
    order by w.subject;
end;
$$;

-- PUBLIC EXECUTE is inherited by anon unless explicitly revoked. Cover both
-- new functions and retained privileged RPCs; keep trigger-only helpers private.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature, p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      '_test_question_is_valid', 'handle_new_user', 'is_admin',
      'get_questions', 'submit_test', 'get_my_submissions', 'get_test_catalog',
      'admin_list_users', 'admin_set_access', 'admin_list_subjects',
      'admin_list_submissions', 'admin_get_submission', 'admin_save_question_bank',
      'admin_set_question_bank_published', 'admin_import_question_bank',
      'admin_delete_draft_worksheet'
    ])
  loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', r.signature);
    if r.proname not in ('_test_question_is_valid', 'handle_new_user') then
      execute pg_catalog.format('grant execute on function %s to authenticated', r.signature);
    end if;
  end loop;
  if pg_catalog.to_regclass('public.submissions_by_student') is not null then
    revoke all on public.submissions_by_student from public, anon, authenticated;
  end if;
end;
$$;

commit;
