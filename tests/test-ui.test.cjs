const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const source = fs.readFileSync(path.join(__dirname, '..', 'test.js'), 'utf8');
const session = { user: { id: 'student-1', email: 'student@example.invalid', user_metadata: { full_name: 'Student' } } };
const catalog = [
  { bank_id: 1, bank_name_zh: '阅读题库', bank_name_en: 'Reading', bank_description_zh: '阅读练习', bank_description_en: 'Reading practice', bank_published: true, subject: 'reading:unit-1', title_zh: '练习一', title_en: 'Unit One', question_count: 1 },
  { bank_id: 1, bank_name_zh: '阅读题库', bank_name_en: 'Reading', bank_published: true, subject: 'reading:unit-2', title_zh: '练习二', title_en: 'Unit Two', question_count: 1 },
  { bank_id: 2, bank_name_zh: '词汇题库', bank_name_en: 'Vocabulary', bank_published: true, subject: 'words:unit-1', title_zh: '词汇一', title_en: 'Words One', question_count: 1 },
];
const question = (subject) => ({ id: subject === 'words:unit-1' ? 22 : subject === 'reading:unit-2' ? 12 : 11, subject, prompt: 'Question for ' + subject, choices: ['First', 'Second'] });
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

async function harness(options = {}) {
  const { window } = parseHTML('<html><body><div id="test-app"></div></body></html>');
  const calls = [];
  const storage = new Map([['site-lang', options.language || 'zh']]);
  let authChange;
  let managerCalls = 0;
  window.scrollTo = () => {};
  window.TestBankManager = { render({ root }) { managerCalls++; root.textContent = 'Manager rendered'; } };
  const db = {
    auth: {
      getSession: async () => ({ data: { session: options.session === null ? null : session } }),
      onAuthStateChange(fn) { authChange = fn; },
      async signOut() { authChange('SIGNED_OUT', null); return { error: null }; },
    },
    async rpc(name, params) {
      calls.push({ name, params: params === undefined ? undefined : JSON.parse(JSON.stringify(params)) });
      if (options.rpc) {
        const custom = options.rpc(name, params);
        if (custom !== undefined) return custom;
      }
      if (name === 'is_admin') return { data: !!options.admin, error: null };
      if (name === 'get_test_catalog') return { data: options.catalog === undefined ? catalog : options.catalog, error: null };
      if (name === 'get_my_submissions') return { data: options.submissions || [], error: null };
      if (name === 'get_questions') return { data: [question(params && params.p_subject)], error: null };
      if (name === 'submit_test') return { data: [{ score: 1, total: 1 }], error: null };
      throw new Error('Unexpected RPC: ' + name);
    },
  };
  window.supabase = { createClient() { return db; } };
  const context = vm.createContext({
    window, document: window.document,
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    location: { hash: '#/test', origin: 'http://localhost', pathname: '/' },
    FormData: class {
      constructor(form) { this.form = form; }
      get(name) { return [...this.form.querySelectorAll('input')].find((input) => input.name === name && input.checked)?.value ?? null; }
    },
    Event: window.Event, console, setTimeout, clearTimeout,
  });
  vm.runInContext(source, context, { filename: 'test.js' });
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await flush();
  return {
    window, calls, root: window.document.getElementById('test-app'),
    get managerCalls() { return managerCalls; },
    async changeSession(next) { authChange('SIGNED_IN', next); await flush(); },
    async language(value) { storage.set('site-lang', value); window.dispatchEvent(new window.Event('languageChanged')); await flush(); },
    async choose(id, value) {
      const select = window.document.getElementById(id);
      assert.ok(select, 'select exists: ' + id);
      select.querySelectorAll('option').forEach((option) => { option.selected = false; });
      [...select.querySelectorAll('option')].find((option) => option.value === value).selected = true;
      assert.equal(select.value, value);
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flush();
    },
  };
}

test('student loads catalog and only the selected worksheet, without admin controls', async () => {
  const ui = await harness();
  assert.deepEqual(ui.calls.filter((c) => c.name === 'get_questions'), [{ name: 'get_questions', params: { p_subject: 'reading:unit-1' } }]);
  assert.equal(ui.root.querySelectorAll('#test-bank-picker option').length, 2);
  assert.equal(ui.root.querySelectorAll('#test-worksheet-picker option').length, 2);
  assert.match(ui.root.textContent, /阅读题库/);
  assert.match(ui.root.textContent, /Question for reading:unit-1/);
  assert.doesNotMatch(ui.root.textContent, /题库管理/);
  assert.ok(ui.root.querySelector('#test-form'));
});

