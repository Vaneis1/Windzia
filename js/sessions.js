// sessions.js — Campaigns and sessions module.
const Sessions = {
  sessions: [],
  campaigns: [],
  characters: [],
  _lastLoaded: 0,
  _TTL: 3 * 60 * 1000,

  // Current modal state
  _editId: null,       // null = new, number = edit

  async loadCached() {
    if (Date.now() - this._lastLoaded < this._TTL) {
      this._render();
      return;
    }
    await this.load();
  },

  async load() {
    const status = document.getElementById('sessions-status');
    if (status) status.textContent = 'Ładowanie...';
    try {
      const [sessions, campaigns, chars] = await Promise.all([
        API.get('/sessions'),
        API.get('/campaigns'),
        API.get('/characters'),
      ]);
      this.sessions  = Array.isArray(sessions)  ? sessions  : [];
      this.campaigns = Array.isArray(campaigns) ? campaigns : [];
      this.characters = Array.isArray(chars)    ? chars     : [];
      this._lastLoaded = Date.now();
      if (status) status.textContent = '';
      this._render();
    } catch(e) {
      if (status) status.textContent = 'Błąd: ' + e.message;
    }
  },

  _invalidate() { this._lastLoaded = 0; },

  // ── Labels ────────────────────────────────────────────────────────────────
  _statusLabel(s) {
    return { recruiting: 'Nabór', ongoing: 'W trakcie', ended: 'Zakończona' }[s] || s;
  },
  _statusClass(s) {
    return { recruiting: 'sess-chip-recruiting', ongoing: 'sess-chip-ongoing', ended: 'sess-chip-ended' }[s] || '';
  },
  _riskLabel(r) {
    return { low: 'Niskie', moderate: 'Umiarkowane', high: 'Wysokie', extreme: 'Ekstremalne' }[r] || r;
  },
  _riskClass(r) {
    return { low: 'sess-risk-low', moderate: 'sess-risk-moderate', high: 'sess-risk-high', extreme: 'sess-risk-extreme' }[r] || '';
  },
  _scopeLabel(s) {
    return { intimate: 'Intymna', local: 'Lokalna', global: 'Globalna' }[s] || s;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const wrap = document.getElementById('sessions-list');
    if (!wrap) return;

    if (!this.sessions.length) {
      wrap.innerHTML = `<div class="tl-empty">
        <div style="font-size:2rem;margin-bottom:1rem;opacity:0.25;">⚔</div>
        Brak sesji. Kliknij <strong>＋ Nowa sesja</strong> aby dodać pierwszą.
      </div>`;
      return;
    }

    // Group by status order: recruiting → ongoing → ended
    const groups = [
      { key: 'recruiting', label: 'Nabór' },
      { key: 'ongoing',    label: 'W trakcie' },
      { key: 'ended',      label: 'Zakończone' },
    ];

    let html = '';
    groups.forEach(g => {
      const group = this.sessions.filter(s => s.status === g.key);
      if (!group.length) return;
      html += `<div class="sess-group">
        <div class="sess-group-label">${g.label} (${group.length})</div>
        ${group.map(s => this._renderCard(s)).join('')}
      </div>`;
    });

    wrap.innerHTML = html;
  },

  _renderCard(s) {
    const isOwner = State.currentUser &&
      (State.currentUser.role === 'admin' || State.currentUser.id === s.created_by);

    const charAvatars = (s.character_participants || []).map(p => {
      return p.avatar
        ? `<img class="tl-avatar tl-avatar-sm" src="${this._esc(p.avatar)}" title="${this._esc(p.name)}">`
        : `<div class="tl-avatar tl-avatar-sm tl-avatar-placeholder" title="${this._esc(p.name)}">${(p.name[0]||'?').toUpperCase()}</div>`;
    }).join('');

    const npcBadges = (s.npc_participants || []).map(n =>
      `<span class="sess-npc-badge">${this._esc(n)}</span>`
    ).join('');

    const dateStr = s.date_start
      ? (s.date_end ? `${s.date_start} → ${s.date_end}` : `od ${s.date_start}`)
      : '';

    const campaignBadge = s.campaign_name
      ? `<span class="sess-campaign-badge">📜 ${this._esc(s.campaign_name)}</span>` : '';

    return `<div class="sess-card">
      <div class="sess-card-header">
        <div class="sess-card-title">${this._esc(s.title)}</div>
        <div class="sess-card-chips">
          <span class="sess-chip ${this._statusClass(s.status)}">${this._statusLabel(s.status)}</span>
          <span class="sess-chip ${this._riskClass(s.risk)}">⚠ ${this._riskLabel(s.risk)}</span>
          <span class="sess-chip sess-chip-scope">◎ ${this._scopeLabel(s.scope)}</span>
        </div>
      </div>
      ${campaignBadge || dateStr ? `<div class="sess-card-meta">
        ${campaignBadge}
        ${dateStr ? `<span class="sess-date">📅 ${this._esc(dateStr)}</span>` : ''}
      </div>` : ''}
      ${s.description ? `<div class="sess-card-desc">${this._esc(s.description.slice(0, 200))}${s.description.length > 200 ? '…' : ''}</div>` : ''}
      ${charAvatars || npcBadges ? `<div class="sess-participants">
        <span class="tl-participants-label">Uczestnicy:</span>
        <div class="sess-participants-inner">${charAvatars}${npcBadges}</div>
      </div>` : ''}
      <div class="sess-card-footer">
        <span class="sess-creator">dodał/a ${this._esc(s.creator_display)}</span>
        ${isOwner ? `<div class="sess-card-actions">
          <button class="sm warn-btn" onclick="Sessions.openModal(${s.id})">✎ Edytuj</button>
          <button class="danger sm" onclick="Sessions.deleteSession(${s.id}, '${this._esc(s.title).replace(/'/g, "\\'")}')">✕</button>
        </div>` : ''}
      </div>
    </div>`;
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  openModal(sessionId = null) {
    this._editId = sessionId;

    const title = document.getElementById('sess-modal-title');
    if (title) title.textContent = sessionId ? 'Edytuj sesję' : 'Nowa sesja';

    // Populate campaign select
    this._renderCampaignSelect();

    // Populate character picker
    this._renderCharPicker([]);

    if (sessionId) {
      const s = this.sessions.find(x => x.id === sessionId);
      if (!s) return;
      document.getElementById('sess-f-title').value       = s.title;
      document.getElementById('sess-f-desc').value        = s.description || '';
      document.getElementById('sess-f-date-start').value  = s.date_start || '';
      document.getElementById('sess-f-date-end').value    = s.date_end   || '';
      document.getElementById('sess-f-new-campaign').value = '';

      // Set campaign select
      const campSel = document.getElementById('sess-f-campaign');
      if (campSel) campSel.value = s.campaign_id || '';

      // Set chips
      this._setChip('sess-status', s.status);
      this._setChip('sess-risk',   s.risk);
      this._setChip('sess-scope',  s.scope);

      // Set characters
      const charIds = (s.character_participants || []).map(p => p.character_id);
      this._renderCharPicker(charIds);

      // Set NPCs
      document.getElementById('sess-f-npcs').value =
        (s.npc_participants || []).join(', ');
    } else {
      // Defaults for new
      document.getElementById('sess-f-title').value       = '';
      document.getElementById('sess-f-desc').value        = '';
      document.getElementById('sess-f-date-start').value  = '';
      document.getElementById('sess-f-date-end').value    = '';
      document.getElementById('sess-f-new-campaign').value = '';
      document.getElementById('sess-f-npcs').value        = '';
      this._setChip('sess-status', 'recruiting');
      this._setChip('sess-risk',   'low');
      this._setChip('sess-scope',  'local');
    }

    document.getElementById('sess-modal-err').textContent = '';
    document.getElementById('sess-modal-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('sess-modal-overlay')?.classList.remove('open');
  },

  _renderCampaignSelect() {
    const sel = document.getElementById('sess-f-campaign');
    if (!sel) return;
    sel.innerHTML = '<option value="">— bez kampanii —</option>' +
      this.campaigns.map(c =>
        `<option value="${c.id}">${this._esc(c.name)}${c.status === 'ended' ? ' (zakończona)' : ''}</option>`
      ).join('');
  },

  _renderCharPicker(selectedIds) {
    const wrap = document.getElementById('sess-char-picker');
    if (!wrap) return;
    wrap.innerHTML = this.characters.map(c => {
      const checked = selectedIds.includes(c.id);
      return `<label class="char-pick-row">
        <input type="checkbox" value="${c.id}" ${checked ? 'checked' : ''}>
        <span><strong>${this._esc(c.name)}</strong>
          <span style="color:var(--text-m);font-size:0.78rem;"> ${this._esc(c.owner_username || '')}</span>
        </span>
      </label>`;
    }).join('');
  },

  _setChip(groupId, value) {
    document.querySelectorAll(`[data-chip-group="${groupId}"]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chipValue === value);
    });
  },

  _getChip(groupId) {
    const active = document.querySelector(`[data-chip-group="${groupId}"].active`);
    return active?.dataset.chipValue || '';
  },

  toggleChip(groupId, value) {
    this._setChip(groupId, value);
  },

  toggleNewCampaign() {
    const sel = document.getElementById('sess-f-campaign');
    const wrap = document.getElementById('sess-new-campaign-wrap');
    if (!wrap) return;
    const show = sel?.value === '__new__';
    wrap.style.display = show ? 'block' : 'none';
  },

  async save() {
    const title = document.getElementById('sess-f-title')?.value.trim();
    if (!title) {
      document.getElementById('sess-modal-err').textContent = 'Podaj tytuł sesji.';
      return;
    }

    const campSel = document.getElementById('sess-f-campaign');
    const campaignId = (campSel?.value && campSel.value !== '__new__')
      ? parseInt(campSel.value) : null;
    const newCampaignName = document.getElementById('sess-f-new-campaign')?.value.trim() || '';

    const charIds = Array.from(
      document.querySelectorAll('#sess-char-picker input:checked')
    ).map(el => parseInt(el.value));

    const npcRaw = document.getElementById('sess-f-npcs')?.value || '';
    const npcNames = npcRaw.split(',').map(n => n.trim()).filter(Boolean);

    const payload = {
      title,
      description: document.getElementById('sess-f-desc')?.value.trim() || '',
      campaign_id: campaignId,
      new_campaign_name: newCampaignName,
      date_start: document.getElementById('sess-f-date-start')?.value || '',
      date_end:   document.getElementById('sess-f-date-end')?.value   || '',
      status: this._getChip('sess-status') || 'recruiting',
      risk:   this._getChip('sess-risk')   || 'low',
      scope:  this._getChip('sess-scope')  || 'local',
      character_ids: charIds,
      npc_names: npcNames,
    };

    const saveBtn = document.getElementById('sess-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Zapisywanie...'; }

    try {
      let data;
      if (this._editId) {
        data = await API.put('/sessions/' + this._editId, payload);
      } else {
        data = await API.post('/sessions', payload);
      }
      if (data.error) throw new Error(data.error);
      this.closeModal();
      this._invalidate();
      await this.load();
    } catch(e) {
      document.getElementById('sess-modal-err').textContent = 'Błąd: ' + e.message;
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zapisz'; }
    }
  },

  async deleteSession(id, title) {
    if (!confirm(`Usunąć sesję „${title}"?`)) return;
    try {
      const data = await API.delete('/sessions/' + id);
      if (data.error) throw new Error(data.error);
      this._invalidate();
      await this.load();
    } catch(e) {
      alert('Błąd: ' + e.message);
    }
  },

  _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};
