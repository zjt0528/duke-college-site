import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const sql = async (name) => readFile(new URL('../supabase/' + name, import.meta.url), 'utf8');
const ids = {
  admin: '00000000-0000-0000-0000-000000000001',
  student: '00000000-0000-0000-0000-000000000002',
  pending: '00000000-0000-0000-0000-000000000003',
  restricted: '00000000-0000-0000-0000-000000000004',
};

test('PostgreSQL migration, imports, permissions, scoring and history', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
      created_at timestamptz default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const file of ['setup.sql', 'migration_link_users.sql', 'migration_admin_access.sql',
    'migration_one_submission_results.sql', 'migration_submission_detail.sql']) await db.exec(await sql(file));
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, name + '@example.test']);
  }
  await db.query('insert into public.admins(user_id) values ($1)', [ids.admin]);
  await db.query('update public.test_access set approved=true where user_id in ($1,$2)', [ids.student, ids.restricted]);
  await db.query('update public.test_access set subjects=ARRAY[\'English\'] where user_id=$1', [ids.restricted]);
  const original = (await db.query('select id,subject from public.questions order by id')).rows;
  await db.exec(await sql('migration_question_banks.sql'));
  await db.exec(await sql('migration_edit_answers.sql'));

  async function asUser(user, fn, role = 'authenticated') {
    await db.exec('set role ' + role);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ? ids[user] : '']);
    try { return await fn(); } finally { await db.exec('reset role'); }
  }
  const query = (text, args) => db.query(text, args);
  let bankId;
  const worksheets = [{
    code: 'unit-1', title_zh: '阅读练习一', title_en: 'Reading unit one', grade: 'G3',
    questions: [
      { prompt: 'Choose a noun.', choices: ['book', 'quickly'], correct_index: 0 },
      { prompt: 'Choose a verb.', choices: ['blue', 'read'], correct_index: 1 },
    ],
  }];

  await t.test('backfill and rerun preserve question IDs and old subjects', async () => {
    assert.deepEqual((await query('select id,subject from public.questions order by id')).rows, original);
    await db.exec(await sql('migration_question_banks.sql'));
    assert.deepEqual((await query('select id,subject from public.questions order by id')).rows, original);
    assert.equal((await query('select count(*)::int as n from public.test_worksheets')).rows[0].n, 2);
  });

  await t.test('anonymous access, direct answer table and student admin RPC are blocked', async () => {
    await assert.rejects(asUser(null, () => query('select * from public.get_test_catalog()'), 'anon'), /permission denied/);
    await assert.rejects(asUser(null, () => query('select * from public.get_questions(null)'), 'anon'), /permission denied/);
    await assert.rejects(asUser(null, () => query('select * from public.submit_test(null,null,\'English\',\'{}\')'), 'anon'), /permission denied/);
    await assert.rejects(asUser('student', () => query('select * from public.questions')), /permission denied/);
    await assert.rejects(asUser('student', () => query('select * from public.submissions_by_student')), /permission denied/);
    await assert.rejects(asUser('student', () => query("select public.admin_save_question_bank(null,'bad','坏','Bad','','')")), /NOT_ADMIN/);
    await assert.rejects(asUser('pending', () => query('select * from public.get_test_catalog()')), /PENDING_APPROVAL/);
  });

  await t.test('admin creates empty draft bank; students cannot see it', async () => {
    bankId = (await asUser('admin', () => query("select public.admin_save_question_bank(null,'new-reading','新阅读题库','New reading','','') as id"))).rows[0].id;
    const adminCatalog = (await asUser('admin', () => query('select * from public.get_test_catalog()'))).rows;
    assert(adminCatalog.some((r) => r.bank_id === bankId && r.subject === null));
    const studentCatalog = (await asUser('student', () => query('select * from public.get_test_catalog()'))).rows;
    assert(!studentCatalog.some((r) => r.bank_id === bankId));
    await assert.rejects(asUser('admin', () => query('select public.admin_set_question_bank_published($1,true)', [bankId])), /EMPTY|INVALID/);
  });

  await t.test('draft import is atomic, duplicate-safe and validates answer indices', async () => {
    const invalid = [...worksheets, { ...worksheets[0], code: 'unit-bad', questions: [{ prompt: 'Bad', choices: ['x', 'y'], correct_index: 9 }] }];
    await assert.rejects(asUser('admin', () => query('select public.admin_import_question_bank($1,$2::jsonb)', [bankId, JSON.stringify(invalid)])), /INVALID/);
    assert.equal((await query('select count(*)::int as n from public.questions')).rows[0].n, 4);
    const imported = await asUser('admin', () => query('select public.admin_import_question_bank($1,$2::jsonb) as n', [bankId, JSON.stringify(worksheets)]));
    assert.equal(imported.rows[0].n, 2);
    await assert.rejects(asUser('admin', () => query('select public.admin_import_question_bank($1,$2::jsonb)', [bankId, JSON.stringify(worksheets)])), /EXIST|DUPLICATE/);
    assert.equal((await query('select count(*)::int as n from public.questions')).rows[0].n, 6);
    assert.equal((await asUser('student', () => query('select * from public.get_questions($1)', ['new-reading:unit-1']))).rows.length, 0);
  });

  await t.test('published bank respects per-worksheet student permissions and hides answers', async () => {
    await asUser('admin', () => query('select public.admin_set_question_bank_published($1,true)', [bankId]));
    const rows = (await asUser('student', () => query('select * from public.get_questions($1)', ['new-reading:unit-1']))).rows;
    assert.equal(rows.length, 2);
    assert(!('correct_index' in rows[0]));
    const catalog = (await asUser('restricted', () => query('select * from public.get_test_catalog()'))).rows;
    assert.deepEqual(catalog.map((r) => r.subject), ['English']);
    await assert.rejects(asUser('restricted', () => query("select * from public.submit_test('x','x','new-reading:unit-1','{}')")), /SUBJECT_NOT_ALLOWED/);
    await assert.rejects(asUser('admin', () => query('select public.admin_import_question_bank($1,$2::jsonb)', [bankId, JSON.stringify([{ ...worksheets[0], code: 'unit-2' }])])), /DRAFT|PUBLISHED/);
  });

  let submissionId, questions;
  await t.test('explicit worksheet and valid picks required; server grades and records verified identity', async () => {
    await assert.rejects(asUser('student', () => query("select * from public.submit_test('x','spoof@example.test',null,'{}')")), /SUBJECT|WORKSHEET/);
    await assert.rejects(asUser('student', () => query("select * from public.submit_test('x','x','missing','{}')")), /SUBJECT|WORKSHEET|NOT_FOUND/);
    questions = (await query('select * from public.questions where subject=$1 order by sort_order,id', ['new-reading:unit-1'])).rows;
    await assert.rejects(asUser('student', () => query("select * from public.submit_test('x','x','new-reading:unit-1','[]')")), /INVALID_ANSWERS/);
    const answers = Object.fromEntries(questions.map((q) => [String(q.id), q.correct_index]));
    const result = (await asUser('student', () => query("select * from public.submit_test('x','spoof@example.test','new-reading:unit-1',$1::jsonb)", [JSON.stringify(answers)]))).rows;
    assert.deepEqual(result, [{ score: 2, total: 2 }]);
    const stored = (await query('select * from public.submissions where user_id=$1', [ids.student])).rows[0];
    submissionId = stored.id;
    assert.equal(stored.email, 'student@example.test');
    assert.equal(stored.question_snapshot.length, 2);
    await assert.rejects(asUser('student', () => query("select * from public.submit_test('x','x','new-reading:unit-1',$1::jsonb)", [JSON.stringify(answers)])), /ALREADY_SUBMITTED/);
  });

  await t.test('snapshot review survives owner edits and unpublishing', async () => {
    const changes = JSON.stringify([{ question_id: questions[0].id, expected_index: 0, correct_index: 1 }]);
    await assert.rejects(asUser('student', () => query('select * from public.admin_get_worksheet_answers($1)', ['new-reading:unit-1'])), /NOT_ADMIN/);
    await assert.rejects(asUser('admin', () => query('select public.admin_update_worksheet_answers($1,$2::jsonb)', ['new-reading:unit-1', changes])), /BANK_PUBLISHED/);
    await asUser('admin', () => query('select public.admin_set_question_bank_published($1,false)', [bankId]));
    await assert.rejects(asUser('student', () => query('select public.admin_update_worksheet_answers($1,$2::jsonb)', ['new-reading:unit-1', changes])), /NOT_ADMIN/);
    const edited = await asUser('admin', () => query('select public.admin_update_worksheet_answers($1,$2::jsonb) as n', ['new-reading:unit-1', changes]));
    assert.equal(edited.rows[0].n, 1);
    await assert.rejects(asUser('admin', () => query('select public.admin_update_worksheet_answers($1,$2::jsonb)', ['new-reading:unit-1', changes])), /ANSWER_CHANGED/);
    assert.equal((await asUser('admin', () => query('select * from public.admin_get_worksheet_answers($1)', ['new-reading:unit-1']))).rows[0].correct_index, 1);
    const validKey = { code: 'unit-1', answers: 'AB' };
    await assert.rejects(asUser('admin', () => query('select public.admin_apply_bank_answer_key($1,$2::jsonb)', [bankId, JSON.stringify([validKey, { code: 'missing', answers: 'AB' }])])), /SUBJECT_NOT_FOUND/);
    assert.equal((await query('select correct_index from public.questions where id=$1', [questions[0].id])).rows[0].correct_index, 1); // Earlier worksheet rolled back too.
    await assert.rejects(asUser('admin', () => query('select public.admin_apply_bank_answer_key($1,$2::jsonb)', [bankId, JSON.stringify([{ code: 'unit-1', answers: 'A' }])])), /ANSWER_COUNT_MISMATCH/);
    await assert.rejects(asUser('student', () => query('select public.admin_apply_bank_answer_key($1,$2::jsonb)', [bankId, JSON.stringify([validKey])])), /NOT_ADMIN/);
    assert.equal((await asUser('admin', () => query('select public.admin_apply_bank_answer_key($1,$2::jsonb) as n', [bankId, JSON.stringify([validKey])]))).rows[0].n, 2);
    const history = (await asUser('admin', () => query('select * from public.admin_get_submission($1)', [submissionId]))).rows;
    assert.equal(history.length, 2);
    assert.equal(history[0].prompt, 'Choose a noun.');
    assert.equal(history[0].correct_index, 0);
    assert.equal(history[0].picked_index, 0);
    const results = (await asUser('student', () => query('select * from public.get_my_submissions()'))).rows;
    assert.equal(results[0].score, 2);
    await assert.rejects(asUser('student', () => query('select * from public.admin_get_submission($1)', [submissionId])), /NOT_ADMIN/);
  });
});

test('legacy seed files preserve other banks and reject repeat imports', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated;');
  await db.exec(await sql('setup.sql'));
  const before = (await db.query('select id from public.questions order by id')).rows;
  let count = 4;
  for (const level of ['2a', '3a', '4a', '5a', '6a']) {
    const source = await sql('questions_lg_r_rs_' + level + '.sql');
    await db.exec(source);
    const next = (await db.query('select count(*)::int as n from public.questions')).rows[0].n;
    assert(next > count);
    await assert.rejects(db.exec(source), /WORKSHEETS_ALREADY_EXIST/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.questions')).rows[0].n, next);
    count = next;
  }
  assert.deepEqual((await db.query('select id from public.questions where id <= 4 order by id')).rows, before);
  const invalid = (await db.query(`
    select count(*)::int as n from public.questions
    where jsonb_typeof(choices) <> 'array' or jsonb_array_length(choices) not between 2 and 10
      or correct_index < 0 or correct_index >= jsonb_array_length(choices) or btrim(prompt) = ''
  `)).rows[0].n;
  assert.equal(invalid, 0);
});
