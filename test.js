/*
 * Duke College — online test (Supabase-backed), with login.
 *
 * How it works:
 *   - Visitors must log in (Supabase Auth, email + password) before the test
 *     is shown. The logged-in account's email is attached to each submission.
 *   - Questions are loaded via the get_questions() RPC, which returns
 *     prompts/choices but NOT the answer key.
 *   - On submit, answers go to the submit_test() RPC, which grades them
 *     server-side, stores the submission, and returns only the score.
 *   - Bilingual: reads the site language from localStorage('site-lang') and
 *     re-renders on the 'languageChanged' event dispatched by script.js.
 *
 * SETUP:
 *   1. Fill in the two constants below (Dashboard > Project Settings > API).
 *   2. Run supabase/setup.sql, then supabase/questions_lg_r_rs_2a.sql.
 *   3. Enable Email auth: Dashboard > Authentication > Providers > Email.
 *      For instant login, turn OFF "Confirm email" (Authentication > Providers
 *      > Email). If you keep confirmation on, set the Site URL to your domain
 *      under Authentication > URL Configuration.
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

  let session = null;     // Supabase auth session (null when logged out)
  let loggedIn = null;    // last gate state, to avoid redundant re-renders
  let authMode = 'signin';
  let recovering = false; // true while the user is setting a new password
  let isAdmin = false;    // caller is in the admins table (checked server-side too)
  let view = 'test';      // 'test' | 'admin'
  let sections = [];      // [{ subject, questions: [...] }], ordered by worksheet code
  let current = null;     // currently selected subject label

  function displayName() {
    const u = session && session.user;
    if (!u) return '';
    return (u.user_metadata && u.user_metadata.full_name) || u.email;
  }

  // ---- Entry point / routing -----------------------------------------------
  async function boot() {
    if (!db) {
      root.innerHTML =
        '<div class="service"><strong>' + t('在线测试尚未配置', 'Online test not configured yet') + '</strong>' +
        '<p>' + t('请在 test.js 中填入 Supabase 项目地址与 anon key，并在 Supabase SQL 编辑器中运行 supabase/setup.sql。',
                  'Add your Supabase URL and anon key in test.js, then run supabase/setup.sql in the Supabase SQL editor.') + '</p></div>';
      return;
    }
    const { data } = await db.auth.getSession();
    session = data.session;
    // React to sign in / sign out (also fires once on load).
    db.auth.onAuthStateChange((event, s) => {
      session = s;
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived from a reset-password email: show the set-new-password
        // form (the email link may land on any route, so force the test page).
        recovering = true;
        if (!location.hash.startsWith('#/test')) location.hash = '#/test';
        renderRecovery();
        return;
      }
      const nowIn = !!s;
      if (nowIn === loggedIn && !recovering) return;   // gate state unchanged — don't reload
      route();
    });
    route();
  }

  async function route() {
    loggedIn = !!session;
    if (recovering) { renderRecovery(); return; }
    if (!session) { isAdmin = false; view = 'test'; renderAuth(); return; }
    // Admin flag drives the panel button; the RPCs re-check it server-side.
    // try/catch keeps the page working before migration_admin_access.sql runs.
    try {
      const { data } = await db.rpc('is_admin');
      isAdmin = data === true;
    } catch (_) { isAdmin = false; }
    if (view === 'admin' && isAdmin) loadAdmin();
    else { view = 'test'; loadQuestions(); }
  }

  // ---- Login / sign-up -----------------------------------------------------
  function renderAuth() {
    root.innerHTML = '';
    const card = el('<div class="service" style="max-width:460px; margin:0 auto;"></div>');
    card.appendChild(el('<h3 style="margin-top:0;">' +
      (authMode === 'signin' ? t('登录以开始测试', 'Log in to take the test') : t('注册新账号', 'Create an account')) +
      '</h3>'));

    const form = el('<form id="auth-form"></form>');
    if (authMode === 'signup') {
      form.appendChild(el('<label>' + t('姓名', 'Name') + '</label>'));
      form.appendChild(el('<input type="text" name="name" required />'));
    }
    form.appendChild(el('<label>' + t('邮箱', 'Email') + '</label>'));
    form.appendChild(el('<input type="email" name="email" required />'));
    form.appendChild(el('<label>' + t('密码', 'Password') + '</label>'));
    form.appendChild(el('<input type="password" name="password" required minlength="6" autocomplete="current-password" />'));
    form.appendChild(el('<div style="margin-top:14px;"><button class="btn primary" type="submit">' +
      (authMode === 'signin' ? t('登录', 'Log in') : t('注册', 'Sign up')) + '</button></div>'));
    form.appendChild(el('<p id="auth-status" role="status" aria-live="polite" style="margin-top:12px; font-weight:700;"></p>'));
    form.addEventListener('submit', onAuth);
    card.appendChild(form);

    const toggle = el('<p style="margin-top:14px;"></p>');
    toggle.innerHTML = authMode === 'signin'
      ? t('还没有账号？', 'No account yet? ') + '<a href="#" id="auth-toggle">' + t('注册', 'Sign up') + '</a>'
      : t('已有账号？', 'Already have an account? ') + '<a href="#" id="auth-toggle">' + t('登录', 'Log in') + '</a>';
    toggle.querySelector('#auth-toggle').addEventListener('click', (e) => {
      e.preventDefault();
      authMode = authMode === 'signin' ? 'signup' : 'signin';
      renderAuth();
    });
    card.appendChild(toggle);

    if (authMode === 'signin') {
      const forgot = el('<p style="margin-top:6px;"><a href="#" id="auth-forgot">' + t('忘记密码？', 'Forgot password?') + '</a></p>');
      forgot.querySelector('#auth-forgot').addEventListener('click', (e) => { e.preventDefault(); sendReset(card); });
      card.appendChild(forgot);
    }
    root.appendChild(card);
  }

  // Send a password-reset email for the address typed in the login form.
  async function sendReset(card) {
    const email = card.querySelector('input[name=email]').value.trim();
    const status = card.querySelector('#auth-status');
    if (!email) {
      status.style.color = '#d33';
      status.textContent = t('请先在上方填写邮箱，再点击“忘记密码”。', 'Enter your email above first, then click "Forgot password".');
      return;
    }
    status.style.color = '#6b7280';
    status.textContent = t('发送中…', 'Sending…');
    // The email link brings the user back to the test page to set a new password.
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname + '#/test'
    });
    if (error) {
      status.style.color = '#d33';
      status.textContent = t('发送失败：', 'Could not send: ') + (error.message || '');
    } else {
      status.style.color = '#28a745';
      status.textContent = t('重置邮件已发送，请查收邮箱并点击链接设置新密码。', 'Reset email sent — open the link in it to set a new password.');
    }
  }

  // Shown after the user clicks the reset link in their email.
  function renderRecovery() {
    root.innerHTML = '';
    const card = el('<div class="service" style="max-width:460px; margin:0 auto;"></div>');
    card.appendChild(el('<h3 style="margin-top:0;">' + t('设置新密码', 'Set a new password') + '</h3>'));
    const form = el('<form id="recovery-form"></form>');
    form.appendChild(el('<label>' + t('新密码', 'New password') + '</label>'));
    form.appendChild(el('<input type="password" name="password" required minlength="6" autocomplete="new-password" />'));
    form.appendChild(el('<div style="margin-top:14px;"><button class="btn primary" type="submit">' + t('保存并进入测试', 'Save and continue') + '</button></div>'));
    form.appendChild(el('<p id="recovery-status" role="status" aria-live="polite" style="margin-top:12px; font-weight:700;"></p>'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('#recovery-status');
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      status.style.color = '#6b7280';
      status.textContent = t('保存中…', 'Saving…');
      const { error } = await db.auth.updateUser({ password: new FormData(form).get('password') });
      if (error) {
        status.style.color = '#d33';
        status.textContent = t('保存失败：', 'Could not save: ') + (error.message || '');
        btn.disabled = false;
        return;
      }
      recovering = false;
      route();   // password saved; session is live → straight into the test
    });
    card.appendChild(form);
    root.appendChild(card);
  }

  async function onAuth(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const status = form.querySelector('#auth-status');
    const btn = form.querySelector('[type="submit"]');
    const fd = new FormData(form);
    const email = fd.get('email');
    const password = fd.get('password');

    btn.disabled = true;
    status.style.color = '#6b7280';
    status.textContent = t('处理中…', 'Please wait…');

    try {
      if (authMode === 'signup') {
        const { data, error } = await db.auth.signUp({
          email, password, options: {
            data: { full_name: fd.get('name') },
            // Confirmation email links back to the test page, where the fresh
            // session is picked up and the student lands straight in the test.
            emailRedirectTo: location.origin + location.pathname + '#/test'
          }
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is enabled — no session yet.
          status.style.color = '#28a745';
          status.textContent = t('注册成功！请查收邮箱完成验证后再登录。',
                                  'Account created! Check your email to confirm, then log in.');
          btn.disabled = false;
          return;
        }
        // Otherwise a session was returned → onAuthStateChange routes us in.
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange routes us into the test.
      }
    } catch (err) {
      status.style.color = '#d33';
      status.textContent = t('操作失败：', 'Error: ') + (err.message || '');
      btn.disabled = false;
    }
  }

  // ---- Test ----------------------------------------------------------------
  // Sort key from the "2a<N>" code at the start of a subject label (so 2a2 < 2a10).
  function codeNum(subject) {
    const m = String(subject).match(/2a(\d+)/i);
    return m ? parseInt(m[1], 10) : 9999;
  }

  // Shared "Signed in as …" bar. opts: { admin: true } adds the Admin button,
  // { back: true } adds a Back-to-test button (used inside the admin panel).
  function signedInBar(opts) {
    opts = opts || {};
    const bar = el('<div class="service" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:18px;"></div>');
    bar.appendChild(el('<span>' + t('已登录：', 'Signed in: ') + '<strong>' + esc(displayName()) + '</strong></span>'));
    const btns = el('<span style="display:flex; gap:8px; flex-wrap:wrap;"></span>');
    if (opts.back) {
      const back = el('<button class="btn secondary" type="button" style="padding:8px 14px;">' + t('返回测试', 'Back to test') + '</button>');
      back.addEventListener('click', () => { view = 'test'; loadQuestions(); });
      btns.appendChild(back);
    }
    if (opts.admin && isAdmin) {
      const adm = el('<button class="btn secondary" type="button" style="padding:8px 14px;">' + t('管理', 'Admin') + '</button>');
      adm.addEventListener('click', () => { view = 'admin'; loadAdmin(); });
      btns.appendChild(adm);
    }
    const out = el('<button class="btn secondary" type="button" style="padding:8px 14px;">' + t('退出登录', 'Log out') + '</button>');
    out.addEventListener('click', async () => { await db.auth.signOut(); });   // onAuthStateChange → renderAuth
    btns.appendChild(out);
    bar.appendChild(btns);
    return bar;
  }

  // Shown to logged-in users an admin hasn't approved yet.
  function renderPending() {
    root.innerHTML = '';
    root.appendChild(signedInBar());
    root.appendChild(el(
      '<div class="service"><strong>' + t('账号等待审核', 'Account awaiting approval') + '</strong>' +
      '<p>' + t('您的账号已创建，正在等待管理员审核开通测试权限。请稍后再试，或联系我们。',
                'Your account has been created and is waiting for an administrator to grant test access. Please check back later or contact us.') + '</p></div>'
    ));
  }

  async function loadQuestions() {
    root.innerHTML = '<p class="section-desc">' + t('加载题目中…', 'Loading questions…') + '</p>';
    const { data, error } = await db.rpc('get_questions');
    if (error) {
      if ((error.message || '').indexOf('PENDING_APPROVAL') !== -1) { renderPending(); return; }
      root.innerHTML = '<div class="service"><strong>' + t('加载失败', 'Failed to load') + '</strong><p>' + esc(error.message) + '</p></div>';
      return;
    }
    const bySubject = {};
    (data || []).forEach((q) => { (bySubject[q.subject] = bySubject[q.subject] || []).push(q); });
    sections = Object.keys(bySubject)
      .sort((a, b) => codeNum(a) - codeNum(b))
      .map((s) => ({ subject: s, questions: bySubject[s] }));

    if (!sections.length) {
      renderTest(true);
      return;
    }
    if (!current || !bySubject[current]) current = sections[0].subject;
    renderTest();
  }

  function renderTest(empty) {
    root.innerHTML = '';

    // Signed-in bar with admin entry (if admin) and log out
    root.appendChild(signedInBar({ admin: true }));

    if (empty || !sections.length) {
      root.appendChild(el('<p class="section-desc">' + t('暂无题目', 'No questions available yet.') + '</p>'));
      return;
    }

    const section = sections.find((s) => s.subject === current) || sections[0];

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
    sel.addEventListener('change', () => { current = sel.value; renderTest(); });
    picker.appendChild(sel);
    root.appendChild(picker);

    const form = el('<form id="test-form"></form>');

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

  // ---- Admin panel -----------------------------------------------------------
  // Lists every account with an Approve toggle and per-worksheet checkboxes.
  // All actions go through admin_* RPCs, which re-verify admin rights in the DB.
  async function loadAdmin() {
    root.innerHTML = '<p class="section-desc">' + t('加载用户中…', 'Loading users…') + '</p>';
    const [usersRes, subjectsRes] = await Promise.all([
      db.rpc('admin_list_users'),
      db.rpc('admin_list_subjects')
    ]);
    if (usersRes.error || subjectsRes.error) {
      const msg = (usersRes.error || subjectsRes.error).message || '';
      root.innerHTML = '<div class="service"><strong>' + t('加载失败', 'Failed to load') + '</strong><p>' + esc(msg) + '</p></div>';
      return;
    }
    renderAdmin(usersRes.data || [], (subjectsRes.data || []).map((r) => r.subject));
  }

  function renderAdmin(users, subjects) {
    root.innerHTML = '';
    root.appendChild(signedInBar({ back: true }));
    root.appendChild(el('<h3 style="margin:0 0 6px;">' + t('用户管理', 'User management') + '</h3>'));
    root.appendChild(el('<p class="section-desc">' +
      t('勾选“允许测试”开通账号；选择该学生可以做的练习（全不选 = 全部练习）。',
        'Tick "Allow testing" to activate an account, then pick which worksheets the student may take (none ticked = all worksheets).') + '</p>'));

    if (!users.length) {
      root.appendChild(el('<p class="section-desc">' + t('暂无注册用户。', 'No registered users yet.') + '</p>'));
      return;
    }

    users.forEach((u) => {
      const card = el('<div class="service" style="margin-bottom:14px;"></div>');
      card.appendChild(el('<strong>' + esc(u.name || t('（未填姓名）', '(no name)')) + '</strong> — ' + esc(u.email || '')));

      const approved = el(
        '<label style="display:flex; gap:8px; align-items:center; margin-top:10px; font-weight:700;">' +
          '<input type="checkbox" class="acc-approved" style="width:auto; margin:0;" ' + (u.approved ? 'checked' : '') + ' /> ' +
          t('允许测试', 'Allow testing') +
        '</label>');
      card.appendChild(approved);

      const grid = el('<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:6px; margin-top:10px;"></div>');
      subjects.forEach((s) => {
        const checked = Array.isArray(u.subjects) && u.subjects.indexOf(s) !== -1;
        grid.appendChild(el(
          '<label style="display:flex; gap:8px; align-items:center; font-weight:500;">' +
            '<input type="checkbox" class="acc-subject" value="' + esc(s) + '" style="width:auto; margin:0;" ' + (checked ? 'checked' : '') + ' /> ' +
            '<span>' + esc(s) + '</span>' +
          '</label>'));
      });
      card.appendChild(grid);

      const row = el('<div style="display:flex; gap:12px; align-items:center; margin-top:12px;"></div>');
      const save = el('<button class="btn primary" type="button" style="padding:8px 16px;">' + t('保存', 'Save') + '</button>');
      const status = el('<span style="font-weight:700;"></span>');
      save.addEventListener('click', async () => {
        const picked = [...card.querySelectorAll('.acc-subject:checked')].map((c) => c.value);
        save.disabled = true;
        status.style.color = '#6b7280';
        status.textContent = t('保存中…', 'Saving…');
        const { error } = await db.rpc('admin_set_access', {
          p_user: u.user_id,
          p_approved: card.querySelector('.acc-approved').checked,
          p_subjects: picked.length ? picked : null   // none ticked = all worksheets
        });
        if (error) {
          status.style.color = '#d33';
          status.textContent = t('保存失败：', 'Save failed: ') + (error.message || '');
        } else {
          status.style.color = '#28a745';
          status.textContent = t('已保存', 'Saved');
        }
        save.disabled = false;
      });
      row.appendChild(save);
      row.appendChild(status);
      card.appendChild(row);
      root.appendChild(card);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const status = form.querySelector('#test-status');
    const btn = form.querySelector('[type="submit"]');
    const fd = new FormData(form);
    const section = sections.find((s) => s.subject === current);

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
        p_name: displayName(),
        p_email: session.user.email,
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

  document.addEventListener('DOMContentLoaded', boot);
  // Re-render in the new language if the visitor toggles EN/中文.
  window.addEventListener('languageChanged', () => {
    if (!db) return;
    if (recovering) renderRecovery();
    else if (session) {
      if (view === 'admin' && isAdmin) loadAdmin();
      else if (sections.length) renderTest();
    }
    else renderAuth();
  });
})();
