// timeline.js — Guild timeline with compact chip filters
const Timeline = {
  events: [],
  characters: [],
  houses: [],
  categories: [],
  calendar: null,
  filters: { character_id: '', house_id: '', category: '', date_from: '', date_to: '' },
  _initialized: false,

  async init() {
    if (this._initialized) { await this.load(); return; }
    this._initialized = true;

    try {
      const token = localStorage.getItem('ww_token') || '';
      const headers = { 'Authorization': 'Bearer ' + token };
      const proxyBase = (typeof Config !== 'undefined' ? Config.PROXY : '') || '';
      const [calData, chars, houses, cats] = await Promise.all([
        API.get('/settings/calendar').catch(() => null),
        API.get('/characters').catch(() => []),
        API.get('/houses').catch(() => []),
        fetch(proxyBase + '/events/categories', { headers })
          .then(r => r.json()).catch(() => []),
      ]);
      this.calendar = calData;
      this.characters = Array.isArray(chars) ? chars : [];
      this.houses = Array.isArray(houses) ? houses : [];
      this.categories = Array.isArray(cats) ? cats : [];
    } catch(e) {
      console.error('Timeline.init:', e.message);
    }

    this._renderFilters();
    await this.load();
  },

  async load() {
    const status = document.getElementById('timeline-status');
    if (status) status.textContent = 'Ładowanie...';

    const params = new URLSearchParams();
    if (this.filters.character_id) params.set('character_id', this.filters.character_id);
    if (this.filters.house_id)     params.set('house_id',     this.filters.house_id);
    if (this.filters.category)     params.set('category',     this.filters.category);
    if (this.filters.date_from)    params.set('date_from',    this.filters.date_from);
    if (this.filters.date_to)      params.set('date_to',      this.filters.date_to);

    try {
      const data = await API.get('/events?' + params.toString());
      if (!Array.isArray(data)) throw new Error(data?.error || 'Błąd serwera');
      this.events = data;
      if (status) status.textContent = data.length ? `${data.length} wydarzeń` : '';
      this._render();
    } catch(e) {
      if (status) status.textContent = 'Błąd: ' + e.message;
    }
  },

  setFilter(key, value) {
    this.filters[key] = value;
    if (['character_id', 'house_id', 'category'].includes(key)) {
      this._updateChipState(key, value);
    }
    if (key === 'date_from' || key === 'date_to') {
      this._updateDateDisplay(key, value);
    }
    clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(() => this.load(), 300);
  },

  clearFilters() {
    this.filters = { character_id: '', house_id: '', category: '', date_from: '', date_to: '' };
    this._renderFilters();
    this.load();
  },

  _updateChipState(key, value) {
    const group = document.querySelector(`.tl-chip-group[data-filter="${key}"]`);
    if (!group) return;
    group.querySelectorAll('.tl-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.value === value);
    });
  },

  _updateDateDisplay(key, value) {
    const displayId = key === 'date_from' ? 'tl-date-from-display' : 'tl-date-to-display';
    const el = document.getElementById(displayId);
    if (!el) return;
    if (!value) { el.textContent = ''; return; }
    const alt = this._formatAltDate(value);
    const plain = this._formatPlainDate(value);
    el.textContent = alt ? `${alt} (${plain})` : plain;
  },

  _renderFilters() {
    const wrap = document.getElementById('timeline-filters');
    if (!wrap) return;

    const charChips = [
      { label: 'Wszystkie', value: '' },
      ...this.characters.map(c => ({ label: c.name, value: String(c.id) })),
    ];
    const houseChips = [
      { label: 'Wszystkie rody', value: '' },
      ...this.houses.map(h => ({
        label: (h.heraldry ? h.heraldry + ' ' : '') + h.name,
        value: String(h.id), color: h.color,
      })),
    ];
    const catChips = [
      { label: 'Wszystkie', value: '' },
      ...this.categories.map(c => ({ label: c, value: c })),
    ];

    wrap.innerHTML = `
      <div class="tl-filter-row">
        <div class="tl-filter-row-label">Postać</div>
        <div class="tl-chip-group tl-chip-scroll" data-filter="character_id">
          ${charChips.map(c => `
            <button class="tl-chip${c.value === this.filters.character_id ? ' active' : ''}"
              data-value="${this._esc(c.value)}"
              onclick="Timeline.setFilter('character_id','${this._esc(c.value)}')">
              ${this._esc(c.label)}
            </button>`).join('')}
        </div>
      </div>

      ${this.houses.length ? `
      <div class="tl-filter-row">
        <div class="tl-filter-row-label">Ród</div>
        <div class="tl-chip-group tl-chip-scroll" data-filter="house_id">
          ${houseChips.map(h => `
            <button class="tl-chip${h.value === this.filters.house_id ? ' active' : ''}"
              data-value="${this._esc(h.value)}"
              ${h.value && h.color ? `style="--chip-color:${h.color}"` : ''}
              onclick="Timeline.setFilter('house_id','${this._esc(h.value)}')">
              ${this._esc(h.label)}
            </button>`).join('')}
        </div>
      </div>` : ''}

      ${this.categories.length ? `
      <div class="tl-filter-row">
        <div class="tl-filter-row-label">Typ</div>
        <div class="tl-chip-group tl-chip-scroll" data-filter="category">
          ${catChips.map(c => `
            <button class="tl-chip${c.value === this.filters.category ? ' active' : ''}"
              data-value="${this._esc(c.value)}"
              onclick="Timeline.setFilter('category','${this._esc(c.value)}')">
              ${this._esc(c.label)}
            </button>`).join('')}
        </div>
      </div>` : ''}

      <div class="tl-filter-row">
        <div class="tl-filter-row-label">Daty</div>
        <div class="tl-date-range">
          <div class="tl-date-field">
            <span class="tl-date-field-label">Od</span>
            <input type="date" id="tl-date-from" value="${this.filters.date_from}"
              onchange="Timeline.setFilter('date_from',this.value)">
            <span id="tl-date-from-display" class="tl-date-alt-display"></span>
          </div>
          <div class="tl-date-field">
            <span class="tl-date-field-label">Do</span>
            <input type="date" id="tl-date-to" value="${this.filters.date_to}"
              onchange="Timeline.setFilter('date_to',this.value)">
            <span id="tl-date-to-display" class="tl-date-alt-display"></span>
          </div>
          <button class="tl-clear-btn" onclick="Timeline.clearFilters()">✕ Wyczyść</button>
        </div>
      </div>
    `;

    if (this.filters.date_from) this._updateDateDisplay('date_from', this.filters.date_from);
    if (this.filters.date_to)   this._updateDateDisplay('date_to',   this.filters.date_to);
  },

  _render() {
    const wrap = document.getElementById('timeline-events');
    if (!wrap) return;

    if (!this.events.length) {
      wrap.innerHTML = `<div class="tl-empty">
        <div style="font-size:2rem;margin-bottom:1rem;opacity:0.25;">⧗</div>
        Brak wydarzeń dla wybranych filtrów.
      </div>`;
      return;
    }

    const byYear = {};
    const noDate = [];
    this.events.forEach(e => {
      if (!e.date) { noDate.push(e); return; }
      const year = e.date.slice(0, 4);
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(e);
    });

    const years = Object.keys(byYear).sort();
    let html = '';

    years.forEach(year => {
      const altYear = this._altYear(year);
      const yearLabel = altYear
        ? `${altYear} <span style="color:var(--text-m);font-size:0.75em;font-family:'Crimson Pro',serif;">(${year})</span>`
        : year;
      html += `<div class="tl-year">
        <div class="tl-year-label">${yearLabel}</div>
        <div class="tl-year-events">
          ${byYear[year].map(e => this._renderEvent(e)).join('')}
        </div>
      </div>`;
    });

    if (noDate.length) {
      html += `<div class="tl-year">
        <div class="tl-year-label" style="color:var(--text-m);">Data nieznana</div>
        <div class="tl-year-events">${noDate.map(e => this._renderEvent(e)).join('')}</div>
      </div>`;
    }

    wrap.innerHTML = html;
  },

  _renderEvent(e) {
    const altDate = this._formatAltDate(e.date);
    const plainDate = this._formatPlainDate(e.date);

    const avatar = e.character_avatar
      ? `<img class="tl-avatar" src="${this._esc(e.character_avatar)}" alt="">`
      : `<div class="tl-avatar tl-avatar-placeholder">${(e.character_name?.[0]||'?').toUpperCase()}</div>`;

    const houseBadges = (e.houses || []).map(h =>
      `<span class="tl-house-badge" style="color:${h.color};border-color:${h.color};">
        ${h.heraldry ? h.heraldry + ' ' : ''}${this._esc(h.name)}
      </span>`
    ).join('');

    const participants = e.participants_detail || [];
    const participantsHtml = participants.length ? `
      <div class="tl-participants">
        <span class="tl-participants-label">z udziałem:</span>
        ${participants.map(p => {
          const pAvatar = p.avatar
            ? `<img class="tl-avatar tl-avatar-sm" src="${this._esc(p.avatar)}" alt="" title="${this._esc(p.name)}">`
            : `<div class="tl-avatar tl-avatar-sm tl-avatar-placeholder" title="${this._esc(p.name)}">${(p.name?.[0]||'?').toUpperCase()}</div>`;
          return `<a href="profile.html?id=${p.character_id}" class="tl-participant-link">${pAvatar}<span>${this._esc(p.name)}</span></a>`;
        }).join('')}
      </div>` : '';

    const catBadge = e.category
      ? `<span class="tl-cat-badge">${this._esc(e.category)}</span>` : '';
    const visBadge = e.visibility && e.visibility !== 'public'
      ? `<span class="tl-vis-badge">${e.visibility === 'house' ? '⚜ Ród' : '🔒 Osobiste'}</span>` : '';

    return `<div class="tl-event">
      <div class="tl-event-dot"></div>
      <div class="tl-event-card">

        <!-- Nagłówek: postać po lewej, data po prawej -->
        <div class="tl-event-header">
          <div class="tl-event-header-left">
            <a href="profile.html?id=${e.character_id}" class="tl-char-link">
              ${avatar}
              <span class="tl-char-name">${this._esc(e.character_name||'')}</span>
            </a>
            ${houseBadges ? `<div class="tl-house-badges">${houseBadges}</div>` : ''}
          </div>
          <div class="tl-event-header-right">
            <div class="tl-event-date-wrap">
              ${altDate ? `<span class="tl-date-alt">${this._esc(altDate)}</span>` : ''}
              <span class="tl-date-plain">${this._esc(plainDate)}</span>
            </div>
            <div class="tl-event-badges">
              ${catBadge}
              ${visBadge}
            </div>
          </div>
        </div>

        <!-- Tytuł -->
        <div class="tl-event-title">${this._esc(e.title)}</div>

        <!-- Opis -->
        ${e.description ? `<div class="tl-event-desc">${this._esc(e.description)}</div>` : ''}

        <!-- Uczestnicy -->
        ${participantsHtml}
      </div>
    </div>`;
  },

  _altYear(yearStr) {
    if (!this.calendar?.enabled) return '';
    const offset = this.calendar.year_offset || 0;
    const suffix = this.calendar.era_suffix ? ' ' + this.calendar.era_suffix : '';
    return (parseInt(yearStr) + offset) + suffix;
  },

  _formatAltDate(iso) {
    if (!iso || !this.calendar?.enabled) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const [, year, month, day] = m;
    const monthName = this.calendar.month_names[parseInt(month) - 1] || month;
    const altYear = parseInt(year) + (this.calendar.year_offset || 0);
    const suffix = this.calendar.era_suffix ? ' ' + this.calendar.era_suffix : '';
    return `${parseInt(day)} ${monthName} ${altYear}${suffix}`;
  },

  _formatPlainDate(iso) {
    if (!iso) return '—';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
  },

  _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};
