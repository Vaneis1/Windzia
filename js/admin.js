// admin.js — Admin panel: owners, items, inventory editing, profile settings.
const Admin = {
  activeTab: 'owners',

  async load() {
    if (State.currentUser?.role !== 'admin') return;
    await Promise.all([this.loadOwners(), this.loadItems()]);
    await Characters.load();
  },

  switchTab(name) {
    this.activeTab = name;
    ['owners', 'items', 'inventory', 'calendar', 'profile', 'houses'].forEach(t => {
      document.getElementById('atab-' + t)?.classList.toggle('active', t === name);
    });
    document.querySelectorAll('.admin-tab').forEach((el, i) => {
      el.classList.toggle('active', ['owners', 'items', 'inventory', 'calendar', 'profile', 'houses'][i] === name);
    });
  },

  _ok(msg) {
    const el = document.getElementById('admin-ok');
    if (!el) return;
    el.textContent = msg; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  },
  _err(msg) {
    const el = document.getElementById('admin-err');
    if (!el) return;
    el.textContent = msg; el.style.display = 'block';
  },

  // ── Owners ───────────────────────────────────────────────────────────────
  async loadOwners() {
    try {
      const owners = await API.get('/admin/owners');
      if (!Array.isArray(owners)) throw new Error(owners?.error || 'Błąd serwera');
      this._renderOwners(owners);
    } catch (e) { this._err('Błąd ładowania użytkowników: ' + e.message); }
  },

  _renderOwners(owners) {
    const el = document.getElementById('owners-list');
    if (!el) return;
    el.innerHTML = '';
    owners.forEach(o => {
      const row = document.createElement('div');
      row.className = 'owner-row';
      row.innerHTML = `
        <div class="owner-info">
          <div class="owner-name">
            ${o.display_name || o.username}
            <span style="font-size:0.72rem;color:var(--warn-t);margin-left:6px;">
              ${o.display_role || o.role}
            </span>
          </div>
          <div class="owner-meta">${o.email} · ${o.character_count} postaci</div>
        </div>
        <div class="owner-actions">
          <button class="sm warn-btn"
            onclick="Admin.resetPassword(${o.id}, '${(o.display_name||o.username).replace(/'/g,"\\'")}')">
            Reset hasła
          </button>
          <button class="danger sm"
            onclick="Admin.deleteOwner(${o.id}, '${(o.display_name||o.username).replace(/'/g,"\\'")}')">
            Usuń
          </button>
        </div>`;
      el.appendChild(row);
    });
  },

  async createOwner() {
    const username = document.getElementById('new-owner-username')?.value.trim();
    const email = document.getElementById('new-owner-email')?.value.trim();
    const password = document.getElementById('new-owner-pwd')?.value;
    const role = document.getElementById('new-owner-role')?.value;
    if (!username || !email || !password) { this._err('Wypełnij wszystkie pola.'); return; }
    try {
      const data = await API.post('/admin/owners', { username, email, password, role });
      if (data.error) throw new Error(data.error);
      this._ok(`Konto „${username}" utworzone.`);
      document.getElementById('new-owner-username').value = '';
      document.getElementById('new-owner-email').value = '';
      document.getElementById('new-owner-pwd').value = '';
      await this.loadOwners();
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  async resetPassword(id, name) {
    const pwd = prompt(`Nowe hasło dla „${name}" (min. 6 znaków):`);
    if (!pwd || pwd.length < 6) { if (pwd !== null) alert('Hasło za krótkie.'); return; }
    try {
      const data = await API.put(`/admin/owners/${id}/reset-password`, { password: pwd });
      if (data.error) throw new Error(data.error);
      this._ok(`Hasło zmienione dla „${name}".`);
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  async deleteOwner(id, name) {
    if (!confirm(`Usunąć użytkownika „${name}" i wszystkie jego dane?`)) return;
    try {
      const data = await API.delete('/admin/owners/' + id);
      if (data.error) throw new Error(data.error);
      this._ok(`Usunięto „${name}".`);
      await this.loadOwners();
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  // ── Items ────────────────────────────────────────────────────────────────
  async loadItems() {
    try {
      const items = await API.get('/items');
      if (!Array.isArray(items)) throw new Error('Błąd serwera');
      State.allItemsAdmin = items;

      const cats = [...new Set(items.map(i => i.category))].sort();

      // Populate filter select
      const filterSel = document.getElementById('item-cat-filter');
      if (filterSel) {
        filterSel.innerHTML = '<option value="">Wszystkie kategorie</option>';
        cats.forEach(c => {
          const o = document.createElement('option');
          o.value = c; o.textContent = c;
          filterSel.appendChild(o);
        });
      }

      // Populate new item category select
      const catSel = document.getElementById('new-item-cat-select');
      if (catSel) {
        catSel.innerHTML = '<option value="">— wybierz kategorię —</option>';
        cats.forEach(c => {
          const o = document.createElement('option');
          o.value = c; o.textContent = c;
          catSel.appendChild(o);
        });
        catSel.innerHTML += '<option value="__new__">+ Dodaj nową kategorię</option>';
      }

      this._renderItems();
    } catch (e) { this._err('Błąd ładowania surowców: ' + e.message); }
  },

  _renderItems() {
    const query = (document.getElementById('item-search')?.value || '').toLowerCase();
    const cat = document.getElementById('item-cat-filter')?.value || '';
    let items = State.allItemsAdmin;
    if (query) items = items.filter(i =>
      i.name.toLowerCase().includes(query) ||
      (i.aliases || []).some(a => a.toLowerCase().includes(query))
    );
    if (cat) items = items.filter(i => i.category === cat);

    const el = document.getElementById('items-list');
    if (!el) return;
    el.innerHTML = '';

    if (!items.length) {
      el.innerHTML = '<p style="padding:1rem;color:var(--text-m);font-style:italic;">Brak wyników.</p>';
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const aliases = (item.aliases || []).join(', ') || '—';
      const tags = (item.tags || []).map(t => '#' + t).join(' ') || '—';
      const unit = item.unit ? ' · jednostka: ' + item.unit : '';
      row.innerHTML = `
        <div class="item-info">
          <div>${item.name}</div>
          <div class="item-cat">${item.category} · aliasy: ${aliases} · tagi: ${tags}${unit}</div>
        </div>
        <div class="item-actions">
          <button class="sm warn-btn"
            onclick="Admin.editItem(${item.id})">
            Edytuj
          </button>
          <button class="danger sm"
            onclick="Admin.deleteItem(${item.id}, '${item.name.replace(/'/g,"\\'")}')">
            Usuń
          </button>
        </div>`;
      el.appendChild(row);
    });
  },

  onCatSelectChange() {
    const sel = document.getElementById('new-item-cat-select');
    const customWrap = document.getElementById('new-item-cat-custom-wrap');
    if (!sel || !customWrap) return;
    customWrap.style.display = sel.value === '__new__' ? 'block' : 'none';
  },

  _getSelectedCategory() {
    const sel = document.getElementById('new-item-cat-select');
    if (sel?.value === '__new__') {
      return (document.getElementById('new-item-cat-custom')?.value || '').trim().toUpperCase();
    }
    return sel?.value || '';
  },

  editItem(id) {
    const item = State.allItemsAdmin.find(i => i.id === id);
    if (!item) return;
    const overlay = document.getElementById('item-edit-overlay');
    document.getElementById('item-edit-title').textContent = 'Edytuj: ' + item.name;
    document.getElementById('item-edit-id').value = item.id;
    document.getElementById('item-edit-aliases').value = (item.aliases || []).join(', ');
    document.getElementById('item-edit-tags').value = (item.tags || []).join(', ');
    document.getElementById('item-edit-order').value = item.display_order || 0;
    document.getElementById('item-edit-unit').value = item.unit || '';
    overlay.classList.add('open');
  },

  closeItemEdit() {
    document.getElementById('item-edit-overlay')?.classList.remove('open');
  },

  async saveItemEdit() {
    const id = parseInt(document.getElementById('item-edit-id').value);
    const aliases = document.getElementById('item-edit-aliases').value.split(',').map(a => a.trim()).filter(Boolean);
    const tags = document.getElementById('item-edit-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    const display_order = parseInt(document.getElementById('item-edit-order').value) || 0;
    const unit = document.getElementById('item-edit-unit').value.trim();
    try {
      const data = await API.put('/items/' + id, { aliases, tags, display_order, unit });
      if (data.error) throw new Error(data.error);
      this._ok('Zaktualizowano surowiec.');
      this.closeItemEdit();
      await this.loadItems();
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  async createItem() {
    const name = document.getElementById('new-item-name')?.value.trim();
    const category = this._getSelectedCategory();
    const aliasStr = document.getElementById('new-item-aliases')?.value || '';
    const tagStr = document.getElementById('new-item-tags')?.value || '';
    const unit = document.getElementById('new-item-unit')?.value.trim() || '';
    const aliases = aliasStr.split(',').map(a => a.trim()).filter(Boolean);
    const tags = tagStr.split(',').map(t => t.trim()).filter(Boolean);
    if (!name || !category) { this._err('Podaj nazwę i kategorię.'); return; }
    try {
      const data = await API.post('/items', { name, category, aliases, tags, unit });
      if (data.error) throw new Error(data.error);
      this._ok(`Dodano „${name}".`);
      document.getElementById('new-item-name').value = '';
      document.getElementById('new-item-aliases').value = '';
      if (document.getElementById('new-item-tags')) document.getElementById('new-item-tags').value = '';
      if (document.getElementById('new-item-unit')) document.getElementById('new-item-unit').value = '';
      if (document.getElementById('new-item-cat-custom')) {
        document.getElementById('new-item-cat-custom').value = '';
      }
      await this.loadItems();
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  async deleteItem(id, name) {
    if (!confirm(`Usunąć surowiec „${name}"?`)) return;
    try {
      const data = await API.delete('/items/' + id);
      if (data.error) throw new Error(data.error);
      this._ok(`Usunięto „${name}".`);
      await this.loadItems();
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  // ── Inventory editing ────────────────────────────────────────────────────
  async loadInventory() {
    const cid = document.getElementById('admin-char-select')?.value;
    const wrap = document.getElementById('admin-inv-wrap');
    if (!wrap) return;
    if (!cid) { wrap.innerHTML = ''; return; }

    try {
      const data = await API.get('/inventory');
      if (data.error) throw new Error(data.error);
      const chars = data.characters || [];
      const items = data.items || [];
      const charItems = items.filter(i => (i.quantities[String(cid)] || 0) > 0);

      if (!charItems.length) {
        wrap.innerHTML = '<p style="color:var(--text-m);font-style:italic;padding:0.5rem;">Brak danych.</p>';
        return;
      }

      let html = `<div style="border:1px solid var(--warn-b);border-radius:4px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead><tr>
          <th style="background:rgba(133,80,160,0.15);color:var(--warn-t);font-family:'Cinzel',serif;
            font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;padding:7px 10px;
            text-align:left;border-bottom:1px solid var(--warn-b);">Przedmiot</th>
          <th style="background:rgba(133,80,160,0.15);color:var(--warn-t);font-family:'Cinzel',serif;
            font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;padding:7px 10px;
            text-align:right;border-bottom:1px solid var(--warn-b);width:90px;">Ilość</th>
          <th style="background:rgba(133,80,160,0.15);padding:7px 10px;
            border-bottom:1px solid var(--warn-b);width:60px;"></th>
        </tr></thead><tbody>`;

      charItems.sort((a, b) => a.name.localeCompare(b.name, 'pl')).forEach(item => {
        const qty = item.quantities[String(cid)];
        html += `<tr style="border-bottom:1px solid rgba(133,214,242,0.07);">
          <td style="padding:5px 10px;">${item.name}</td>
          <td class="num editable" style="padding:5px 10px;text-align:right;
            color:var(--gold-l);font-weight:300;cursor:pointer;position:relative;"
            onclick="Admin.editCell(${cid},${item.id},${qty},this)">${qty}</td>
          <td style="padding:5px 10px;text-align:right;">
            <button class="danger sm"
              onclick="Admin.deleteEntry(${cid},${item.id},this.closest('tr'))">✕</button>
          </td></tr>`;
      });

      html += '</tbody></table></div>';
      wrap.innerHTML = html;
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  editCell(cid, itemId, origVal, td) {
    if (td.querySelector('input')) return;
    td.innerHTML = `<input class="inline-edit" type="number" min="0" value="${origVal}"
      onblur="Admin.saveCell(${cid},${itemId},this,${origVal})"
      onkeydown="if(event.key==='Enter')this.blur();
        if(event.key==='Escape'){this.value=${origVal};this.blur();}">`;
    const inp = td.querySelector('input');
    inp.focus(); inp.select();
  },

  async saveCell(cid, itemId, input, origVal) {
    const newVal = parseInt(input.value);
    const td = input.parentElement;
    if (isNaN(newVal) || newVal === origVal) { td.textContent = origVal; return; }
    td.textContent = '…';
    try {
      const data = await API.put(`/admin/inventory/${cid}/${itemId}`, { quantity: newVal });
      if (data.error) throw new Error(data.error);
      td.textContent = newVal; this._ok('Zaktualizowano.');
    } catch (e) { td.textContent = origVal; this._err('Błąd: ' + e.message); }
  },

  async deleteEntry(cid, itemId, tr) {
    if (!confirm('Usunąć ten wpis?')) return;
    try {
      const data = await API.delete(`/admin/inventory/${cid}/${itemId}`);
      if (data.error) throw new Error(data.error);
      tr.remove(); this._ok('Usunięto.');
    } catch (e) { this._err('Błąd: ' + e.message); }
  },

  // ── Profile settings ─────────────────────────────────────────────────────
  loadProfile() {
    const u = State.currentUser;
    if (!u) return;
    const dn = document.getElementById('profile-display-name');
    const dr = document.getElementById('profile-display-role');
    if (dn) dn.value = u.display_name || '';
    if (dr) dr.value = u.display_role || '';
  },

  // ── Calendar ─────────────────────────────────────────────────────────────
  async loadCalendar() {
    try {
      const cal = await fetch(Config.PROXY + '/settings/calendar').then(r => r.json());
      document.getElementById('cal-enabled').checked = !!cal.enabled;
      document.getElementById('cal-months').value = (cal.month_names || []).join(', ');
      document.getElementById('cal-offset').value = cal.year_offset || 0;
      document.getElementById('cal-suffix').value = cal.era_suffix || '';
    } catch(e) { this._err('Błąd ładowania kalendarza: ' + e.message); }
  },

  async saveCalendar() {
    const enabled = document.getElementById('cal-enabled').checked;
    const months = document.getElementById('cal-months').value.split(',').map(m => m.trim()).filter(Boolean);
    const year_offset = parseInt(document.getElementById('cal-offset').value) || 0;
    const era_suffix = document.getElementById('cal-suffix').value.trim();
    if (months.length !== 12) { this._err('Musi być dokładnie 12 nazw miesięcy.'); return; }
    try {
      const data = await API.put('/settings/calendar', { enabled, month_names: months, year_offset, era_suffix });
      if (data.error) throw new Error(data.error);
      this._ok('Zapisano kalendarz.');
    } catch(e) { this._err('Błąd: ' + e.message); }
  },

  async saveProfile() {
    const display_name = document.getElementById('profile-display-name')?.value.trim() || '';
    const display_role = document.getElementById('profile-display-role')?.value.trim() || '';
    try {
      const data = await API.put('/auth/profile', { display_name, display_role });
      if (data.error) throw new Error(data.error);
      // Update local state
      State.currentUser.display_name = data.display_name;
      State.currentUser.display_role = data.display_role;
      // Update header display
      const ud = document.getElementById('user-display');
      if (ud) ud.textContent = data.display_name +
        (State.currentUser.role === 'admin' ? ` (${data.display_role})` : '');
      this._ok('Profil zaktualizowany.');
    } catch (e) { this._err('Błąd: ' + e.message); }
  },
};
