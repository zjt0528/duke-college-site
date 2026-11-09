-- Run after migration_question_banks.sql to rename the existing bank.
-- Only display names change; questions, permissions and results are preserved.
begin;

update public.test_question_banks
set name_zh = 'book reading vocabulary',
    name_en = 'book reading vocabulary'
where code = 'legacy'
returning id, code, name_zh, name_en;

commit;
