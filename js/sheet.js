// sheet.js — Inventory views: Mine / Item / Matrix.
const Sheet = {
  activeView: 'mine',

  // Shared state
  allTags: [],

  // Mine state
  mineData: null,
  mineCategory: '',
  mineSearch: '',

  // Item state
  itemSearch: '',
  itemSearchResults: [],
  selectedItemId: null,
  itemHolders: null,

  // Matrix state
  matrixData: null,
  matrixCategory: '',
  matrixTags: [],
  matrixCharIds: [],
  matrixSearch: '',
  matrixOnlyWithData: true,
  matrixSortCol: 0,
  matrixSortAsc: true,
  matrixVisibleStart: 0,
  matrixVisibleCount: 50,

  // ── Init / view switch ────────────────────────────────────────────────────
  async init() {
    await this.loadTags();
    this.switchView('mine');
  },

  async loadTags() {
    try {
      const tags = await API.get('/items/tags');
      this.allTags = Array.isArray(tags) ? tags : [];
    } catch(e) { this.allTags = []; }
  },

  switchView(view) {
    this.currentView = view;
    ['scan', 'mine', 'item', 'matrix'].forEach(v => {
      const el = document.getElementById('sheet-view-' + v);
      if (el) el.style.display = v === view ? '' : 'none';
    });
    document.querySelectorAll('.sheet-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    if (view === 'scan')   Scan.initDropZone();
    if (view === 'mine')   this.loadMine();
    if (view === 'item')   this.renderItemView();
    if (view === 'matrix') this.loadMatrix();
  },

  // ── Mine view ─────────────────────────────────────────────────────────────
  async loadMine() {
    UI.setStatus('mine-status', 'mine-spinner', 'Ładowanie...', true);
    try {
      const params = new URLSearchParams();
      if (this.mineCategory) params.set('category', this.mineCategory);
      if (this.mineSearch) params.set('q', this.mineSearch);
      params.set('scope', 'mine');
      params.set('only_with_data', '1');
      const data = await API.get('/inventory?' + params);
      if (data.error) throw new Error(data.error);
      this.mineData = data;
      this._renderCatFilter('mine-cat-filter', data.categories || [], this.mineCategory, c => {
        this.mineCategory = c; this.loadMine();
      });
      this._renderMine();
      UI.setStatus('mine-status', 'mine-spinner', '');
    } catch(e) {
      UI.setStatus('mine-status', 'mine-spinner', 'Błąd: ' + e.message);
    }
  },

  _renderMine() {
    if (!this.mineData) return;
    const { characters, items } = this.mineData;
    const empty = document.getElementById('mine-empty');
    const wrap = document.getElementById('mine-table-wrap');

    if (!characters.length) {
      empty.textContent = 'Nie masz jeszcze postaci. Dodaj postać w zakładce „Postacie".';
      empty.style.display = 'block';
      wrap.style.display = 'none';
      return;
    }
    if (!items.length) {
      empty.textContent = 'Brak surowców do wyświetlenia.';
      empty.style.display = 'block';
      wrap.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    wrap.style.display = 'block';
    this._renderTable('mine-head', 'mine-body', characters, items, false);
  },

  // ── Item view (lookup) ────────────────────────────────────────────────────
  renderItemView() {
    const box = document.getElementById('item-search-box');
    if (box && !box.dataset.bound) {
      box.dataset.bound = '1';
      let timeout;
      box.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this._itemSearchInput(box.value), 200);
      });
      // Przy kliknięciu w puste pole — pokaż od razu listę
      box.addEventListener('focus', () => {
        if (!box.value) this._itemSearchInput('');
      });
    }
  },

  async _itemSearchInput(q) {
    this.itemSearch = q.trim();
    const results = document.getElementById('item-search-results');
    if (!results) return;

    // Za krótkie zapytanie — czekaj
    if (this.itemSearch.length > 0 && this.itemSearch.length < 2) {
      results.innerHTML = '';
      return;
    }

    try {
      let items;
      if (!this.itemSearch) {
        // Puste pole — pokaż pierwsze 30 surowców z bazy
        const data = await API.get('/items');
        items = Array.isArray(data) ? data.slice(0, 30) : [];
      } else {
        // Wpisano tekst — szukaj przez /search
        const data = await API.get('/search?q=' + encodeURIComponent(this.itemSearch));
        items = data.items || [];
      }

      results.innerHTML = items.length
        ? items.map(i => `<div class="item-suggest"
              onclick="Sheet.selectItem(${i.id}, '${i.name.replace(/'/g, "\\'")}')">
            <div>
              <strong>${i.name}</strong>
              <span style="color:var(--text-m);font-size:0.78rem;margin-left:6px;">${i.category}</span>
            </div>
            ${(i.tags||[]).length
              ? `<div style="font-size:0.72rem;color:var(--text-m);margin-top:2px;">${i.tags.map(t=>'#'+t).join(' ')}</div>`
              : ''}
          </div>`).join('')
        : '<div style="padding:1rem;color:var(--text-m);font-style:italic;">Brak wyników</div>';
    } catch(e) {
      results.innerHTML = '<div style="padding:1rem;color:var(--err-t);">Błąd: ' + e.message + '</div>';
    }
  },

  async selectItem(itemId, itemName) {
    this.selectedItemId = itemId;
    document.getElementById('item-search-results').innerHTML = '';
    document.getElementById('item-search-box').value = itemName;
    UI.setStatus('item-status', 'item-spinner', 'Ładowanie...', true);
    try {
      const data = await API.get('/items/' + itemId + '/holders');
      if (data.error) throw new Error(data.error);
      this.itemHolders = data;
      this._renderItemHolders();
      UI.setStatus('item-status', 'item-spinner', '');
    } catch(e) {
      UI.setStatus('item-status', 'item-spinner', 'Błąd: ' + e.message);
    }
  },

  _renderItemHolders() {
    if (!this.itemHolders) return;
    const { item, holders, total } = this.itemHolders;
    const wrap = document.getElementById('item-holders-wrap');
    const unitStr = item.unit ? ' ' + item.unit : '';

    let html = `<div class="item-summary">
      <div>
        <div class="item-summary-name">${item.name}</div>
        <div class="item-summary-meta">${item.category}${(item.tags||[]).length ? ' · ' + item.tags.map(t=>'#'+t).join(' ') : ''}</div>
      </div>
      <div class="item-summary-total">${total}${unitStr}<div class="item-summary-label">razem</div></div>
    </div>`;

    if (!holders.length) {
      html += '<div class="empty-msg">Nikt nie posiada tego surowca.</div>';
    } else {
      html += '<div class="holders-list">';
      const max = Math.max(...holders.map(h => h.quantity));
      holders.forEach(h => {
        const pct = (h.quantity / max) * 100;
        html += `<div class="holder-row">
          <div class="holder-info">
            <div class="holder-name">${h.character_name}</div>
            <div class="holder-owner">${h.owner_display}</div>
          </div>
          <div class="holder-bar-wrap">
            <div class="holder-bar" style="width:${pct}%"></div>
          </div>
          <div class="holder-qty">${h.quantity}${unitStr}</div>
        </div>`;
      });
      html += '</div>';
    }

    wrap.innerHTML = html;
  },

  // ── Matrix view ───────────────────────────────────────────────────────────
  async loadMatrix() {
    UI.setStatus('matrix-status', 'matrix-spinner', 'Ładowanie...', true);
    try {
      const params = new URLSearchParams();
      if (this.matrixCategory) params.set('category', this.matrixCategory);
      if (this.matrixTags.length) params.set('tags', this.matrixTags.join(','));
      if (this.matrixCharIds.length) params.set('characters', this.matrixCharIds.join(','));
      if (this.matrixSearch) params.set('q', this.matrixSearch);
      if (this.matrixOnlyWithData) params.set('only_with_data', '1');
      const data = await API.get('/inventory?' + params);
      if (data.error) throw new Error(data.error);
      this.matrixData = data;
      this._renderCatFilter('matrix-cat-filter', data.categories || [], this.matrixCategory, c => {
        this.matrixCategory = c; this.loadMatrix();
      });
      this._renderTagFilter();
      this._renderCharFilter();
      this._renderMatrix();
      UI.setStatus('matrix-status', 'matrix-spinner', '');
    } catch(e) {
      UI.setStatus('matrix-status', 'matrix-spinner', 'Błąd: ' + e.message);
    }
  },

  _renderTagFilter() {
    const wrap = document.getElementById('matrix-tag-filter');
    if (!wrap) return;
    if (!this.allTags.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = this.allTags.map(t => {
      const active = this.matrixTags.includes(t);
      return `<button class="cat-btn${active ? ' active' : ''}" onclick="Sheet.toggleTag('${t.replace(/'/g, "\\'")}')">#${t}</button>`;
    }).join('');
  },

  toggleTag(tag) {
    if (this.matrixTags.includes(tag)) {
      this.matrixTags = this.matrixTags.filter(t => t !== tag);
    } else {
      this.matrixTags.push(tag);
    }
    this.loadMatrix();
  },

  _renderCharFilter() {
    const wrap = document.getElementById('matrix-char-filter');
    if (!wrap || !this.matrixData) return;
    const allChars = this.matrixData.characters || [];
    wrap.innerHTML = `
      <button class="cat-btn${this.matrixCharIds.length === 0 ? ' active' : ''}" onclick="Sheet.clearCharFilter()">Wszystkie (${allChars.length})</button>
      <button class="cat-btn" onclick="Sheet.openCharPicker()">Wybierz postacie...</button>
      ${this.matrixCharIds.length > 0 ? `<span style="font-size:0.78rem;color:var(--text-d);margin-left:8px;align-self:center;">Wybrano: ${this.matrixCharIds.length}</span>` : ''}
    `;
  },

  clearCharFilter() {
    this.matrixCharIds = [];
    this.loadMatrix();
  },

  async openCharPicker() {
    try {
      const chars = await API.get('/characters');
      if (!Array.isArray(chars)) return;
      const overlay = document.getElementById('char-picker-overlay');
      const list = document.getElementById('char-picker-list');
      list.innerHTML = chars.map(c => {
        const checked = this.matrixCharIds.includes(c.id);
        return `<label class="char-pick-row">
          <input type="checkbox" value="${c.id}" ${checked ? 'checked' : ''}>
          <span><strong>${c.name}</strong> <span style="color:var(--text-m);font-size:0.78rem;">${c.owner_username || ''}</span></span>
        </label>`;
      }).join('');
      overlay.classList.add('open');
    } catch(e) {
      console.error(e);
    }
  },

  applyCharPicker() {
    const checked = Array.from(document.querySelectorAll('#char-picker-list input:checked')).map(c => parseInt(c.value));
    this.matrixCharIds = checked;
    this.closeCharPicker();
    this.loadMatrix();
  },

  closeCharPicker() {
    document.getElementById('char-picker-overlay')?.classList.remove('open');
  },

  _renderMatrix() {
    if (!this.matrixData) return;
    const { characters, items } = this.matrixData;
    const empty = document.getElementById('matrix-empty');
    const wrap = document.getElementById('matrix-table-wrap');

    if (!characters.length || !items.length) {
      empty.textContent = !characters.length ? 'Brak postaci do wyświetlenia.' : 'Brak surowców pasujących do filtrów.';
      empty.style.display = 'block';
      wrap.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    wrap.style.display = 'block';
    this._renderTable('matrix-head', 'matrix-body', characters, items, true);
  },

  // ── Shared table renderer ─────────────────────────────────────────────────
  _renderCatFilter(elId, cats, active, onClick) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-btn' + (active === '' ? ' active' : '');
    allBtn.textContent = 'Wszystkie';
    allBtn.onclick = () => onClick('');
    el.appendChild(allBtn);
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (active === cat ? ' active' : '');
      btn.textContent = cat;
      btn.onclick = () => onClick(cat);
      el.appendChild(btn);
    });
  },

  _renderTable(headId, bodyId, characters, items, sticky) {
    const head = document.getElementById(headId);
    const body = document.getElementById(bodyId);
    if (!head || !body) return;

    head.innerHTML = '';
    const hr = document.createElement('tr');
    const cols = ['Przedmiot', 'Kategoria', ...characters.map(c => c.name)];
    cols.forEach((col, i) => {
      const th = document.createElement('th');
      if (sticky && i === 0) th.classList.add('sticky-col');
      th.textContent = col;
      hr.appendChild(th);
    });
    head.appendChild(hr);

    body.innerHTML = '';
    items.forEach(item => {
      const tr = document.createElement('tr');
      const unitStr = item.unit ? ` ${item.unit}` : '';
      let html = `<td${sticky ? ' class="sticky-col"' : ''}>${item.name}${(item.tags||[]).length ? ` <span class="tag-badges">${item.tags.map(t=>'<span class="tag-mini">#'+t+'</span>').join('')}</span>` : ''}</td>
        <td class="cat-cell">${item.category}</td>`;
      characters.forEach(c => {
        const q = item.quantities[String(c.id)] || 0;
        html += `<td class="num">${q ? q + unitStr : ''}</td>`;
      });
      tr.innerHTML = html;
      body.appendChild(tr);
    });
  },

  // ── Export ────────────────────────────────────────────────────────────────
  exportCSV(view) {
    const params = new URLSearchParams();
    if (view === 'mine') {
      params.set('scope', 'mine');
      if (this.mineCategory) params.set('category', this.mineCategory);
    } else if (view === 'matrix') {
      if (this.matrixCategory) params.set('category', this.matrixCategory);
      if (this.matrixCharIds.length) params.set('characters', this.matrixCharIds.join(','));
    }
    fetch(Config.PROXY + '/export?' + params, {
      headers: { 'Authorization': 'Bearer ' + State.token }
    }).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inwentarz.csv';
      a.click();
    });
  },
};
