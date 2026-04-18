// gallery.js — Gallery view of all characters
const Gallery = {
  data: [],
  searchQuery: '',
  filter: 'all', // 'all' | 'mine' | 'public'

  async load() {
    const status = document.getElementById('gallery-status');
    if (status) status.textContent = 'Ładowanie...';
    try {
      const data = await API.get('/gallery');
      if (!Array.isArray(data)) throw new Error('Błąd serwera');
      this.data = data;
      this.render();
      if (status) status.textContent = '';
    } catch(e) {
      if (status) status.textContent = 'Błąd: ' + e.message;
    }
  },

  setFilter(f) {
    this.filter = f;
    document.querySelectorAll('.gallery-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === f);
    });
    this.render();
  },

  setSearch(q) {
    this.searchQuery = q.trim().toLowerCase();
    this.render();
  },

  render() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    let chars = this.data;

    // Filter
    if (this.filter === 'mine') {
      chars = chars.filter(c => c.owner_username === State.currentUser?.username);
    } else if (this.filter === 'public') {
      chars = chars.filter(c => c.profile_public);
    }

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery;
      chars = chars.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.house || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.owner_display || '').toLowerCase().includes(q)
      );
    }

    if (!chars.length) {
      grid.innerHTML = '<div class="empty-msg">Brak postaci do wyświetlenia.</div>';
      return;
    }

    grid.innerHTML = chars.map(c => {
      const avatar = c.avatar_url
        ? `<img class="gal-avatar" src="${c.avatar_url}" alt="${c.name}">`
        : `<div class="gal-avatar gal-avatar-placeholder">${(c.name[0] || '?').toUpperCase()}</div>`;

      const meta = [];
      if (c.age) meta.push(`<span class="gal-meta-row">⌛ ${this._esc(c.age)}</span>`);
      if (c.house) meta.push(`<span class="gal-meta-row">⚜ ${this._esc(c.house)}</span>`);
      if (c.location) meta.push(`<span class="gal-meta-row">⌖ ${this._esc(c.location)}</span>`);

      const quote = c.featured_quote
        ? `<div class="gal-quote">"${this._esc(c.featured_quote.text)}"${c.featured_quote.source ? `<div class="gal-quote-src">— ${this._esc(c.featured_quote.source)}</div>` : ''}</div>`
        : '';

      const privacyBadge = !c.profile_public
        ? `<div class="gal-privacy" title="Profil prywatny">🔒</div>`
        : '';

      return `<a href="profile.html?id=${c.id}" class="gal-card">
        ${privacyBadge}
        ${avatar}
        <div class="gal-name">${this._esc(c.name)}</div>
        <div class="gal-owner">${this._esc(c.owner_display)}</div>
        ${meta.length ? `<div class="gal-meta">${meta.join('')}</div>` : ''}
        ${quote}
      </a>`;
    }).join('');
  },

  _esc(s) {
    return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};
