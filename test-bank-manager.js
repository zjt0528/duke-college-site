/* Admin-only question-bank tools. All writes are authorized again by Supabase RPCs. */
(function (global) {
  'use strict';

  const codePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const template = {
    worksheets: [{
      code: 'unit-1', title_zh: '阅读练习一', title_en: 'Reading practice 1', grade: 'G3',
      questions: [{
        prompt: 'Which word is a noun?',
        choices: ['quickly', 'happiness', 'blue', 'quietly'], correct_index: 1
      }]
    }]
  };

  // This validator is also exported for local tests. The database independently
  // enforces the same limits, including authorization and duplicate prevention.
  function validateImport(value) {
    const failures = [];
    function issue(path, zh, en) { failures.push({ path: path, zh: zh, en: en }); }
    function text(value, limit, path, required) {
      if (value === undefined || value === null) {
        if (required) issue(path, '必须填写文字。', 'Text is required.');
        return '';
      }
      if (typeof value !== 'string') {
        issue(path, '必须是文字。', 'Must be a string.');
        return '';
      }
      const clean = value.trim();
      if (required && !clean) issue(path, '不能留空。', 'Must not be blank.');
      if (clean.length > limit) issue(path, '文字过长，最多 ' + limit + ' 个字符。', 'Must contain at most ' + limit + ' characters.');
      return clean;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.worksheets)) {
      return { ok: false, errors: [{ path: 'worksheets', zh: '需要包含 worksheets 数组的 JSON 对象。', en: 'Expected a JSON object containing a worksheets array.' }] };
    }
    if (!value.worksheets.length || value.worksheets.length > 100) {
      issue('worksheets', '每次需要导入 1–100 个练习。', 'Import 1–100 worksheets at a time.');
    }
    let count = 0;
    const seen = new Set();
    const worksheets = value.worksheets.slice(0, 100).map(function (ws, wi) {
      const path = 'worksheets[' + wi + ']';
      if (!ws || typeof ws !== 'object' || Array.isArray(ws)) {
        issue(path, '练习必须是对象。', 'Each worksheet must be an object.');
        return null;
      }
      const code = text(ws.code, 64, path + '.code', true);
      if (!codePattern.test(code)) issue(path + '.code', '编号只能使用小写字母、数字和连字符，首位为字母或数字。', 'Use lowercase letters, numbers and hyphens; start with a letter or number.');
      if (seen.has(code)) issue(path + '.code', '本次导入的练习编号重复。', 'Duplicate worksheet code in this import.');
      seen.add(code);
      const zh = text(ws.title_zh, 160, path + '.title_zh');
      const en = text(ws.title_en, 160, path + '.title_en');
      if (!zh && !en) issue(path, '至少填写一个中英文练习名称。', 'Provide at least one Chinese or English worksheet title.');
      const grade = text(ws.grade, 32, path + '.grade');
      if (!Array.isArray(ws.questions) || !ws.questions.length) {
        issue(path + '.questions', '每个练习至少需要一道选择题。', 'Each worksheet needs at least one multiple-choice question.');
        return null;
      }
      count += ws.questions.length;
      const questions = ws.questions.slice(0, 1000).map(function (q, qi) {
        const qp = path + '.questions[' + qi + ']';
        if (!q || typeof q !== 'object' || Array.isArray(q)) {
          issue(qp, '题目必须是对象。', 'Each question must be an object.');
          return null;
        }
        const prompt = text(q.prompt, 20000, qp + '.prompt', true);
        if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 10) {
          issue(qp + '.choices', '每道题需要 2–10 个文字选项。', 'Each question needs 2–10 text choices.');
          return null;
        }
        const choices = q.choices.map(function (choice, ci) { return text(choice, 2000, qp + '.choices[' + ci + ']', true); });
        if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= choices.length) {
          issue(qp + '.correct_index', '正确答案需要填写从 0 开始的有效选项序号。', 'The answer must be an integer choice index starting at 0.');
        }
        return { prompt: prompt, choices: choices, correct_index: q.correct_index };
      });
      return { code: code, title_zh: zh, title_en: en, grade: grade, questions: questions };
    });
    if (count > 1000) issue('worksheets', '每次最多导入 1000 道题。', 'Import at most 1000 questions at a time.');
    return { ok: failures.length === 0, errors: failures, worksheets: worksheets, questionCount: count };
  }

  async function render(options) {
    const root = options.root;
    const db = options.db;
    const t = options.t;
    let banks = [];
    let selected = '';
    let busy = false;
    let preview = null;
    let viewVersion = 0;
    let message = '';
    let messageError = false;

    function node(tag, content, cls) {
      const n = document.createElement(tag);
      if (content !== undefined) n.textContent = content;
      if (cls) n.className = cls;
      return n;
    }
    function button(label, run, primary) {
      const n = node('button', label, 'btn ' + (primary ? 'primary' : 'secondary'));
      n.type = 'button';
      n.addEventListener('click', run);
      return n;
    }
    function card() { const n = node('div', undefined, 'service'); n.style.marginBottom = '18px'; return n; }
    function hint(content) { return node('p', content, 'section-desc'); }
    function label(control, title) {
      const wrap = node('label');
      wrap.appendChild(node('span', title));
      wrap.appendChild(control);
      return wrap;
    }
    function input(value, maxLength, required) {
      const n = node('input'); n.type = 'text'; n.value = value || ''; n.maxLength = maxLength;
      n.required = !!required;
      return n;
    }
    function errorText(err) {
      const text = (err && err.message) || String(err || '');
      const errors = {
        NOT_ADMIN: t('只有管理员可以管理题库。', 'Only administrators can manage question banks.'),
        AUTH_REQUIRED: t('登录已过期，请重新登录。', 'Your session has expired. Please log in again.'),
        BANK_CODE_EXISTS: t('题库编号已存在，请重新选择“新建题库”后保存。', 'This bank code already exists. Select Create a bank again, then save.'),
        BANK_CODE_IMMUTABLE: t('已创建的题库编号不能修改。', 'An existing bank code cannot be changed.'),
        BANK_PUBLISHED: t('请先将题库下架，再导入新练习。', 'Unpublish the bank before importing new worksheets.'),
        WORKSHEET_EXISTS: t('练习编号已存在。本次导入没有写入，请更换新练习编号。', 'A worksheet code already exists. Nothing was imported; use new worksheet codes.'),
        EMPTY_BANK: t('题库没有题目，导入题目后才能发布。', 'Import questions before publishing this empty bank.'),
        INVALID_QUESTIONS: t('题目数据不完整或答案无效，请核对后再发布。', 'Some question data or answers are invalid. Review them before publishing.'),
        BANK_NOT_FOUND: t('题库不存在，请重新加载。', 'This bank no longer exists. Reload the list.')
      };
      for (const key of Object.keys(errors)) if (text.indexOf(key) !== -1) return errors[key];
      if (text.indexOf('get_test_catalog') !== -1 || (err && err.code === 'PGRST202')) {
        return t('请先在 Supabase 执行 migration_question_banks.sql，再重新加载。', 'Run migration_question_banks.sql in Supabase, then reload this page.');
      }
      return text;
    }
    function status(content, isError) {
      message = content; messageError = !!isError;
      const n = root.querySelector('[data-bank-status]');
      if (n) { n.textContent = content; n.style.color = isError ? '#b91c1c' : '#166534'; }
    }
    async function rpc(name, args) {
      const response = await db.rpc(name, args);
      if (response.error) throw response.error;
      return response.data;
    }
    async function readCatalog() {
      const rows = await rpc('get_test_catalog');
      const grouped = new Map();
      (rows || []).forEach(function (row) {
        const id = String(row.bank_id);
        if (!grouped.has(id)) grouped.set(id, { id: id, code: row.bank_code,
          name_zh: row.bank_code === 'legacy' && ['原有题库', '现有题库'].includes(row.bank_name_zh) ? 'book reading vocabulary' : row.bank_name_zh,
          name_en: row.bank_code === 'legacy' && ['Existing question bank', 'Existing worksheets'].includes(row.bank_name_en) ? 'book reading vocabulary' : row.bank_name_en,
          description_zh: row.bank_description_zh, description_en: row.bank_description_en, published: row.bank_published, worksheets: [] });
        if (row.subject) grouped.get(id).worksheets.push(row);
      });
      banks = Array.from(grouped.values());
    }
    function bankName(bank) { return t(bank.name_zh || bank.name_en, bank.name_en || bank.name_zh); }
    function rowName(row) { return t(row.title_zh || row.title_en || row.subject, row.title_en || row.title_zh || row.subject); }
    async function action(run) {
      if (busy) return;
      busy = true;
      const controls = Array.from(root.querySelectorAll('button,input,textarea,select'));
      const previous = controls.map(function (n) { return n.disabled; });
      controls.forEach(function (n) { n.disabled = true; });
      status(t('处理中…', 'Please wait…'));
      try { await run(); }
      catch (err) { status(errorText(err), true); }
      finally { busy = false; controls.forEach(function (n, i) { n.disabled = previous[i]; }); }
    }
    function draw() {
      viewVersion += 1;
      preview = null;
      root.replaceChildren();
      root.appendChild(node('h3', t('题库管理', 'Question bank management')));
      root.appendChild(hint(t('新增题库先保存为草稿。导入并核对题目后发布，学生才能看到有权限的练习。', 'New banks start as drafts. Import and review questions, then publish to make permitted worksheets available to students.')));
      const statusNode = node('p', message);
      statusNode.dataset.bankStatus = 'true'; statusNode.setAttribute('role', 'status'); statusNode.setAttribute('aria-live', 'polite');
      statusNode.style.color = messageError ? '#b91c1c' : '#166534';
      root.appendChild(statusNode);
      const toolbar = card();
      const choose = node('select');
      choose.style.cssText = 'width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font:inherit;margin:6px 0 12px;';
      const createOption = node('option', t('＋ 新建题库', '+ Create a bank')); createOption.value = ''; choose.appendChild(createOption);
      banks.forEach(function (bank) {
        const option = node('option', bankName(bank) + ' · ' + (bank.published ? t('已发布', 'Published') : t('草稿', 'Draft')));
        option.value = bank.id; option.selected = selected === bank.id; choose.appendChild(option);
      });
      choose.value = selected;
      choose.addEventListener('change', function () { if (busy) return; selected = choose.value; message = ''; draw(); });
      toolbar.appendChild(label(choose, t('选择题库', 'Choose a bank')));
      toolbar.appendChild(button(t('重新加载', 'Reload'), function () { action(async function () { await readCatalog(); draw(); status(t('已重新加载。', 'Reloaded.')); }); }));
      root.appendChild(toolbar);
      const bank = banks.find(function (b) { return b.id === selected; });
      const metadata = card();
      const form = node('form');
      const code = bank ? bank.code : 'bank-' + (global.crypto || globalThis.crypto).randomUUID();
      const zh = input(bank && bank.name_zh, 160); const en = input(bank && bank.name_en, 160);
      form.appendChild(label(zh, t('中文名称', 'Chinese name'))); form.appendChild(label(en, t('英文名称', 'English name')));
      const dz = node('textarea'); dz.value = (bank && bank.description_zh) || ''; dz.rows = 2; dz.maxLength = 4000;
      const de = node('textarea'); de.value = (bank && bank.description_en) || ''; de.rows = 2; de.maxLength = 4000;
      form.appendChild(label(dz, t('中文简介', 'Chinese description'))); form.appendChild(label(de, t('英文简介', 'English description')));
      const save = node('button', t('保存题库资料', 'Save bank details'), 'btn primary'); save.type = 'submit'; save.style.marginTop = '12px';
      form.appendChild(save);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!zh.value.trim() && !en.value.trim()) { status(t('请至少填写一个中文或英文名称。', 'Provide at least one Chinese or English name.'), true); return; }
        action(async function () {
          const id = await rpc('admin_save_question_bank', { p_id: bank ? bank.id : null, p_code: code, p_name_zh: zh.value.trim(), p_name_en: en.value.trim(), p_description_zh: dz.value.trim(), p_description_en: de.value.trim() });
          selected = String(id); await readCatalog(); draw(); status(t('题库资料已保存。', 'Bank details saved.'));
          if (options.onSaved) options.onSaved();
        });
      });
      metadata.appendChild(form); root.appendChild(metadata);
      if (!bank) return;
      const inventory = card();
      const total = bank.worksheets.reduce(function (n, row) { return n + Number(row.question_count || 0); }, 0);
      inventory.appendChild(node('h4', bank.worksheets.length + t(' 个练习 · ', ' worksheets · ') + total + t(' 道题', ' questions')));
      const list = node('ul');
      bank.worksheets.forEach(function (row) { list.appendChild(node('li', rowName(row) + (row.grade ? ' · ' + row.grade : '') + ' · ' + row.question_count + t(' 道题', ' questions'))); });
      inventory.appendChild(list);
      inventory.appendChild(hint(t('现有题目和成绩会保留。导入仅新增练习，重复编号会被拒绝；已作答的题目不能通过导入覆盖。', 'Existing questions and results are preserved. Imports only add new worksheets; duplicate codes are rejected, and answered questions cannot be overwritten through import.')));
      const publish = button(bank.published ? t('下架题库', 'Unpublish bank') : t('发布题库', 'Publish bank'), function () {
        action(async function () {
          await rpc('admin_set_question_bank_published', { p_bank_id: bank.id, p_published: !bank.published });
          await readCatalog(); draw(); status(bank.published ? t('题库已下架。', 'Bank unpublished.') : t('题库已发布。', 'Bank published.'));
          if (options.onSaved) options.onSaved();
        });
      }, !bank.published);
      inventory.appendChild(publish); root.appendChild(inventory);
      if (bank.published) {
        root.appendChild(hint(t('该题库已发布。需要增加新练习时，请先下架；学生已有成绩仍会保留。', 'This bank is published. Unpublish before adding worksheets; existing student results are retained.')));
        return;
      }
      drawImport(bank);
    }

    function drawImport(bank) {
      const pane = card();
      pane.appendChild(node('h4', t('导入选择题', 'Import multiple-choice questions')));
      pane.appendChild(hint(t('PDF 需要先整理为题目、选项和正确答案，并核对原文，再按模板保存为 JSON。这里不会自动识别 PDF。正确答案序号从 0 开始（A=0、B=1）。', 'Convert the PDF into reviewed questions, choices and answers, then save JSON using the template. This form does not extract PDFs. Answer indices start at 0 (A=0, B=1).')));
      const download = button(t('下载 JSON 模板', 'Download JSON template'), function () {
        const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
        const a = node('a'); a.href = url; a.download = 'question-bank-template.json'; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      pane.appendChild(download);
      const file = node('input'); file.type = 'file'; file.accept = '.json,application/json';
      pane.appendChild(label(file, t('选择 JSON 文件', 'Choose a JSON file')));
      const area = node('textarea'); area.rows = 12; area.spellcheck = false;
      area.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;';
      area.placeholder = JSON.stringify(template, null, 2);
      pane.appendChild(label(area, t('或粘贴 JSON 内容', 'Or paste JSON')));
      const previewPane = node('div');
      const confirmLabel = node('label'); confirmLabel.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:16px 0;';
      const reviewed = node('input'); reviewed.type = 'checkbox'; reviewed.disabled = true; reviewed.style.cssText = 'width:auto;margin:4px 0 0;';
      confirmLabel.appendChild(reviewed); confirmLabel.appendChild(node('span', t('我已对照原 PDF 核对题目和正确答案。', 'I have checked the questions and answer key against the original PDF.')));
      const commit = button(t('确认导入此题库', 'Confirm import into this bank'), function () {
        if (!preview || !reviewed.checked || preview.bankId !== bank.id || preview.source !== area.value || selected !== bank.id) return;
        const captured = preview;
        action(async function () {
          const inserted = await rpc('admin_import_question_bank', { p_bank_id: bank.id, p_worksheets: captured.worksheets });
          await readCatalog(); draw(); status(t('导入成功，共新增 ', 'Imported ') + inserted + t(' 道题。核对无误后可发布题库。', ' questions. Publish the bank when ready.'));
          if (options.onSaved) options.onSaved();
        });
      }, true);
      commit.disabled = true;
      function invalidate() { preview = null; reviewed.checked = false; reviewed.disabled = true; commit.disabled = true; previewPane.replaceChildren(); }
      area.addEventListener('input', invalidate);
      file.addEventListener('change', async function () {
        invalidate();
        const version = viewVersion; const chosen = file.files && file.files[0];
        if (!chosen) return;
        if (chosen.size > 5 * 1024 * 1024) { status(t('文件过大，最多 5 MB。', 'The file must be at most 5 MB.'), true); return; }
        try {
          const content = await chosen.text();
          if (version !== viewVersion || busy || file.files[0] !== chosen) return;
          area.value = content;
          status(t('文件已读取，请点击“校验并预览”。', 'File read. Select Validate and preview.'));
        } catch (err) { status(errorText(err), true); }
      });
      const check = button(t('校验并预览', 'Validate and preview'), function () {
        invalidate();
        let parsed;
        try { parsed = JSON.parse(area.value); }
        catch (_) { status(t('JSON 格式不正确，请检查逗号、引号和括号。', 'Invalid JSON. Check commas, quotation marks and brackets.'), true); return; }
        const result = validateImport(parsed);
        const duplicates = result.ok ? result.worksheets.filter(function (ws) { return bank.worksheets.some(function (row) { return row.subject === bank.code + ':' + ws.code; }); }) : [];
        if (!result.ok || duplicates.length) {
          const errors = result.errors.slice(0, 20).map(function (err) { return err.path + ': ' + t(err.zh, err.en); });
          if (duplicates.length) errors.push(t('练习编号已存在：', 'Existing worksheet codes: ') + duplicates.map(function (ws) { return ws.code; }).join(', '));
          previewPane.appendChild(node('pre', errors.join('\n'))); previewPane.firstChild.style.cssText = 'white-space:pre-wrap;color:#b91c1c;overflow-wrap:anywhere;';
          status(t('校验未通过，没有导入任何题目。', 'Validation failed. No questions were imported.'), true); return;
        }
        preview = { bankId: bank.id, source: area.value, worksheets: result.worksheets };
        previewPane.appendChild(node('h4', result.worksheets.length + t(' 个练习 / ', ' worksheets / ') + result.questionCount + t(' 道题 · 管理员答案预览', ' questions · Admin answer preview')));
        result.worksheets.forEach(function (ws) {
          const details = node('details'); const summary = node('summary', t(ws.title_zh || ws.title_en, ws.title_en || ws.title_zh) + ' · ' + ws.code + ' · ' + ws.questions.length + t(' 道题', ' questions'));
          summary.style.cursor = 'pointer'; details.appendChild(summary);
          ws.questions.forEach(function (q, i) {
            const question = node('div'); question.style.cssText = 'margin:12px 0;padding:12px;border:1px solid var(--border);border-radius:8px;';
            const prompt = node('p', (i + 1) + '. ' + q.prompt); prompt.style.whiteSpace = 'pre-wrap'; question.appendChild(prompt);
            const choices = node('ol'); choices.type = 'A';
            q.choices.forEach(function (choice, ci) {
              const line = node('li', choice + (ci === q.correct_index ? t(' ✓ 正确答案', ' ✓ Correct answer') : ''));
              if (ci === q.correct_index) { line.style.color = '#166534'; line.style.fontWeight = '700'; }
              choices.appendChild(line);
            });
            question.appendChild(choices); details.appendChild(question);
          });
          previewPane.appendChild(details);
        });
        reviewed.disabled = false;
        status(t('校验通过。请展开核对题目和答案，勾选确认后再导入。', 'Validation passed. Review the questions and answers, then tick the confirmation to import.'));
      });
      reviewed.addEventListener('change', function () { commit.disabled = !preview || !reviewed.checked; });
      check.style.margin = '12px 0'; pane.appendChild(check); pane.appendChild(previewPane); pane.appendChild(confirmLabel); pane.appendChild(commit); root.appendChild(pane);
    }
    root.replaceChildren(hint(t('加载题库中…', 'Loading question banks…')));
    try { await readCatalog(); selected = banks.length ? banks[0].id : ''; draw(); }
    catch (err) {
      root.replaceChildren(node('h3', t('题库管理', 'Question bank management')), hint(errorText(err)));
      root.appendChild(button(t('重试', 'Retry'), function () { render(options); }));
    }
  }

  const api = { render: render, validateImport: validateImport, template: template };
  global.TestBankManager = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
