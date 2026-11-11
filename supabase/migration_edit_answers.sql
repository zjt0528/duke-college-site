-- Run after migration_question_banks.sql. Admin-only answer editing.
begin;
create or replace function public.admin_get_worksheet_answers(p_subject text)
returns table(question_id bigint, prompt text, choices jsonb, correct_index int, sort_order int)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query select q.id,q.prompt,q.choices,q.correct_index,q.sort_order
    from public.questions q where q.subject=p_subject order by q.sort_order,q.id;
end;
$$;
create or replace function public.admin_update_worksheet_answers(p_subject text,p_changes jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_published boolean;
  v_change jsonb;
  v_question public.questions%rowtype;
  v_count int := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select b.published into v_published from public.test_question_banks b
    join public.test_worksheets w on w.bank_id=b.id where w.subject=p_subject for update of b;
  if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;
  if v_published then raise exception 'BANK_PUBLISHED'; end if;
  if pg_catalog.jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'INVALID_ANSWERS'; end if;
  if pg_catalog.jsonb_array_length(p_changes) not between 1 and 1000 then raise exception 'INVALID_ANSWERS'; end if;
  if exists(select 1 from public.submissions s where (s.subject=p_subject or s.subject is null) and s.question_snapshot is null) then
    raise exception 'HISTORY_WITHOUT_SNAPSHOT';
  end if;
  if (select count(distinct x->>'question_id') from pg_catalog.jsonb_array_elements(p_changes) x)
       <> pg_catalog.jsonb_array_length(p_changes) then raise exception 'INVALID_ANSWERS'; end if;
  for v_change in select value from pg_catalog.jsonb_array_elements(p_changes) loop
    if pg_catalog.jsonb_typeof(v_change->'question_id') is distinct from 'number'
      or coalesce(v_change->>'question_id','') !~ '^[1-9][0-9]*$'
      or pg_catalog.jsonb_typeof(v_change->'correct_index') is distinct from 'number'
      or coalesce(v_change->>'correct_index','') !~ '^[0-9]$'
      or pg_catalog.jsonb_typeof(v_change->'expected_index') is distinct from 'number'
      or coalesce(v_change->>'expected_index','') !~ '^[0-9]$' then raise exception 'INVALID_ANSWERS'; end if;
    select * into v_question from public.questions q where q.subject=p_subject and q.id=(v_change->>'question_id')::bigint for update;
    if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
    if v_question.correct_index <> (v_change->>'expected_index')::int then raise exception 'ANSWER_CHANGED'; end if;
    if not public._test_question_is_valid(v_question.prompt,v_question.choices,(v_change->>'correct_index')::int) then raise exception 'INVALID_ANSWERS'; end if;
    update public.questions set correct_index=(v_change->>'correct_index')::int where id=v_question.id;
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.admin_get_worksheet_answers(text) from public,anon;
revoke all on function public.admin_update_worksheet_answers(text,jsonb) from public,anon;
grant execute on function public.admin_get_worksheet_answers(text) to authenticated;
grant execute on function public.admin_update_worksheet_answers(text,jsonb) to authenticated;
create or replace function public.admin_apply_bank_answer_key(p_bank_id bigint,p_key jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_bank public.test_question_banks%rowtype;
  v_row jsonb;
  v_answers text;
  v_subject text;
  v_changes jsonb;
  v_count int;
  v_total int := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select * into v_bank from public.test_question_banks where id=p_bank_id for update;
  if not found then raise exception 'BANK_NOT_FOUND'; end if;
  if v_bank.published then raise exception 'BANK_PUBLISHED'; end if;
  if pg_catalog.jsonb_typeof(p_key) is distinct from 'array' then raise exception 'INVALID_ANSWERS'; end if;
  if pg_catalog.jsonb_array_length(p_key) not between 1 and 100 then raise exception 'INVALID_ANSWERS'; end if;
  if (select count(distinct x->>'code') from pg_catalog.jsonb_array_elements(p_key) x) <> pg_catalog.jsonb_array_length(p_key) then raise exception 'INVALID_ANSWERS'; end if;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_key) loop
    if pg_catalog.jsonb_typeof(v_row->'code') is distinct from 'string' or coalesce(v_row->>'code','') !~ '^[a-z0-9][a-z0-9-]{0,63}$'
      or pg_catalog.jsonb_typeof(v_row->'answers') is distinct from 'string' then raise exception 'INVALID_ANSWERS'; end if;
    v_answers := pg_catalog.upper(v_row->>'answers');
    if pg_catalog.length(v_answers) not between 1 and 1000 or v_answers !~ '^[A-J]+$' then raise exception 'INVALID_ANSWERS'; end if;
    select w.subject into v_subject from public.test_worksheets w
      where w.bank_id=p_bank_id and w.subject=v_bank.code||':'||(v_row->>'code');
    if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;
    select count(*)::int,pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'question_id',q.id,'expected_index',q.correct_index,
      'correct_index',pg_catalog.ascii(pg_catalog.substr(v_answers,q.n::int,1))-65
    ) order by q.n) into v_count,v_changes from (
      select id,correct_index,row_number() over(order by sort_order,id) as n
      from public.questions where subject=v_subject
    ) q;
    if v_count <> pg_catalog.length(v_answers) then raise exception 'ANSWER_COUNT_MISMATCH'; end if;
    v_total := v_total+public.admin_update_worksheet_answers(v_subject,v_changes);
  end loop;
  return v_total;
end;
$$;
revoke all on function public.admin_apply_bank_answer_key(bigint,jsonb) from public,anon;
grant execute on function public.admin_apply_bank_answer_key(bigint,jsonb) to authenticated;

commit;