test('imported worksheet picker includes codes in both languages without duplicating existing prefixes', async () => {
  const ui = await harness({ catalog: [
    { ...catalog[0], subject: 'reading:2a1', title_zh: '阅读一', title_en: 'Book One' },
    { ...catalog[1], subject: 'reading:2a2', title_zh: '2a2 - 阅读二', title_en: '2a2 - Book Two' },
  ] });
  const labels = () => [...ui.root.querySelectorAll('#test-worksheet-picker option')].map(o => o.textContent);
  assert.deepEqual(labels(), ['2a1 - 阅读一  (1)', '2a2 - 阅读二  (1)']);
  await ui.language('en');
  assert.deepEqual(labels(), ['2a1 - Book One  (1)', '2a2 - Book Two  (1)']);
  assert.equal(ui.root.querySelector('#test-worksheet-picker option').value, 'reading:2a1');
});

test('level picker filters worksheets, sorts numeric codes, and survives language and bank changes', async () => {
  const rows = ['2a1', '2a10', '2a2', '2b1', '2c1', 'ma1'].map(code => ({
    ...catalog[0], subject: 'reading:' + code, title_en: code + ' Book', title_zh: code + ' 阅读'
  }));
  const ui = await harness({ catalog: [...rows, catalog[2]] });
  const values = id => [...ui.root.querySelectorAll('#' + id + ' option')].map(o => o.value);
  assert.deepEqual(values('test-level-picker'), ['2a', '2b', '2c', 'ma']);
  assert.deepEqual(values('test-worksheet-picker'), ['reading:2a1', 'reading:2a2', 'reading:2a10']);
  await ui.choose('test-level-picker', '2b');
  assert.deepEqual(values('test-worksheet-picker'), ['reading:2b1']);
  assert.match(ui.root.textContent, /Question for reading:2b1/);
  await ui.language('en');
  assert.equal(ui.root.querySelector('#test-level-picker').value, '2b');
  await ui.choose('test-level-picker', 'ma');
  assert.deepEqual(values('test-worksheet-picker'), ['reading:ma1']);
  await ui.choose('test-bank-picker', '2');
  assert.deepEqual(values('test-level-picker'), ['']);
  assert.deepEqual(values('test-worksheet-picker'), ['words:unit-1']);
});

test('bank and worksheet selection fetch only the chosen subject and reuse loaded questions', async () => {
  const ui = await harness();
  await ui.choose('test-worksheet-picker', 'reading:unit-2');
  assert.match(ui.root.textContent, /Question for reading:unit-2/);
  await ui.choose('test-bank-picker', '2');
  assert.equal(ui.root.querySelectorAll('#test-worksheet-picker option').length, 1);
  assert.match(ui.root.textContent, /Question for words:unit-1/);
  await ui.choose('test-bank-picker', '1');
  const requests = ui.calls.filter((c) => c.name === 'get_questions').map((c) => c.params.p_subject);
  assert.deepEqual(requests, ['reading:unit-1', 'reading:unit-2', 'words:unit-1']);
});

test('completed worksheet displays its saved score without downloading questions', async () => {
  const ui = await harness({ catalog: catalog.slice(0, 1), submissions: [{ subject: 'reading:unit-1', score: 1, total: 1 }] });
  assert.equal(ui.calls.filter((c) => c.name === 'get_questions').length, 0);
  assert.match(ui.root.textContent, /该练习已完成/);
  assert.match(ui.root.textContent, /1 \/ 1/);
  assert.equal(ui.root.querySelector('#test-form'), null);
});

test('administrator sees question bank management and can open its component', async () => {
  const ui = await harness({ admin: true });
  const button = [...ui.root.querySelectorAll('button')].find((b) => b.textContent === '题库管理');
  assert.ok(button);
  button.click();
  await flush();
  assert.equal(ui.managerCalls, 1);
  assert.match(ui.root.textContent, /Manager rendered/);
  assert.match(ui.root.textContent, /返回测试/);
});

test('empty catalog retains account controls and does not request questions', async () => {
  const ui = await harness({ catalog: [] });
  assert.match(ui.root.textContent, /暂无题目/);
  assert.match(ui.root.textContent, /退出登录/);
  assert.equal(ui.calls.filter((c) => c.name === 'get_questions').length, 0);
});

test('approval failure shows pending page and never falls back to old RPC', async () => {
  const ui = await harness({ rpc: (name) => name === 'get_test_catalog' ? { error: { code: 'P0001', message: 'PENDING_APPROVAL' } } : undefined });
  assert.match(ui.root.textContent, /账号等待审核/);
  assert.match(ui.root.textContent, /退出登录/);
  assert.equal(ui.calls.filter((c) => c.name === 'get_questions').length, 0);
});

test('only missing catalog RPC triggers legacy fallback and preserves worksheet ordering', async () => {
  const legacy = [question('2a10 - Reading'), question('2a2 - Reading')];
  const ui = await harness({ rpc(name) {
    if (name === 'get_test_catalog') return { error: { code: 'PGRST202', message: 'function not found' } };
    if (name === 'get_questions') return { data: legacy, error: null };
  } });
  assert.deepEqual(ui.calls.filter((c) => c.name === 'get_questions'), [{ name: 'get_questions', params: undefined }]);
  assert.equal(ui.root.querySelector('#test-worksheet-picker option').value, '2a2 - Reading');
  const denied = await harness({ rpc: (name) => name === 'get_test_catalog' ? { error: { code: '42501', message: 'permission denied' } } : undefined });
  assert.match(denied.root.textContent, /加载失败/);
  assert.match(denied.root.textContent, /permission denied/);
  assert.match(denied.root.textContent, /退出登录/);
  assert.equal(denied.calls.filter((c) => c.name === 'get_questions').length, 0);
});

