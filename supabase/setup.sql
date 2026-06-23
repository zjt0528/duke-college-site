-- ============================================================================
-- Duke College — online test schema (Supabase)
-- Run this once in your Supabase project:  SQL Editor > New query > paste > Run.
--
-- Design goals:
--   * Questions are served to the browser WITHOUT the answer key.
--   * Grading happens on the server, so answers never reach the client.
--   * The browser only ever calls two functions (get_questions, submit_test);
--     it cannot read the questions or submissions tables directly.
-- ============================================================================

-- 1. Tables ------------------------------------------------------------------
create table if not exists public.questions (
  id            bigint generated always as identity primary key,
  subject       text not null,
  grade         text,
  prompt        text not null,
  choices       jsonb not null,          -- e.g. ["A","B","C","D"]
  correct_index int  not null,           -- 0-based index into choices (HIDDEN from anon)
  sort_order    int  default 0,
  created_at    timestamptz default now()
);

create table if not exists public.submissions (
  id         bigint generated always as identity primary key,
  name       text,
  email      text,
  subject    text,
  answers    jsonb not null,             -- { "<question_id>": <selected_index> }
  score      int  not null,
  total      int  not null,
  created_at timestamptz default now()
);

-- 2. Lock the tables down ----------------------------------------------------
-- Enable RLS and add NO policies for anon. With RLS on and no policy, the
-- public (anon) role cannot read or write these tables at all. All access is
-- funneled through the SECURITY DEFINER functions below, which run as the
-- table owner and therefore bypass RLS.
alter table public.questions   enable row level security;
alter table public.submissions enable row level security;

revoke all on public.questions   from anon, authenticated;
revoke all on public.submissions from anon, authenticated;

-- 3. Serve questions WITHOUT the answer key ----------------------------------
create or replace function public.get_questions(p_subject text default null)
returns table (id bigint, subject text, grade text, prompt text, choices jsonb)
language sql
security definer
set search_path = public
as $$
  select id, subject, grade, prompt, choices
  from public.questions
  where p_subject is null or subject = p_subject
  order by subject, sort_order, id
$$;

-- 4. Grade a submission on the server, store it, return only the score -------
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
    v_pick  := nullif(p_answers ->> r.id::text, '')::int;   -- selected index for this question
    if v_pick is not null and v_pick = r.correct_index then
      v_score := v_score + 1;
    end if;
  end loop;

  insert into public.submissions(name, email, subject, answers, score, total)
  values (p_name, p_email, p_subject, p_answers, v_score, v_total);

  return query select v_score, v_total;
end;
$$;

-- 5. Let the public (anon) role call ONLY these two functions ----------------
grant execute on function public.get_questions(text)               to anon;
grant execute on function public.submit_test(text, text, text, jsonb) to anon;

-- 6. Sample questions — delete these and insert your own ---------------------
insert into public.questions (subject, grade, prompt, choices, correct_index, sort_order) values
  ('English', 'G3-4', 'Choose the correct word: She ___ to school every day.', '["go","goes","going","gone"]', 1, 1),
  ('English', 'G3-4', 'Which word is a noun?',                                  '["quickly","happiness","run","blue"]', 1, 2),
  ('Math',    'G3-4', 'What is 7 × 8?',                                         '["54","56","48","64"]', 1, 1),
  ('Math',    'G3-4', 'Which fraction is the largest?',                         '["1/2","1/3","1/4","1/5"]', 0, 2);
