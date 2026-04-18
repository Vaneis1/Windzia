// houses.js — House CRUD + modal picker for assigning houses to characters
const Houses = {
  all: [],
  _modalCharId: null,

  async loadAll() {
    try {
      const data = await API.get('/houses');
      if (Array.isArray(data)) this.all = data;
    } catch (e) {
      console.error('Houses.loadAll:', e.message);
    }
    return this.all;
  },

  // ── Admin tab ─────────────────────────────────────────────────────────────
  async renderAdminTab() {
    const wrap = document.getElementById('atab-houses');
    if (!wrap) return;
    await this.loadAll();

    const listHtml = this.all.length
      ? this.all.map(h => `
          <div class="house-row">
            <div class="house-dot-lg" style="background:${h.color}"></div>
            <div class="house-info">
              <div class="house-name">${h.heraldry ? h.heraldry + ' ' : ''}${this._esc(h.name)}</div>
              ${h.description ? `<div class="house-desc">${this._esc(h.description)}</div>` : ''}
            </div>
            <div class="house-actions">
              <button class="sm" onclick="Houses._openEdit(${h.id})">✎ Edytuj</button>
              <button class="sm danger" onclick="Houses._delete(${h.id}, '${h.name.replace(/'/g, "\\'")}')">Usuń</button>
            </div>
          </div>`).join('')
      : '<div class="empty-msg">Brak rodów. Dodaj pierwszy poniżej.</div>';

    wrap.innerHTML = `
      <div id="houses-list" style="margin-bottom:1.2rem;">${listHtml}</div>
      <div class="admin-label">Dodaj ród</div>
      <div class="panel">
        <div class="row2">
          <div class="field">
            <label>Nazwa rodu</label>
            <input type="text" id="new-house-name" placeholder="np. Ród Królika">
          </div>
          <div class="field">
            <label>Kolor herbu</label>
            <input type="color" id="new-house-color" value="#c9a45c"
              style="height:38px;width:100%;padding:2px 4px;background:var(--bg3);
                     border:1px solid var(--border);border-radius:3px;cursor:pointer;">
          </div>
        </div>
        <div class="field" style="margin-top:0.8rem;">
          <label>Herb / emoji (opcjonalnie)</label>
          <input type="text" id="new-house-heraldry" placeholder="np. 🐇">
        </div>
        <div class="field" style="margin-top:0.8rem;">
          <label>Opis (opcjonalnie)</label>
          <textarea id="new-house-desc" rows="2" placeholder="Krótki opis rodu..."></textarea>
        </div>
        <div class="btn-row">
          <button class="primary warn-btn" onclick="Houses._create()">+ Dodaj ród</button>
        </div>
        <div class="msg ok"  id="house-ok"></div>
        <div class="msg err" id="house-err"></div>
      </div>`;
  },

  async _create() {
    const name = document.getElementById('new-house-name')?.value.trim();
    if (!name) { UI.err('house-ok', 'house-err', 'Podaj nazwę rodu'); return; }
    UI.clearMsg('house-ok', 'house-err');
    try {
      const res = await API.post('/houses', {
        name,
        color:       document.getElementById('new-house-color')?.value || '#c9a45c',
        heraldry:    document.getElementById('new-house-heraldry')?.value.trim() || '',
        description: document.getElementById('new-house-desc')?.value.trim() || '',
      });
      if (res.error) throw new Error(res.error);
      UI.ok('house-ok', 'house-err', `Dodano ród „${name}".`);
      document.getElementById('new-house-name').value     = '';
      document.getElementById('new-house-heraldry').value = '';
      document.getElementById('new-house-desc').value     = '';
      await this.renderAdminTab();
    } catch (e) {
      UI.err('house-ok', 'house-err', 'Błąd: ' + e.message);
    }
  },

  async _delete(id, name) {
    if (!confirm(`Usunąć ród „${name}"?\nZostanie odłączony od wszystkich postaci.`)) return;
    try {
      const res = await API.delete('/houses/' + id);
      if (res.error) throw new Error(res.error);
      await this.renderAdminTab();
    } catch (e) {
      alert('Błąd: ' + e.message);
    }
  },

  _openEdit(id) {
    const h = this.all.find(x => x.id === id);
    if (!h) return;
    document.getElementById('edit-house-id').value       = h.id;
    document.getElementById('edit-house-name').value     = h.name;
    document.getElementById('edit-house-color').value    = h.color;
    document.getElementById('edit-house-heraldry').value = h.heraldry || '';
    document.getElementById('edit-house-desc').value     = h.description || '';
    document.getElementById('house-edit-overlay').classList.add('open');
  },

  closeEdit() {
    document.getElementById('house-edit-overlay').classList.remove('open');
  },

  async saveEdit() {
    const id = parseInt(document.getElementById('edit-house-id').value);
    UI.clearMsg('house-edit-ok', 'house-edit-err');
    try {
      const res = await API.put('/houses/' + id, {
        name:        document.getElementById('edit-house-name').value.trim(),
        color:       document.getElementById('edit-house-color').value,
        heraldry:    document.getElementById('edit-house-heraldry').value.trim(),
        description: document.getElementById('edit-house-desc').value.trim(),
      });
      if (res.error) throw new Error(res.error);
      this.closeEdit();
      await this.renderAdminTab();
    } catch (e) {
      UI.err('house-edit-ok', 'house-edit-err', 'Błąd: ' + e.message);
    }
  },

  // ── Character house picker modal ──────────────────────────────────────────
  async openModal(charId, currentIds) {
    this._modalCharId = charId;
    await this.loadAll();
    const list = document.getElementById('house-picker-list');
    if (!list) return;
    UI.clearMsg('house-modal-ok', 'house-modal-err');

    if (!this.all.length) {
      list.innerHTML = '<p style="color:var(--text-m);font-style:italic;padding:0.5rem;">Brak rodów. Admin może dodać rody w panelu → Rody.</p>';
    } else {
      list.innerHTML = '';
      this.all.forEach(h => {
        const checked = currentIds.includes(h.id);
        const row = document.createElement('label');
        row.className = 'house-pick-row';
        row.innerHTML = `
          <input type="checkbox" value="${h.id}" ${checked ? 'checked' : ''}
            style="accent-color:${h.color};cursor:pointer;width:16px;height:16px;">
          <span class="house-dot" style="background:${h.color}"></span>
          <span style="flex:1;">${h.heraldry ? h.heraldry + ' ' : ''}${this._esc(h.name)}</span>
          ${h.description ? `<span style="font-size:0.78rem;color:var(--text-m);font-style:italic;">${this._esc(h.description)}</span>` : ''}`;
        list.appendChild(row);
      });
    }
    document.getElementById('house-picker-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('house-picker-overlay').classList.remove('open');
  },

  async saveModal() {
    const list     = document.getElementById('house-picker-list');
    const checked  = Array.from(list.querySelectorAll('input:checked'));
    const houseIds = checked.map(i => parseInt(i.value));

    if (houseIds.length > 2) {
      UI.err('house-modal-ok', 'house-modal-err', 'Maksymalnie 2 rody na postać.');
      return;
    }
    UI.clearMsg('house-modal-ok', 'house-modal-err');
    try {
      const res = await API.put(`/characters/${this._modalCharId}/houses`, { house_ids: houseIds });
      if (res.error) throw new Error(res.error);
      this.closeModal();
      await Characters.load();
    } catch (e) {
      UI.err('house-modal-ok', 'house-modal-err', 'Błąd: ' + e.message);
    }
  },

  _esc(s) {
    return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};
