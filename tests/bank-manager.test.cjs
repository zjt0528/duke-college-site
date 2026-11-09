const test = require('node:test');
const assert = require('node:assert/strict');
const { validateImport, template } = require('../test-bank-manager.js');

function copy() { return JSON.parse(JSON.stringify(template)); }

test('accepts the downloadable template, preserves answer index, does not mutate input', () => {
  const value = copy(); value.worksheets[0].questions[0].prompt = '  A\nB  ';
  const result = validateImport(value);
  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 1);
  assert.equal(result.worksheets[0].questions[0].correct_index, 1);
  assert.equal(result.worksheets[0].questions[0].prompt, 'A\nB');
  assert.equal(value.worksheets[0].questions[0].prompt, '  A\nB  ');
});

test('requires a nonempty worksheets envelope', () => {
  for (const value of [null, [], {}, { worksheets: [] }, { worksheets: 'not an array' }]) {
    assert.equal(validateImport(value).ok, false);
  }
});

test('rejects duplicate and unsafe worksheet codes before import', () => {
  const value = copy(); value.worksheets.push(structuredClone(value.worksheets[0]));
  assert.equal(validateImport(value).ok, false);
  for (const code of ['Unit1', 'bad:code', '-first', 'two words', 'a'.repeat(65), '']) {
    const next = copy(); next.worksheets[0].code = code;
    assert.equal(validateImport(next).ok, false, code);
  }
});

test('requires at least one translated title but allows a single-language title', () => {
  const value = copy(); value.worksheets[0].title_zh = '';
  assert.equal(validateImport(value).ok, true);
  value.worksheets[0].title_en = ' ';
  assert.equal(validateImport(value).ok, false);
});

test('accepts only valid zero-based integer answer indices', () => {
  for (const answer of [-1, 4, 1.5, '1', null, undefined, NaN]) {
    const value = copy(); value.worksheets[0].questions[0].correct_index = answer;
    assert.equal(validateImport(value).ok, false, String(answer));
  }
  const value = copy(); value.worksheets[0].questions[0].correct_index = 0;
  assert.equal(validateImport(value).ok, true);
});

test('rejects malformed questions and non-text, blank or oversized choices', () => {
  for (const question of [null, [], { prompt: '', choices: ['a', 'b'], correct_index: 0 },
    { prompt: 'Q', choices: ['a'], correct_index: 0 },
    { prompt: 'Q', choices: ['a', 2], correct_index: 0 },
    { prompt: 'Q', choices: ['a', ' '], correct_index: 0 },
    { prompt: 'Q', choices: ['a', 'x'.repeat(2001)], correct_index: 0 }]) {
    const value = copy(); value.worksheets[0].questions = [question];
    assert.equal(validateImport(value).ok, false);
  }
});

test('enforces total import limits across worksheets', () => {
  const value = copy();
  value.worksheets = Array.from({ length: 101 }, (_, i) => ({ ...value.worksheets[0], code: 'unit-' + i }));
  assert.equal(validateImport(value).ok, false);
  const next = copy();
  next.worksheets[0].questions = Array.from({ length: 1000 }, () => template.worksheets[0].questions[0]);
  assert.equal(validateImport(next).ok, true);
  next.worksheets.push({ ...template.worksheets[0], code: 'unit-2' });
  assert.equal(validateImport(next).ok, false);
});

test('keeps markup as literal data for the preview to render through textContent', () => {
  const value = copy(); value.worksheets[0].questions[0].prompt = '<img src=x onerror=alert(1)>';
  const result = validateImport(value);
  assert.equal(result.ok, true);
  assert.equal(result.worksheets[0].questions[0].prompt, value.worksheets[0].questions[0].prompt);
});

