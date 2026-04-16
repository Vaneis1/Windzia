// auth.js — Login, logout, password reset.
const Auth = {
  // ── View switching ───────────────────────────────────────────────────────
  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    this._showForm('login-form');
  },
 
  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-display').textContent =
      State.currentUser.username +
      (State.currentUser.role === 'admin' ? ' (admin)' : '');
    if (State.currentUser.role === 'admin') {
      UI.show('admin-nav-tab');
    }
  },
 
  _showForm(id) {
    ['login-form', 'forgot-form', 'reset-form'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = f === id ? 'block' : 'none';
    });
  },
 
  showForgot() { this._showForm('forgot-form'); },
  showLoginForm() { this._showForm('login-form'); },
 
  showResetForm(token) {
    const form = document.getElementById('reset-form');
    if (form) { form.dataset.token = token; form.style.display = 'block'; }
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-form').style.display = 'none';
  },
 
  // ── Actions ──────────────────────────────────────────────────────────────
  async login() {
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-pwd').value;
    UI.clearMsg('login-ok', 'login-err');
    try {
      const data = await API.post('/auth/login', { email, password: pwd });
      if (data.error) throw new Error(data.error);
      State.setToken(data.token);
      State.setUser({ id: data.id, username: data.username, role: data.role });
      this.showApp();
      App.onLogin();
    } catch (e) {
      UI.err('login-ok', 'login-err', e.message);
    }
  },
 
  logout() {
    State.clearSession();
    this.showLogin();
  },
 
  async forgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    UI.clearMsg('forgot-ok', 'forgot-err');
    try {
      await API.post('/auth/forgot-password', { email });
      UI.ok('forgot-ok', 'forgot-err', 'Link wysłany! Sprawdź swoją skrzynkę email.');
    } catch (e) {
      UI.err('forgot-ok', 'forgot-err', e.message);
    }
  },
 
  async resetPassword() {
    const form = document.getElementById('reset-form');
    const token = form?.dataset.token || '';
    const pwd = document.getElementById('reset-pwd').value;
    UI.clearMsg('reset-ok', 'reset-err');
    try {
      const data = await API.post('/auth/reset-password', { token, password: pwd });
      if (data.error) throw new Error(data.error);
      UI.ok('reset-ok', 'reset-err', 'Hasło zmienione! Możesz się teraz zalogować.');
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname);
        this._showForm('login-form');
      }, 2000);
    } catch (e) {
      UI.err('reset-ok', 'reset-err', e.message);
    }
  },
 
  // ── Init ─────────────────────────────────────────────────────────────────
  async init() {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset');
 
    if (resetToken) {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app-screen').style.display = 'none';
      this.showResetForm(resetToken);
      return false; // don't continue to app
    }
 
    if (State.token) {
      try {
        const data = await API.get('/auth/me');
        if (data.id) {
          State.setUser(data);
          this.showApp();
          return true;
        }
      } catch (e) {
        // Token invalid — fall through to login
      }
    }
 
    this.showLogin();
    return false;
  },
};
