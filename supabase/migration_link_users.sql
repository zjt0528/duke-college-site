-- ============================================================================
-- Migration: link test submissions to user accounts + require login server-side
-- Run this in the Supabase SQL editor AFTER setup.sql (safe to run once).
--
-- 1. submissions.user_id records WHICH account submitted (auth.uid()), so you
--    can track attempts per student even if they change their display name.
-- 2. The two RPCs become callable only by logged-in users, so the login gate
--    is enforced by the database, not just by the page's JavaScript.
-- ============================================================================

-- 1. Add the user link column
alter table public.submissions
  add column if not exists user_id uuid references auth.users(id);

-- 2. Recreate submit_test to record the caller's account id
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
begin
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

-- 3. Require login: only authenticated users may call the RPCs
revoke execute on function public.get_questions(text)                  from anon;
revoke execute on function public.submit_test(text, text, text, jsonb) from anon;
grant  execute on function public.get_questions(text)                  to authenticated;
grant  execute on function public.submit_test(text, text, text, jsonb) to authenticated;

-- 4. Handy view: submissions per student (see it under Database > Views,
--    or query it in the SQL editor: select * from submissions_by_student;)
create or replace view public.submissions_by_student as
select
  s.user_id,
  s.email,
  count(*)                as attempts,
  max(s.created_at)       as last_attempt,
  round(avg(s.score::numeric / nullif(s.total, 0)) * 100) as avg_percent
from public.submissions s
group by s.user_id, s.email
order by last_attempt desc;
