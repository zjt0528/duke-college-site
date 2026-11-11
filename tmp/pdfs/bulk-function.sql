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
    if v_answers !~ '^[A-J]{1,1000}$' then raise exception 'INVALID_ANSWERS'; end if;
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
