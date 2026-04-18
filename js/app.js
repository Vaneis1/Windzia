// app.js — App initialization, tab navigation, drawer, search.
const App = {
  searchTimer: null,

  async init() {
    const loggedIn = await Auth.init();
    if (loggedIn) {
      this._showShell();
      Scan.initDropZone();
      // Wróć na ostatnią zakładkę lub domyślnie galeria
      const lastTab = localStorage.getItem('ww_last_tab') || 'gallery';
      this.navTo(lastTab);
    }
  },

  async onLogin() {
    this._showShell();
    Scan.initDropZone();
    await Characters.load();
    // Po logowaniu zawsze idź na galerię (nie na ostatnią zakładkę)
    localStorage.setItem('ww_last_tab', 'gallery');
    this.navTo('gallery');
  },

  _showShell() {
    const header = document.getElementById('app-header');
    const bottomNav = document.getElementById('mobile-bottom-nav');
    if (header) header.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = '';
    const u = State.currentUser;
    if (u) {
      const name = u.display_name || u.username;
      const drawerName = document.getElementById('drawer-user-name');
      const headerName = document.getElementById('user-display');
      if (drawerName) drawerName.textContent = name;
      if (headerName) headerName.textContent = name;
    }
    if (u?.role === 'admin') {
      const drawerLink = document.getElementById('drawer-admin-link');
      if (drawerLink) drawerLink.style.display = '';
      const topLink = document.getElementById('top-admin-link');
      if (topLink) topLink.style.display = '';
    }
  },

  // ── Drawer ────────────────────────────────────────────────────────────────
  toggleDrawer() {
    const drawer = document.getElementById('drawer');
    if (drawer.classList.contains('open')) this.closeDrawer();
    else this.openDrawer();
  },
  openDrawer() {
    document.getElementById('drawer')?.classList.add('open');
    document.getElementById('drawer-overlay')?.classList.add('open');
  },
  closeDrawer() {
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('open');
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  navTo(tab) {
    this.closeDrawer();
    this.switchTab(tab);
    // Zapamiętaj zakładkę
    localStorage.setItem('ww_last_tab', tab);
    document.querySelectorAll('.drawer-link').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    document.querySelectorAll('.mobile-bottom-nav button').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
  },

  switchTab(name) {
    const tabNames = ['scan', 'sheet', 'chars', 'gallery', 'timeline', 'admin'];
    tabNames.forEach(t => {
      document.getElementById('tab-' + t)?.classList.toggle('active', t === name);
    });
    document.querySelectorAll('.nav-tab').forEach((el, i) => {
      el.classList.toggle('active', tabNames[i] === name);
    });
    document.querySelectorAll('.top-nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === name);
    });

    if (name === 'sheet') Sheet.init();
    if (name === 'chars') Characters.load();
    if (name === 'gallery') Gallery.load();
    if (name === 'admin') Admin.load();
  },

  // ── Header search ─────────────────────────────────────────────────────────
  headerSearch(q) {
    clearTimeout(this.searchTimer);
    const results = document.getElementById('header-search-results');
    if (!q || q.length < 2) { if (results) results.innerHTML = ''; return; }
    this.searchTimer = setTimeout(async () => {
      try {
        const data = await API.get('/search?q=' + encodeURIComponent(q));
        if (!results) return;
        const chars = (data.characters || []).slice(0, 5);
        const items = (data.items || []).slice(0, 5);
        let html = '';
        if (chars.length) {
          html += chars.map(c => `<a class="search-result" href="profile.html?id=${c.id}">
            <div>⚔ ${this._esc(c.name)}</div>
            <div class="search-result-meta">${this._esc(c.owner_username || '')}</div>
          </a>`).join('');
        }
        if (items.length) {
          html += items.map(i => `<div class="search-result" onclick="App._gotoItem(${i.id},'${this._esc(i.name).replace(/'/g,"\\'")}')">
            <div>◆ ${this._esc(i.name)}</div>
            <div class="search-result-meta">${this._esc(i.category)}</div>
          </div>`).join('');
        }
        results.innerHTML = html || '<div class="search-result" style="color:var(--text-m);font-style:italic;cursor:default">Brak wyników</div>';
      } catch (e) {
        if (results) results.innerHTML = '';
      }
    }, 250);
  },

  _gotoItem(id, name) {
    this.navTo('sheet');
    setTimeout(() => {
      Sheet.switchView('item');
      setTimeout(() => Sheet.selectItem(id, name), 100);
    }, 100);
    document.getElementById('header-search-input').value = '';
    document.getElementById('header-search-results').innerHTML = '';
  },

  _esc(s) { return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
};

function doLogin() { Auth.login(); }
function doLogout() { Auth.logout(); }
function doForgot() { Auth.forgotPassword(); }
function doReset() { Auth.resetPassword(); }
function showForgot() { Auth.showForgot(); }
function showLogin() { Auth.showLoginForm(); }
function switchTab(name) { App.navTo(name); }
function switchAdminTab(name) { Admin.switchTab(name); }

document.addEventListener('click', e => {
  const search = document.querySelector('.header-search');
  if (search && !search.contains(e.target)) {
    const r = document.getElementById('header-search-results');
    if (r) r.innerHTML = '';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') App.closeDrawer();
});

document.addEventListener('DOMContentLoaded', () => App.init());
