/*
 * Duke College — online test (Supabase-backed).
 *
 * How it works:
 *   - Questions are loaded from Supabase via the get_questions() RPC, which
 *     returns prompts/choices but NOT the answer key.
 *   - On submit, answers are sent to the submit_test() RPC, which grades them
 *     server-side, stores the submission, and returns only the score.
 *   - Bilingual: reads the site language from localStorage('site-lang') and
 *     re-renders on the 'languageChanged' event dispatched by script.js.
 *
 * SETUP: fill in the two constants below from your Supabase project
 * (Dashboard > Project Settings > API). The anon key is meant to be public.
 * Then run supabase/setup.sql in the Supabase SQL editor.
 */
(function () {
  const SUPABASE_URL = 'https://dwiseofenceqjcqbvhfu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aXNlb2ZlbmNlcWpjcWJ2aGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODAwMTgsImV4cCI6MjA5Nzc1NjAxOH0.n4Xd_eEcctqaJGj7hlObfh4mtBH0_hjrBA8iedW1OyA'; // public "anon" key (safe to expose)

  const root = document.getElementById('test-app');
  if (!root) return;

  // Tiny i18n helper: pick the Chinese or English string for the current language.
  const lang = () => (localStorage.getItem('site-lang') || 'zh');
  const t = (zh, en) => (lang() === 'zh' ? zh : en);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

  // Only create a client once real credentials have been filled in.
  const configured = SUPABASE_URL.indexOf('http') === 0 && SUPABASE_ANON_KEY.indexOf('YOUR_') !== 0;
  const db = (configured && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  let sections = [];      // [{ subject, questions: [...] }], ordered by worksheet code
  let current = null;     // currently selected subject label

  // Sort key from the "2a<N>" code at the start of a subject label (so 2a2 < 2a10).
  function codeNum(subject) {
    const m = String(subject).match(/2a(\d+)/i);
    return m ? parseInt(m[1], 10) : 9999;
  }

  async function load() {
    if (!db) {
      root.innerHTML =
        '<div class="service"><strong>' + t('在线测试尚未配置', 'Online test not configured yet') + '</strong>' +
        '<p>' + t('请在 test.js 中填入 Supabase 项目地址与 anon key，并在 Supabase SQL 编辑器中运行 supabase/setup.sql。',
                  'Add your Supabase URL and anon key in test.js, then run supabase/setup.sql in the Supabase SQL editor.') + '</p></div>';
      return;
    }
    root.innerHTML = '<p class="section-desc">' + t('加载题目中…', 'Loading questions…') + '</p>';
    const { data, error } = await db.rpc('get_questions');
    if (error) {
      root.innerHTML = '<div class="service"><strong>' + t('加载失败', 'Failed to load') + '</strong><p>' + esc(error.message) + '</p></div>';
      return;
    }

    // Group questions into worksheets by their subject label.
    const bySubject = {};
    (data || []).forEach((q) => { (bySubject[q.subject] = bySubject[q.subject] || []).push(q); });
    sections = Object.keys(bySubject)
      .sort((a, b) => codeNum(a) - codeNum(b))
      .map((s) => ({ subject: s, questions: bySubject[s] }));

    if (!sections.length) {
      root.innerHTML = '<p class="section-desc">' + t('暂无题目', 'No questions available yet.') + '</p>';
      return;
    }
    if (!current || !bySubject[current]) current = sections[0].subject;
    render();
  }

  function render() {
    const section = sections.find((s) => s.subject === current) || sections[0];
    root.innerHTML = '';

    // Worksheet picker
    const picker = el('<div class="service" style="margin-bottom:18px;"><label>' + t('选择练习', 'Choose a worksheet') + '</label></div>');
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); margin-top:6px; font:inherit;';
    sections.forEach((sec) => {
      const o = document.createElement('option');
      o.value = sec.subject;
      o.textContent = sec.subject + '  (' + sec.questions.length + ')';
      if (sec.subject === current) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { current = sel.value; render(); });
    picker.appendChild(sel);
    root.appendChild(picker);

    const form = el('<form id="test-form"></form>');

    // Student details
    form.appendChild(el(
      '<div class="service" style="margin-bottom:18px;">' +
        '<label>' + t('姓名', 'Name') + '</label>' +
        '<input type="text" name="name" required />' +
        '<label>' + t('邮箱', 'Email') + '</label>' +
        '<input type="email" name="email" required />' +
      '</div>'
    ));

    // Questions for the selected worksheet
    section.questions.forEach((q, i) => {
      const choices = (q.choices || []).map((c, idx) =>
        '<label style="display:flex; gap:8px; align-items:flex-start; font-weight:500; margin-top:8px;">' +
          '<input type="radio" name="q_' + q.id + '" value="' + idx + '" required style="width:auto; margin:4px 0 0;" /> ' +
          '<span>' + esc(c) + '</span>' +
        '</label>'
      ).join('');
      form.appendChild(el(
        '<div class="service" style="margin-bottom:14px;">' +
          '<strong>' + (i + 1) + '. ' + esc(q.prompt) + '</strong>' +
          '<div style="margin-top:6px;">' + choices + '</div>' +
        '</div>'
      ));
    });

    form.appendChild(el(
      '<div style="margin-top:14px;">' +
        '<button class="btn primary" type="submit">' + t('提交测试', 'Submit Test') + '</button>' +
        '<p id="test-status" role="status" aria-live="polite" style="margin-top:12px; font-weight:700;"></p>' +
      '</div>'
    ));

    form.addEventListener('submit', onSubmit);
    root.appendChild(form);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const status = form.querySelector('#test-status');
    const btn = form.querySelector('[type="submit"]');
    const fd = new FormData(form);
    const section = sections.find((s) => s.subject === current);

    // Collect { questionId: selectedIndex } for the selected worksheet only.
    const answers = {};
    section.questions.forEach((q) => {
      const v = fd.get('q_' + q.id);
      if (v !== null) answers[q.id] = parseInt(v, 10);
    });

    btn.disabled = true;
    status.style.color = '#6b7280';
    status.textContent = t('提交中…', 'Submitting…');

    try {
      const { data, error } = await db.rpc('submit_test', {
        p_name: fd.get('name'),
        p_email: fd.get('email'),
        p_subject: current,   // grade only this worksheet on the server
        p_answers: answers
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      status.style.color = '#28a745';
      status.textContent = t('提交成功！得分：', 'Submitted! Your score: ') + row.score + ' / ' + row.total;
    } catch (err) {
      status.style.color = '#d33';
      status.textContent = t('提交失败：', 'Submission failed: ') + (err.message || '');
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', load);
  // Re-render in the new language if the visitor toggles EN/中文.
  window.addEventListener('languageChanged', () => { if (sections.length) render(); });
})();