// linkedom supplies a real parsed DOM; shim only the select.value setter that
// browsers implement but this small DOM library omits.
async function manager(catalog, mutation) {
  const { parseHTML } = require('linkedom');
  const vm = require('node:vm');
  const fs = require('node:fs');
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return Array.from(this.options).find((o) => o.selected)?.value || this.options[0]?.value || ''; },
    set(value) { Array.from(this.options).forEach((o) => { o.selected = o.value === String(value); }); }
  });
  vm.runInNewContext(fs.readFileSync(require.resolve('../test-bank-manager.js'), 'utf8'), { window, document, URL, Blob, setTimeout });
  const calls = [];
  const root = document.getElementById('root');
  await window.TestBankManager.render({
    root, t: (zh, en) => en,
    db: { rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'get_test_catalog') return { data: catalog, error: null };
      return mutation ? mutation(name, args) : { data: 1, error: null };
    } }
  });
  return {
    root, calls, window,
    button: (text) => Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text),
    change: (target) => target.dispatchEvent(new window.Event('change', { bubbles: true })),
    input: (target) => target.dispatchEvent(new window.Event('input', { bubbles: true })),
    flush: async () => { await new Promise(setImmediate); await new Promise(setImmediate); }
  };
}
const draft = [{ bank_id: 1, bank_code: 'reading', bank_name_zh: '阅读', bank_name_en: 'Reading', bank_published: false, subject: null }];

test('admin UI requires validation and explicit review, invalidates preview on edits, and escapes imported text', async () => {
  const ui = await manager(draft);
  const content = copy(); content.worksheets[0].questions[0].prompt = '<img src=x onerror=alert(1)>';
  const area = Array.from(ui.root.querySelectorAll('textarea')).at(-1);
  area.value = JSON.stringify(content);
  const commit = ui.button('Confirm import into this bank');
  assert.equal(commit.disabled, true);
  ui.button('Validate and preview').click();
  const reviewed = ui.root.querySelector('input[type="checkbox"]');
  assert.equal(reviewed.disabled, false);
  assert.equal(commit.disabled, true);
  assert.equal(ui.root.querySelector('img'), null);
  assert.match(ui.root.textContent, /<img src=x onerror=alert\(1\)>/);
  reviewed.checked = true; ui.change(reviewed);
  assert.equal(commit.disabled, false);
  area.value = '{}'; ui.input(area);
  assert.equal(commit.disabled, true);
  assert.equal(reviewed.checked, false);
  assert.equal(ui.calls.filter((c) => c.name === 'admin_import_question_bank').length, 0);
});

test('admin import sends only reviewed normalized worksheets, prevents duplicate requests, and reports success', async () => {
  let finish;
  const ui = await manager(draft, () => new Promise((resolve) => { finish = resolve; }));
  const area = Array.from(ui.root.querySelectorAll('textarea')).at(-1); area.value = JSON.stringify(copy());
  ui.button('Validate and preview').click();
  const reviewed = ui.root.querySelector('input[type="checkbox"]'); reviewed.checked = true; ui.change(reviewed);
  const commit = ui.button('Confirm import into this bank'); commit.click(); commit.click();
  assert.equal(ui.calls.filter((c) => c.name === 'admin_import_question_bank').length, 1);
  const call = ui.calls.find((c) => c.name === 'admin_import_question_bank');
  assert.equal(call.args.p_bank_id, '1');
  assert.equal(call.args.p_worksheets[0].questions[0].correct_index, 1);
  assert.equal(commit.disabled, true);
  finish({ data: 1, error: null }); await ui.flush();
  assert.match(ui.root.textContent, /Imported 1 questions/);
  assert.equal(ui.root.querySelector('input[type="checkbox"]').checked, undefined);
});

test('published banks hide import tools and API failures preserve metadata form values', async () => {
  const published = await manager([{ ...draft[0], bank_published: true }]);
  assert.equal(published.button('Validate and preview'), undefined);
  assert.ok(published.button('Unpublish bank'));
  const ui = await manager(draft, () => ({ data: null, error: { message: 'BANK_CODE_EXISTS' } }));
  const form = ui.root.querySelector('form');
  const fields = form.querySelectorAll('input');
  fields[1].value = '保留修改';
  form.dispatchEvent(new ui.window.Event('submit', { cancelable: true })); await ui.flush();
  assert.equal(fields[1].value, '保留修改');
  assert.match(ui.root.textContent, /This bank code already exists/);
  assert.equal(ui.button('Save bank details').disabled, false);
});
