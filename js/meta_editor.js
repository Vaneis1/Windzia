// meta_editor.js — Editor for predefined character metadata (Info tab)
const MetaEditor = {
  data: {},
  calendar: null,

  async init() {
    // Load calendar settings
    try {
      const cal = await fetch((window.PROXY||'') + '/settings/calendar').then(r => r.json());
      this.calendar = cal;
    } catch(e) { this.calendar = null; }
  },

  load(meta) {
    this.data = JSON.parse(JSON.stringify(meta || {}));
    if (!this.data.quotes) this.data.quotes = [];
    if (!this.data.story_hooks) this.data.story_hooks = [];
    if (!this.data.events) this.data.events = [];
    this.render();
  },

  getData() {
    return this.data;
  },

  _genId() {
    return 'i' + Math.random().toString(36).slice(2, 9);
  },

  _markDirty() {
    if (typeof Editor !== 'undefined') {
      Editor.dirty = true;
      const btn = document.getElementById('save-btn');
      if (btn) btn.classList.add('dirty');
    }
  },

  // ── Field helpers ─────────────────────────────────────────────────────────
  setField(key, value) {
    this.data[key] = value;
    this._markDirty();
  },

  // ── Quotes ────────────────────────────────────────────────────────────────
  addQuote() {
    this.data.quotes.push({ id: this._genId(), text: '', source: '' });
    this._markDirty();
    this.renderQuotes();
  },

  removeQuote(id) {
    if (!confirm('Usunąć cytat?')) return;
    this.data.quotes = this.data.quotes.filter(q => q.id !== id);
    if (this.data.featured_quote_id === id) this.data.featured_quote_id = null;
    this._markDirty();
    this.renderQuotes();
  },

  updateQuote(id, key, value) {
    const q = this.data.quotes.find(q => q.id === id);
    if (q) { q[key] = value; this._markDirty(); }
  },

  setFeaturedQuote(id) {
    this.data.featured_quote_id = this.data.featured_quote_id === id ? null : id;
    this._markDirty();
    this.renderQuotes();
  },

  // ── Story hooks ───────────────────────────────────────────────────────────
  addHook() {
    this.data.story_hooks.push({ id: this._genId(), title: '', description: '' });
    this._markDirty();
    this.renderHooks();
  },

  removeHook(id) {
    if (!confirm('Usunąć wątek?')) return;
    this.data.story_hooks = this.data.story_hooks.filter(h => h.id !== id);
    this._markDirty();
    this.renderHooks();
  },

  updateHook(id, key, value) {
    const h = this.data.story_hooks.find(h => h.id === id);
    if (h) { h[key] = value; this._markDirty(); }
  },

  // ── Events ────────────────────────────────────────────────────────────────
  addEvent() {
    this.data.events.push({ id: this._genId(), date: '', title: '', description: '' });
    this._markDirty();
    this.renderEvents();
  },

  removeEvent(id) {
    if (!confirm('Usunąć wydarzenie?')) return;
    this.data.events = this.data.events.filter(e => e.id !== id);
    this._markDirty();
    this.renderEvents();
  },

  updateEvent(id, key, value) {
    const e = this.data.events.find(e => e.id === id);
    if (e) { e[key] = value; this._markDirty(); }
  },

  formatDate(iso) {
    if (!iso) return '—';
    if (!this.calendar?.enabled) return iso;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const [, year, month, day] = m;
    const monthName = this.calendar.month_names[parseInt(month) - 1] || month;
    const altYear = parseInt(year) + (this.calendar.year_offset || 0);
    const suffix = this.calendar.era_suffix ? ' ' + this.calendar.era_suffix : '';
    return `${parseInt(day)} ${monthName} ${altYear}${suffix}`;
  },

  // ── Rendering ─────────────────────────────────────────────────────────────
  render() {
    const d = this.data;
    const root = document.getElementById('meta-form');
    if (!root) return;

    root.innerHTML = `
      <div class="meta-section">
        <div class="meta-section-title">Awatar i podstawowe info</div>
        <div class="meta-grid">
          <div class="meta-field meta-field-wide">
            <label>URL awatara</label>
            <input type="text" value="${this._esc(d.avatar_url||'')}" placeholder="https://i.ibb.co/..."
              oninput="MetaEditor.setField('avatar_url',this.value)">
            <div class="meta-hint">Wgraj na imgbb.com lub imgur.com, wklej tu URL</div>
          </div>
          <div class="meta-field">
            <label>Wiek</label>
            <input type="text" value="${this._esc(d.age||'')}" placeholder="np. 27 zim"
              oninput="MetaEditor.setField('age',this.value)">
          </div>
          <div class="meta-field">
            <label>Ród</label>
            <input type="text" value="${this._esc(d.house||'')}" placeholder="np. Ród Voraskar"
              oninput="MetaEditor.setField('house',this.value)">
          </div>
          <div class="meta-field meta-field-wide">
            <label>Miejsce przebywania</label>
            <input type="text" value="${this._esc(d.location||'')}" placeholder="np. Karczma Pod Złotym Lwem"
              oninput="MetaEditor.setField('location',this.value)">
          </div>
          <div class="meta-field meta-field-wide">
            <label>O postaci</label>
            <textarea rows="6" placeholder="Opisz postać..."
              oninput="MetaEditor.setField('bio',this.value)">${this._esc(d.bio||'')}</textarea>
          </div>
        </div>
      </div>

      <div class="meta-section">
        <div class="meta-section-title">
          Ulubione cytaty
          <button class="meta-add-btn" onclick="MetaEditor.addQuote()">＋ Dodaj cytat</button>
        </div>
        <div id="meta-quotes-list"></div>
      </div>

      <div class="meta-section">
        <div class="meta-section-title">
          Poszukiwane wątki fabularne
          <button class="meta-add-btn" onclick="MetaEditor.addHook()">＋ Dodaj wątek</button>
        </div>
        <div id="meta-hooks-list"></div>
      </div>

      <div class="meta-section">
        <div class="meta-section-title">
          Wydarzenia (oś czasu)
          <button class="meta-add-btn" onclick="MetaEditor.addEvent()">＋ Dodaj wydarzenie</button>
        </div>
        <div id="meta-events-list"></div>
      </div>
    `;

    this.renderQuotes();
    this.renderHooks();
    this.renderEvents();
  },

  renderQuotes() {
    const el = document.getElementById('meta-quotes-list');
    if (!el) return;
    if (!this.data.quotes.length) {
      el.innerHTML = '<div class="meta-empty">Brak cytatów. Kliknij „Dodaj cytat" aby zacząć.</div>';
      return;
    }
    el.innerHTML = this.data.quotes.map(q => `
      <div class="meta-item">
        <div class="meta-item-header">
          <button class="meta-feature-btn ${this.data.featured_quote_id === q.id ? 'active' : ''}"
            onclick="MetaEditor.setFeaturedQuote('${q.id}')"
            title="${this.data.featured_quote_id === q.id ? 'Wyróżniony — pokazany w galerii' : 'Wyróżnij ten cytat w galerii'}">★</button>
          <span class="meta-item-label">${this.data.featured_quote_id === q.id ? 'Wyróżniony cytat' : 'Cytat'}</span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeQuote('${q.id}')">✕</button>
        </div>
        <textarea rows="2" placeholder="Treść cytatu..."
          oninput="MetaEditor.updateQuote('${q.id}','text',this.value)">${this._esc(q.text||'')}</textarea>
        <input type="text" placeholder="Źródło / kontekst (opcjonalnie)" value="${this._esc(q.source||'')}"
          oninput="MetaEditor.updateQuote('${q.id}','source',this.value)">
      </div>
    `).join('');
  },

  renderHooks() {
    const el = document.getElementById('meta-hooks-list');
    if (!el) return;
    if (!this.data.story_hooks.length) {
      el.innerHTML = '<div class="meta-empty">Brak wątków. Kliknij „Dodaj wątek" aby zacząć.</div>';
      return;
    }
    el.innerHTML = this.data.story_hooks.map(h => `
      <div class="meta-item">
        <div class="meta-item-header">
          <span class="meta-item-label">Wątek</span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeHook('${h.id}')">✕</button>
        </div>
        <input type="text" placeholder="Tytuł wątku..." value="${this._esc(h.title||'')}"
          oninput="MetaEditor.updateHook('${h.id}','title',this.value)">
        <textarea rows="3" placeholder="Opis wątku — co postać szuka, oferuje, na czym jej zależy..."
          oninput="MetaEditor.updateHook('${h.id}','description',this.value)">${this._esc(h.description||'')}</textarea>
      </div>
    `).join('');
  },

  renderEvents() {
    const el = document.getElementById('meta-events-list');
    if (!el) return;
    if (!this.data.events.length) {
      el.innerHTML = '<div class="meta-empty">Brak wydarzeń. Kliknij „Dodaj wydarzenie" aby zacząć.</div>';
      return;
    }
    // Sort by date ascending
    const sorted = [...this.data.events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    el.innerHTML = sorted.map(e => {
      const altDate = e.date && this.calendar?.enabled ? this.formatDate(e.date) : '';
      return `
      <div class="meta-item">
        <div class="meta-item-header">
          <span class="meta-item-label">Wydarzenie ${altDate ? `<span class="meta-alt-date">${this._esc(altDate)}</span>` : ''}</span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeEvent('${e.id}')">✕</button>
        </div>
        <div class="meta-event-row">
          <input type="date" value="${this._esc(e.date||'')}"
            oninput="MetaEditor.updateEvent('${e.id}','date',this.value);MetaEditor.renderEvents()">
          <input type="text" placeholder="Tytuł wydarzenia..." value="${this._esc(e.title||'')}"
            oninput="MetaEditor.updateEvent('${e.id}','title',this.value)">
        </div>
        <textarea rows="3" placeholder="Opis wydarzenia..."
          oninput="MetaEditor.updateEvent('${e.id}','description',this.value)">${this._esc(e.description||'')}</textarea>
      </div>
    `;}).join('');
  },

  _esc(s) { return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
};
