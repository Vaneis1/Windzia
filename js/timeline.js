// timeline.js — Guild timeline with filters and participant display
const Timeline = {
  events: [],
  characters: [],
  houses: [],
  calendar: null,
  filters: { character_id: '', house_id: '', date_from: '', date_to: '' },
  _initialized: false,

  async init() {
    if (this._initialized) { await this.load(); return; }
    this._initialized = true;

    try {
      const [calData, chars, houses] = await Promise.all([
        API.get('/settings/calendar').catch(() => null),
        API.get('/characters').catch(() => []),
        API.get('/houses').catch(() => []),
      ]);
      this.calendar = calData;
      this.characters = Array.isArray(chars) ? chars : [];
      this.houses = Array.isArray(houses) ? houses : [];
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
    if (this.filters.date_from)    params.set('date_from',    this.filters.date_from);
    if (this.filters.date_to)      params.set('date_to',      this.filters.date_to);

    try {
      const data = await API.get('/events?' + params.toString());
      if (!Array.isArray(data)) throw new Error(data?.error || 'Błąd serwera');
      this.events = data;
      if (status) status.textContent = `${data.length} wydarzeń`;
      this._render();
    } catch(e) {
      if (status) status.textContent = 'Błąd: ' + e.message;
    }
  },

  setFilter(key, value) {
    this.filters[key] = value;
    clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(() => this.load(), 300);
  },

  clearFilters() {
    this.filters = { character_id: '', house_id: '', date_from: '', date_to: '' };
    const ids = ['tl-filter-char', 'tl-filter-house', 'tl-filter-from', 'tl-filter-to'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    this.load();
  },

  _renderFilters() {
    const charSel = document.getElementById('tl-filter-char');
    const houseSel = document.getElementById('tl-filter-house');
    if (!charSel || !houseSel) return;

    charSel.innerHTML = '<option value="">Wszystkie postacie</option>' +
      this.characters.map(c =>
        `<option value="${c.id}">${this._esc(c.name)}</option>`
      ).join('');

    houseSel.innerHTML = '<option value="">Wszystkie rody</option>' +
      this.houses.map(h =>
        `<option value="${h.id}">${h.heraldry ? h.heraldry + ' ' : ''}${this._esc(h.name)}</option>`
      ).join('');
  },

  _render() {
    const wrap = document.getElementById('timeline-events');
    if (!wrap) return;

    if (!this.events.length) {
      const hint = this.filters.character_id || this.filters.house_id
        ? 'Brak wydarzeń dla wybranych filtrów.'
        : 'Brak publicznych wydarzeń. Wybierz postać lub ród aby zobaczyć więcej.';
      wrap.innerHTML = `<div class="tl-empty">
        <div style="font-size:2rem;margin-bottom:1rem;opacity:0.25;">⧗</div>
        ${hint}
      </div>`;
      return;
    }

    // Group by year (or "?" for no date)
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
      html += `<div class="tl-year">
        <div class="tl-year-label">${altYear ? `${altYear} <span style="color:var(--text-m);font-size:0.75em;">(${year})</span>` : year}</div>
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

    const houseBadges = (e.houses || []).map(h =>
      `<span class="tl-house-badge" style="color:${h.color};border-color:${h.color};">
        ${h.heraldry ? h.heraldry + ' ' : ''}${this._esc(h.name)}
      </span>`
    ).join('');

    const avatar = e.character_avatar
      ? `<img class="tl-avatar" src="${this._esc(e.character_avatar)}" alt="">`
      : `<div class="tl-avatar tl-avatar-placeholder">${(e.character_name?.[0] || '?').toUpperCase()}</div>`;

    // Participants line
    const participants = (e.participants_detail || []);
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

    const visIcon = e.visibility === 'house' ? ' ⚜' : e.visibility === 'personal' ? ' 🔒' : '';

    return `<div class="tl-event">
      <div class="tl-event-dot"></div>
      <div class="tl-event-card">
        <div class="tl-event-header">
          <a href="profile.html?id=${e.character_id}" class="tl-char-link">
            ${avatar}
            <span class="tl-char-name">${this._esc(e.character_name || '')}${visIcon}</span>
          </a>
          ${houseBadges ? `<div class="tl-house-badges">${houseBadges}</div>` : ''}
        </div>
        ${participantsHtml}
        <div class="tl-event-date">
          ${altDate ? `<span class="tl-date-alt">${this._esc(altDate)}</span>` : ''}
          <span class="tl-date-plain">${this._esc(plainDate)}</span>
        </div>
        <div class="tl-event-title">${this._esc(e.title)}</div>
        ${e.description ? `<div class="tl-event-desc">${this._esc(e.description)}</div>` : ''}
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
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};
