// auth.js — handles login, signup, session state, and plan gating
// All UI updates go through updateAuthUI() so the nav stays in sync

const Auth = (() => {
  let _session = null;
  let _profile = null;

  // ── Session ────────────────────────────────────────────────

  async function init() {
    const sb = getSupabase();
    if (!sb) return;

    // Restore existing session on page load
    const { data } = await sb.auth.getSession();
    if (data.session) {
      _session = data.session;
      await _loadProfile(data.session.user.id);
    }
    updateAuthUI();

    // Listen for auth changes (login, logout, token refresh)
    sb.auth.onAuthStateChange(async (event, session) => {
      _session = session;
      if (session) {
        await _loadProfile(session.user.id);
      } else {
        _profile = null;
      }
      updateAuthUI();
      // Re-render current page so gated content updates instantly
      App.renderCurrentPage();
    });
  }

  async function _loadProfile(userId) {
    const { data } = await dbQuery(sb =>
      sb.from('users').select('*').eq('id', userId).single()
    );
    _profile = data;
  }

  // ── Sign Up ────────────────────────────────────────────────

  async function signUp(email, password, fullName, phone) {
    const sb = getSupabase();
    if (!sb) return { error: 'Not configured' };

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } }
    });
    if (error) return { error: error.message };

    // Insert profile row (trigger also does this, belt-and-suspenders)
    if (data.user) {
      await dbQuery(sb => sb.from('users').upsert({
        id:        data.user.id,
        email,
        phone,
        full_name: fullName,
        plan:      'free',
      }));
    }
    return { data };
  }

  // ── Login ──────────────────────────────────────────────────

  async function login(email, password) {
    const sb = getSupabase();
    if (!sb) return { error: 'Not configured' };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { data };
  }

  // ── Logout ─────────────────────────────────────────────────

  async function logout() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    _session = null;
    _profile = null;
    updateAuthUI();
  }

  // ── Helpers ────────────────────────────────────────────────

  function isLoggedIn() { return !!_session; }

  function getPlan() {
    if (!_profile) return 'free';
    // Check expiry
    if (_profile.plan_expires_at && new Date(_profile.plan_expires_at) < new Date()) {
      return 'free'; // expired — treat as free
    }
    return _profile.plan || 'free';
  }

  function isPro()        { return ['pro', 'enterprise'].includes(getPlan()); }
  function isEnterprise() { return getPlan() === 'enterprise'; }
  function getUser()      { return _profile; }

  // ── UI ─────────────────────────────────────────────────────

  function updateAuthUI() {
    const planEl  = document.getElementById('navPlan');
    const loginEl = document.getElementById('btnLogin');
    const plan    = getPlan();

    if (planEl) {
      planEl.textContent = plan.toUpperCase();
      planEl.className   = `nav-plan plan-${plan}`;
    }
    if (loginEl) {
      loginEl.textContent = isLoggedIn() ? 'Logout' : 'Login';
    }
  }

  // ── Auth Modal ─────────────────────────────────────────────

  function showModal(mode = 'login') {
    document.getElementById('authModal').style.display = 'flex';
    renderAuthForm(mode);
  }

  function hideModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  function renderAuthForm(mode) {
    const form = document.getElementById('authForm');
    const isLogin = mode === 'login';

    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabSignup').classList.toggle('active', !isLogin);

    form.innerHTML = isLogin ? `
      <div class="auth-field">
        <label>Email</label>
        <input type="email" id="authEmail" placeholder="you@example.com" />
      </div>
      <div class="auth-field">
        <label>Password</label>
        <input type="password" id="authPassword" placeholder="••••••••" />
      </div>
      <div class="auth-error" id="authError"></div>
      <button class="btn btn-upgrade w-full" id="authSubmit">Login</button>
    ` : `
      <div class="auth-field">
        <label>Full Name</label>
        <input type="text" id="authName" placeholder="Jane Wanjiru" />
      </div>
      <div class="auth-field">
        <label>Email</label>
        <input type="email" id="authEmail" placeholder="you@example.com" />
      </div>
      <div class="auth-field">
        <label>Phone (M-Pesa)</label>
        <input type="tel" id="authPhone" placeholder="+254700000000" />
      </div>
      <div class="auth-field">
        <label>Password</label>
        <input type="password" id="authPassword" placeholder="Min 8 characters" />
      </div>
      <div class="auth-error" id="authError"></div>
      <button class="btn btn-upgrade w-full" id="authSubmit">Create Account</button>
    `;

    document.getElementById('authSubmit').addEventListener('click', async () => {
      const btn   = document.getElementById('authSubmit');
      const email = document.getElementById('authEmail').value.trim();
      const pass  = document.getElementById('authPassword').value;
      const errEl = document.getElementById('authError');

      btn.disabled    = true;
      btn.textContent = 'Please wait…';
      errEl.textContent = '';

      let result;
      if (isLogin) {
        result = await login(email, pass);
      } else {
        const name  = document.getElementById('authName').value.trim();
        const phone = document.getElementById('authPhone').value.trim();
        result = await signUp(email, pass, name, phone);
      }

      if (result.error) {
        errEl.textContent  = result.error;
        btn.disabled       = false;
        btn.textContent    = isLogin ? 'Login' : 'Create Account';
      } else {
        hideModal();
      }
    });
  }

  // ── Paywall gate ───────────────────────────────────────────
  // Call this to wrap any Pro-only section:
  // Auth.gate('pro', containerEl, () => renderProContent())

  function gate(requiredPlan, container, renderFn) {
    const planRank = { free: 0, pro: 1, enterprise: 2 };
    const userRank = planRank[getPlan()] ?? 0;
    const reqRank  = planRank[requiredPlan] ?? 1;

    if (userRank >= reqRank) {
      renderFn();
    } else {
      container.innerHTML = `
        <div class="lock-overlay">
          <div class="lock-icon">🔒</div>
          <div class="lock-text">${requiredPlan.toUpperCase()} PLAN REQUIRED</div>
          <button class="lock-upgrade" id="lockUpgradeBtn">Upgrade →</button>
        </div>`;
      document.getElementById('lockUpgradeBtn')?.addEventListener('click', () => {
        App.showPage('plans');
      });
    }
  }

  return { init, login, signUp, logout, isLoggedIn, getPlan, isPro,
           isEnterprise, getUser, updateAuthUI, showModal, hideModal,
           renderAuthForm, gate };
})();
