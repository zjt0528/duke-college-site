-- ============================================================================
-- Migration: per-question breakdown of a submission (admin results page)
-- Run in the Supabase SQL editor AFTER migration_one_submission_results.sql.
--
-- admin_get_submission(id) returns every question of the submitted worksheet
-- with the student's picked answer and the correct answer, so the results
-- page can show exactly which questions were answered wrong.
-- ============================================================================

create or replace function public.admin_get_submission(p_id bigint)
returns table (
  question_id   bigint,
  prompt        text,
  choices       jsonb,
  correct_index int,
  picked_index  int,
  sort_order    int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answers jsonb;
  v_subject text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select s.answers, s.subject into v_answers, v_subject
  from public.submissions s where s.id = p_id;
  if v_answers is null then raise exception 'NOT_FOUND'; end if;

  return query
    select q.id, q.prompt, q.choices, q.correct_index,
           nullif(v_answers ->> q.id::text, '')::int,
           q.sort_order
    from public.questions q
    where v_subject is null or q.subject = v_subject
    order by q.sort_order, q.id;
end;
$$;

grant execute on function public.admin_get_submission(bigint) to authenticated;
