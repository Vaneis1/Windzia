// meta_editor.js — Editor for predefined character metadata (Info tab)
const MetaEditor = {
  data: {},
  calendar: null,
  _charId: null,
  _allChars: [],
  _sharedEvents: [],
  _categories: [],

  async init() {
    try {
      const [cal, cats] = await Promise.all([
        fetch((window.PROXY||'') + '/settings/calendar').then(r => r.json()).catch(() => null),
        fetch((window.PROXY||'') + '/events/categories', {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('ww_token')||'') }
        }).then(r => r.json()).catch(() => []),
      ]);
      this.calendar = cal;
      this._categories = Array.isArray(cats) ? cats : [];
    } catch(e) { this.calendar = null; }
  },

  async loadWithEvents(charId, meta) {
    this._charId = charId;
    this.data = JSON.parse(JSON.stringify(meta || {}));
    if (!this.data.quotes) this.data.quotes = [];
    if (!this.data.story_hooks) this.data.story_hooks = [];
    this.data.events = [];
    delete this.data.house;

    const token = localStorage.getItem('ww_token') || '';
    const headers = { 'Authorization': 'Bearer ' + token };

    try {
      const [eventsRes, charsRes] = await Promise.all([
        fetch((window.PROXY||'') + '/characters/' + charId + '/events', { headers }),
        fetch((window.PROXY||'') + '/characters', { headers }),
      ]);
      const eventsData = await eventsRes.json();
      const charsData  = await charsRes.json();

      if (Array.isArray(eventsData)) {
        this.data.events   = eventsData.filter(e => !e.is_shared);
        this._sharedEvents = eventsData.filter(e =>  e.is_shared);
      }
      this._allChars = Array.isArray(charsData)
        ? charsData.filter(c => c.id != charId)
        : [];
    } catch(e) {
      console.error('MetaEditor.loadWithEvents:', e.message);
    }

    this.render();
  },

  load(meta) {
    this.data = JSON.parse(JSON.stringify(meta || {}));
    if (!this.data.quotes) this.data.quotes = [];
    if (!this.data.story_hooks) this.data.story_hooks = [];
    if (!this.data.events) this.data.events = [];
    delete this.data.house;
    this.render();
  },

  getData() {
    const d = { ...this.data };
    delete d.house;
    delete d.events;
    return d;
  },

  async syncEvents(charId, apiFn) {
    const res = await apiFn('PUT', `/characters/${charId}/events`, {
      events: this.data.events || [],
    });
    if (res.error) throw new Error(res.error);
  },

  _genId() { return 'i' + Math.random().toString(36).slice(2, 9); },

  _markDirty() {
    if (typeof Editor !== 'undefined') {
      Editor.dirty = true;
      const btn = document.getElementById('save-btn');
      if (btn) btn.classList.add('dirty');
    }
  },

  setField(key, value) { this.data[key] = value; this._markDirty(); },

  renderBirthday() {
    const el = document.getElementById('meta-birthday-display');
    if (!el) return;
    const iso = this.data.birthday || '';
    if (!iso) { el.textContent = ''; return; }
    const formatted = this.formatDate(iso);
    const plain = this._formatPlain(iso);
    el.textContent = formatted && formatted !== iso
      ? `→ ${formatted} (${plain})` : `→ ${plain}`;
  },

  // ── Quotes ────────────────────────────────────────────────────────────────
  addQuote() {
    this.data.quotes.push({ id: this._genId(), text: '', source: '' });
    this._markDirty(); this.renderQuotes();
  },
  removeQuote(id) {
    if (!confirm('Usunąć cytat?')) return;
    this.data.quotes = this.data.quotes.filter(q => q.id !== id);
    if (this.data.featured_quote_id === id) this.data.featured_quote_id = null;
    this._markDirty(); this.renderQuotes();
  },
  updateQuote(id, key, value) {
    const q = this.data.quotes.find(q => q.id === id);
    if (q) { q[key] = value; this._markDirty(); }
  },
  setFeaturedQuote(id) {
    this.data.featured_quote_id = this.data.featured_quote_id === id ? null : id;
    this._markDirty(); this.renderQuotes();
  },

  // ── Story hooks ───────────────────────────────────────────────────────────
  addHook() {
    this.data.story_hooks.push({ id: this._genId(), title: '', description: '' });
    this._markDirty(); this.renderHooks();
  },
  removeHook(id) {
    if (!confirm('Usunąć wątek?')) return;
    this.data.story_hooks = this.data.story_hooks.filter(h => h.id !== id);
    this._markDirty(); this.renderHooks();
  },
  updateHook(id, key, value) {
    const h = this.data.story_hooks.find(h => h.id === id);
    if (h) { h[key] = value; this._markDirty(); }
  },

  // ── Events ────────────────────────────────────────────────────────────────
  addEvent() {
    this.data.events.push({
      id: this._genId(), date: '', title: '',
      description: '', visibility: 'public',
      category: '', participant_ids: [],
    });
    this._markDirty(); this.renderEvents();
  },
  removeEvent(id) {
    if (!confirm('Usunąć wydarzenie?')) return;
    // Use loose match to handle both string and number IDs
    this.data.events = this.data.events.filter(e => String(e.id) !== String(id));
    this._markDirty(); this.renderEvents();
  },
  updateEvent(id, key, value) {
    // Use String() comparison — API returns numeric IDs, client uses string IDs
    const e = this.data.events.find(e => String(e.id) === String(id));
    if (e) { e[key] = value; this._markDirty(); }
  },

  toggleParticipant(eventId, charId, checked) {
    // String comparison to handle both API (numeric) and client (string) IDs
    const e = this.data.events.find(e => String(e.id) === String(eventId));
    if (!e) return;
    if (!e.participant_ids) e.participant_ids = [];
    const numId = Number(charId);
    if (checked) {
      if (!e.participant_ids.includes(numId)) e.participant_ids.push(numId);
    } else {
      e.participant_ids = e.participant_ids.filter(id => id !== numId);
    }
    this._markDirty();
    this.renderEvents();
  },

  async dismissSharedEvent(eventId, charId) {
    if (!confirm('Usunąć to wydarzenie ze swojego profilu?\nWydarzenie pozostanie u właściciela.')) return;
    try {
      const token = localStorage.getItem('ww_token') || '';
      const res = await fetch(
        (window.PROXY||'') + '/events/' + eventId + '/participants/' + charId,
        { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      this._sharedEvents = this._sharedEvents.filter(e => e.id !== eventId);
      this.renderEvents();
      this.renderSharedEvents();
    } catch(e) {
      alert('Błąd: ' + e.message);
    }
  },

  // ── Date formatting ───────────────────────────────────────────────────────
  formatDate(iso) {
    if (!iso) return '';
    if (!this.calendar?.enabled) return this._formatPlain(iso);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const [, year, month, day] = m;
    const monthName = this.calendar.month_names[parseInt(month) - 1] || month;
    const altYear = parseInt(year) + (this.calendar.year_offset || 0);
    const suffix = this.calendar.era_suffix ? ' ' + this.calendar.era_suffix : '';
    return `${parseInt(day)} ${monthName} ${altYear}${suffix}`;
  },
  _formatPlain(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
  },

  _visLabel(vis) {
    if (vis === 'public')   return '🌐 Gildyjne';
    if (vis === 'house')    return '⚜ Ród';
    if (vis === 'personal') return '🔒 Osobiste';
    return vis;
  },

  // ── Rendering ─────────────────────────────────────────────────────────────
  render() {
    const d = this.data;
    const root = document.getElementById('meta-form');
    if (!root) return;

    const birthdayFormatted = d.birthday ? this.formatDate(d.birthday) : '';
    const birthdayPlain = d.birthday ? this._formatPlain(d.birthday) : '';
    const birthdayHint = birthdayFormatted && birthdayFormatted !== d.birthday
      ? `→ ${birthdayFormatted} (${birthdayPlain})`
      : (birthdayPlain ? `→ ${birthdayPlain}` : '');

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
            <label>Data urodzin</label>
            <input type="date" value="${this._esc(d.birthday||'')}"
              oninput="MetaEditor.setField('birthday',this.value);MetaEditor.renderBirthday()">
            <div id="meta-birthday-display" class="meta-hint" style="margin-top:4px;color:var(--gold);">
              ${birthdayHint}
            </div>
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
          Moje wydarzenia
          <button class="meta-add-btn" onclick="MetaEditor.addEvent()">＋ Dodaj wydarzenie</button>
        </div>
        <div class="meta-hint" style="margin-bottom:0.8rem;">
          🌐 <strong>Gildyjne</strong> — zawsze widoczne na osi czasu &nbsp;·&nbsp;
          ⚜ <strong>Ród</strong> — widoczne przy filtrze rodu &nbsp;·&nbsp;
          🔒 <strong>Osobiste</strong> — widoczne przy filtrze postaci
        </div>
        <div id="meta-events-list"></div>
      </div>

      <div class="meta-section" id="meta-shared-section" style="${this._sharedEvents.length ? '' : 'display:none;'}">
        <div class="meta-section-title" style="color:var(--text-d);">Tagowana w wydarzeniach</div>
        <div id="meta-shared-events-list"></div>
      </div>
    `;

    this.renderQuotes();
    this.renderHooks();
    this.renderEvents();
    this.renderSharedEvents();
  },

  renderQuotes() {
    const el = document.getElementById('meta-quotes-list');
    if (!el) return;
    if (!this.data.quotes.length) {
      el.innerHTML = '<div class="meta-empty">Brak cytatów.</div>'; return;
    }
    el.innerHTML = this.data.quotes.map(q => `
      <div class="meta-item">
        <div class="meta-item-header">
          <button class="meta-feature-btn ${this.data.featured_quote_id === q.id ? 'active' : ''}"
            onclick="MetaEditor.setFeaturedQuote('${q.id}')" title="Wyróżnij w galerii">★</button>
          <span class="meta-item-label">${this.data.featured_quote_id === q.id ? 'Wyróżniony cytat' : 'Cytat'}</span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeQuote('${q.id}')">✕</button>
        </div>
        <textarea rows="2" placeholder="Treść cytatu..."
          oninput="MetaEditor.updateQuote('${q.id}','text',this.value)">${this._esc(q.text||'')}</textarea>
        <input type="text" placeholder="Źródło / kontekst" value="${this._esc(q.source||'')}"
          oninput="MetaEditor.updateQuote('${q.id}','source',this.value)">
      </div>
    `).join('');
  },

  renderHooks() {
    const el = document.getElementById('meta-hooks-list');
    if (!el) return;
    if (!this.data.story_hooks.length) {
      el.innerHTML = '<div class="meta-empty">Brak wątków.</div>'; return;
    }
    el.innerHTML = this.data.story_hooks.map(h => `
      <div class="meta-item">
        <div class="meta-item-header">
          <span class="meta-item-label">Wątek</span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeHook('${h.id}')">✕</button>
        </div>
        <input type="text" placeholder="Tytuł wątku..." value="${this._esc(h.title||'')}"
          oninput="MetaEditor.updateHook('${h.id}','title',this.value)">
        <textarea rows="3" placeholder="Opis wątku..."
          oninput="MetaEditor.updateHook('${h.id}','description',this.value)">${this._esc(h.description||'')}</textarea>
      </div>
    `).join('');
  },

  renderEvents() {
    const el = document.getElementById('meta-events-list');
    if (!el) return;
    if (!this.data.events.length) {
      el.innerHTML = '<div class="meta-empty">Brak wydarzeń.</div>'; return;
    }

    const sorted = [...this.data.events].sort((a, b) => (a.date||'').localeCompare(b.date||''));

    el.innerHTML = sorted.map(e => {
      const altDate = e.date && this.calendar?.enabled ? this.formatDate(e.date) : '';
      const vis = e.visibility || 'public';
      // Ensure participant_ids contains numbers for comparison
      const participantIds = (e.participant_ids || []).map(Number);

      // Participant chips — selected chars first, then unselected
      const selectedChars   = this._allChars.filter(c => participantIds.includes(Number(c.id)));
      const unselectedChars = this._allChars.filter(c => !participantIds.includes(Number(c.id)));

      const selectedChips = selectedChars.map(c => `
        <button type="button" class="participant-chip participant-chip-on"
          onclick="MetaEditor.toggleParticipant('${e.id}',${c.id},false)">
          ${this._esc(c.name)} ✕
        </button>`).join('');

      const unselectedChips = unselectedChars.map(c => `
        <button type="button" class="participant-chip participant-chip-off"
          onclick="MetaEditor.toggleParticipant('${e.id}',${c.id},true)">
          + ${this._esc(c.name)}
        </button>`).join('');

      const participantSection = this._allChars.length ? `
        <div class="participant-picker">
          <div class="participant-picker-label">
            Uczestnicy${participantIds.length ? ` (${participantIds.length})` : ''}:
          </div>
          <div class="participant-chips">
            ${selectedChips || ''}
            ${unselectedChips || ''}
          </div>
        </div>` : '';

      return `
      <div class="meta-item">
        <div class="meta-item-header">
          <span class="meta-item-label">
            ${e.category ? `<span class="event-cat-badge">${this._esc(e.category)}</span>` : ''}
            Wydarzenie
            ${altDate ? `<span class="meta-alt-date">${this._esc(altDate)}</span>` : ''}
          </span>
          <button class="meta-remove-btn" onclick="MetaEditor.removeEvent('${e.id}')">✕</button>
        </div>
        <div class="meta-event-row">
          <input type="date" value="${this._esc(e.date||'')}"
            oninput="MetaEditor.updateEvent('${e.id}','date',this.value);MetaEditor.renderEvents()">
          <input type="text" placeholder="Tytuł wydarzenia..." value="${this._esc(e.title||'')}"
            oninput="MetaEditor.updateEvent('${e.id}','title',this.value)" style="flex:2;">
        </div>
        <div class="meta-event-row" style="margin-top:6px;">
          <select onchange="MetaEditor.updateEvent('${e.id}','category',this.value)"
            style="flex:1;background:var(--bg3,#1c2330);border:1px solid var(--border,rgba(120,160,200,0.2));
                   border-radius:3px;color:var(--text,#d8e4ee);font-family:'Crimson Pro',serif;
                   font-size:0.88rem;padding:6px 10px;outline:none;cursor:pointer;">
            ${['', ...this._categories].map(c =>
              `<option value="${this._esc(c)}" ${(e.category||'')===(c)?'selected':''}>${c || '— kategoria —'}</option>`
            ).join('')}
          </select>
          <select onchange="MetaEditor.updateEvent('${e.id}','visibility',this.value)"
            style="flex:1;background:var(--bg3,#1c2330);border:1px solid var(--border,rgba(120,160,200,0.2));
                   border-radius:3px;color:var(--text,#d8e4ee);font-family:'Crimson Pro',serif;
                   font-size:0.88rem;padding:6px 10px;outline:none;cursor:pointer;">
            <option value="public"   ${vis==='public'   ?'selected':''}>🌐 Gildyjne</option>
            <option value="house"    ${vis==='house'    ?'selected':''}>⚜ Ród</option>
            <option value="personal" ${vis==='personal' ?'selected':''}>🔒 Osobiste</option>
          </select>
        </div>
        ${participantSection}
        <textarea rows="3" placeholder="Opis wydarzenia..."
          oninput="MetaEditor.updateEvent('${e.id}','description',this.value)">${this._esc(e.description||'')}</textarea>
      </div>`;
    }).join('');
  },

  renderSharedEvents() {
    const section = document.getElementById('meta-shared-section');
    const el = document.getElementById('meta-shared-events-list');
    if (!section || !el) return;

    section.style.display = this._sharedEvents.length ? '' : 'none';
    if (!this._sharedEvents.length) return;

    el.innerHTML = this._sharedEvents.map(e => {
      const altDate = e.date && this.calendar?.enabled ? this.formatDate(e.date) : '';
      const plain = this._formatPlain(e.date);
      const catBadge = e.category
        ? `<span class="event-cat-badge">${this._esc(e.category)}</span>` : '';
      return `
      <div class="meta-item" style="border-left:3px solid var(--border-h);opacity:0.85;">
        <div class="meta-item-header">
          <span class="meta-item-label" style="color:var(--text-d);">
            ${catBadge} od <strong>${this._esc(e.character_name||'?')}</strong>
            ${altDate ? `· <span style="color:var(--gold)">${this._esc(altDate)}</span>` : plain ? `· ${this._esc(plain)}` : ''}
          </span>
          <button class="meta-remove-btn" style="font-size:0.7rem;"
            onclick="MetaEditor.dismissSharedEvent(${e.id},${this._charId})"
            title="Usuń z profilu">✕ Usuń</button>
        </div>
        <div style="font-size:0.95rem;color:var(--text);margin-top:4px;">
          <strong>${this._esc(e.title)}</strong>
        </div>
        ${e.description ? `<div style="font-size:0.88rem;color:var(--text-d);margin-top:4px;">${this._esc(e.description)}</div>` : ''}
      </div>`;
    }).join('');
  },

  _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};