test('language switch changes picker labels and preserves selected radio answer', async () => {
  const ui = await harness();
  const input = ui.root.querySelector('input[type=radio][value="1"]');
  input.checked = true;
  input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
  await ui.language('en');
  assert.match(ui.root.textContent, /Choose a question bank/);
  assert.match(ui.root.textContent, /Reading/);
  assert.doesNotMatch(ui.root.textContent, /选择题库/);
  assert.equal(ui.root.querySelector('input[type=radio][value="1"]').checked, true);
  assert.equal(ui.calls.filter((c) => c.name === 'get_questions').length, 1);
});

test('stale question response cannot replace the currently selected worksheet', async () => {
  let resolveFirst;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const ui = await harness({ rpc(name, params) {
    if (name === 'get_questions' && params.p_subject === 'reading:unit-1') return first;
  } });
  assert.match(ui.root.textContent, /加载题目中/);
  await ui.choose('test-worksheet-picker', 'reading:unit-2');
  assert.match(ui.root.textContent, /Question for reading:unit-2/);
  resolveFirst({ data: [question('reading:unit-1')], error: null });
  await flush();
  assert.match(ui.root.textContent, /Question for reading:unit-2/);
  assert.doesNotMatch(ui.root.textContent, /Question for reading:unit-1/);
});

test('failed worksheet fetch keeps selectors and offers a retry', async () => {
  let attempt = 0;
  const ui = await harness({ rpc(name) {
    if (name === 'get_questions' && ++attempt === 1) return { error: { message: 'temporary outage' } };
  } });
  assert.match(ui.root.textContent, /temporary outage/);
  assert.ok(ui.root.querySelector('#test-bank-picker'));
  [...ui.root.querySelectorAll('button')].find((b) => b.textContent === '重新加载').click();
  await flush();
  assert.match(ui.root.textContent, /Question for reading:unit-1/);
});

test('logout removes questions and account-specific state', async () => {
  const ui = await harness();
  [...ui.root.querySelectorAll('button')].find((b) => b.textContent === '退出登录').click();
  await flush();
  assert.ok(ui.root.querySelector('#auth-form'));
  assert.equal(ui.root.querySelector('#test-form'), null);
  assert.doesNotMatch(ui.root.textContent, /Question for/);
});

test('submission sends selected indices to server and displays only the returned score', async () => {
  const ui = await harness({ catalog: catalog.slice(0, 1) });
  const input = ui.root.querySelector('input[type=radio][value="1"]');
  input.checked = true;
  input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
  ui.root.querySelector('#test-form').dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual(ui.calls.find((call) => call.name === 'submit_test').params, {
    p_name: 'Student', p_email: 'student@example.invalid', p_subject: 'reading:unit-1', p_answers: { 11: 1 },
  });
  assert.match(ui.root.textContent, /该练习已完成/);
  assert.match(ui.root.textContent, /1 \/ 1/);
  assert.equal(ui.root.querySelector('#test-form'), null);
});

test('duplicate submit clicks are coalesced and a server error allows retry', async () => {
  let rejectSubmit;
  const response = new Promise((resolve) => { rejectSubmit = resolve; });
  const ui = await harness({ rpc: (name) => name === 'submit_test' ? response : undefined });
  const form = ui.root.querySelector('#test-form');
  form.querySelector('input[type=radio]').checked = true;
  form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true }));
  form.dispatchEvent(new ui.window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.equal(ui.calls.filter((call) => call.name === 'submit_test').length, 1);
  assert.equal(ui.root.querySelector('#test-bank-picker').disabled, true);
  rejectSubmit({ error: { message: 'temporary failure' } });
  await flush();
  assert.match(ui.root.textContent, /temporary failure/);
  assert.equal(ui.root.querySelector('#test-bank-picker').disabled, false);
  assert.equal(form.querySelector('[type=submit]').disabled, false);
});

test('changing signed-in account clears the previous answer draft and reloads permissions', async () => {
  const ui = await harness();
  const input = ui.root.querySelector('input[type=radio][value="1"]');
  input.checked = true;
  input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
  await ui.changeSession({ user: { id: 'student-2', email: 'second@example.invalid', user_metadata: { full_name: 'Second Student' } } });
  assert.match(ui.root.textContent, /Second Student/);
  assert.equal(ui.calls.filter((call) => call.name === 'get_test_catalog').length, 2);
  assert.equal(ui.root.querySelector('input[type=radio][value="1"]').checked, false);
});
