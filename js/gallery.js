// gallery.js — Gallery view of all characters
const Gallery = {
  data: [],
  searchQuery: '',
  filter: 'all',

  async load() {
    const status = document.getElementById('gallery-status');
    if (status) status.textContent = 'Ładowanie...';
    try {
      const data = await API.get('/gallery');
      if (!Array.isArray(data)) throw new Error('Błąd serwera');
      this.data = data;
      this.render();
      if (status) status.textContent = '';
    } catch (e) {
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

  renderHero() {
    const wrap = document.getElementById('gallery-hero-wrap');
    if (!wrap) return;
    const withQuoteAndAvatar = this.data.find(c => c.featured_quote && c.avatar_url);
    // Kandydaci: postaci publiczne z cytatem i awatarem, lub z samym cytatem
    const candidates = this.data.filter(c => c.featured_quote && c.avatar_url && c.profile_public);
    const fallback   = this.data.filter(c => c.featured_quote && c.profile_public);
    const pool = candidates.length ? candidates : (fallback.length ? fallback : this.data);

    // Seed z daty — zmienia się codziennie, stabilny w ciągu dnia
    const today = new Date();
    const seed  = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const idx   = seed % pool.length;
    const hero  = pool[idx];
    const avatar = hero.avatar_url
      ? `<img class="hero-avatar" src="${this._esc(hero.avatar_url)}" alt="${this._esc(hero.name)}">`
      : `<div class="hero-avatar hero-avatar-placeholder">${(hero.name[0] || '?').toUpperCase()}</div>`;

    const metaParts = [];
    if (hero.age) metaParts.push(this._esc(hero.age));
    (hero.houses || []).forEach(h => metaParts.push(this._esc(h.name)));
    if (hero.location) metaParts.push(this._esc(hero.location));
    const metaStr = metaParts.length
      ? metaParts.join(' · ')
      : `Postać użytkownika ${this._esc(hero.owner_display)}`;

    const quoteHtml = hero.featured_quote ? `
      <blockquote class="hero-quote">${this._esc(hero.featured_quote.text)}</blockquote>
      ${hero.featured_quote.source ? `<div class="hero-quote-source">— ${this._esc(hero.featured_quote.source)}</div>` : ''}
    ` : '';

    wrap.innerHTML = `<div class="gallery-hero">
      ${avatar}
      <div class="hero-content">
        <div class="hero-label">⛬ Sylwetka dnia</div>
        <h2 class="hero-name">${this._esc(hero.name)}</h2>
        <div class="hero-meta">${metaStr}</div>
        ${quoteHtml}
        <a href="profile.html?id=${hero.id}" class="hero-link">Zobacz pełny profil →</a>
      </div>
    </div>`;
  },

  render() {
    this.renderHero();
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    let chars = this.data;

    if (this.filter === 'mine') {
      chars = chars.filter(c => c.owner_username === State.currentUser?.username);
    } else if (this.filter === 'public') {
      chars = chars.filter(c => c.profile_public);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      chars = chars.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.houses || []).map(h => h.name).join(' ').toLowerCase().includes(q) ||
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
      (c.houses || []).forEach(h =>
        meta.push(`<span class="gal-meta-row" style="color:${h.color};">⚜ ${this._esc(h.name)}</span>`)
      );
      if (c.location) meta.push(`<span class="gal-meta-row">⌖ ${this._esc(c.location)}</span>`);

      const quote = c.featured_quote
        ? `<div class="gal-quote">"${this._esc(c.featured_quote.text)}"${c.featured_quote.source ? `<div class="gal-quote-src">— ${this._esc(c.featured_quote.source)}</div>` : ''}</div>`
        : '';

      const privacyBadge = !c.profile_public
        ? `<div class="gal-privacy" title="Profil prywatny">🔒</div>` : '';

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
