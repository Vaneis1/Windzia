// app.js — App initialization and tab navigation.
const App = {
  async init() {
    const loggedIn = await Auth.init();
    if (loggedIn) {
      Scan.initDropZone();
    }
  },
 
  // Called after successful login
  async onLogin() {
    Scan.initDropZone();
    await Characters.load();
    await Sheet.load();
  },
 
  switchTab(name) {
    const tabNames = ['scan', 'sheet', 'chars', 'admin'];
    tabNames.forEach(t => {
      document.getElementById('tab-' + t)?.classList.toggle('active', t === name);
    });
    document.querySelectorAll('.nav-tab').forEach((el, i) => {
      el.classList.toggle('active', tabNames[i] === name);
    });
 
    if (name === 'sheet') Sheet.load();
    if (name === 'chars') Characters.load();
    if (name === 'admin') { Admin.load(); Admin.loadProfile(); }
  },
};
 
// ── Global event handlers (called from HTML onclick) ──────────────────────────
function doLogin() { Auth.login(); }
function doLogout() { Auth.logout(); }
function doForgot() { Auth.forgotPassword(); }
function doReset() { Auth.resetPassword(); }
function showForgot() { Auth.showForgot(); }
function showLogin() { Auth.showLoginForm(); }
 
function switchTab(name) { App.switchTab(name); }
function switchAdminTab(name) { Admin.switchTab(name); }
 
// ── Start ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
