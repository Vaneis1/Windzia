// sheet.js — Inventory grid with category filtering and column sorting.
const Sheet = {
  async load() {
    UI.setStatus('sheet-status', 'sheet-spinner', 'Ładowanie...', true);
    try {
      const cat = State.activeCategory
        ? '?category=' + encodeURIComponent(State.activeCategory)
        : '';
      const data = await API.get('/inventory' + cat);
      if (data.error) throw new Error(data.error);
      State.sheetData = data;
      this._renderCatFilter(data.categories || []);
      this.render();
      UI.setStatus('sheet-status', 'sheet-spinner', '');
    } catch (e) {
      UI.setStatus('sheet-status', 'sheet-spinner', 'Błąd: ' + e.message);
    }
  },
 
  _renderCatFilter(cats) {
    const el = document.getElementById('cat-filter');
    if (!el) return;
    el.innerHTML = '';
 
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-btn' + (State.activeCategory === '' ? ' active' : '');
    allBtn.textContent = 'Wszystkie';
    allBtn.onclick = () => { State.activeCategory = ''; this.load(); };
    el.appendChild(allBtn);
 
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (State.activeCategory === cat ? ' active' : '');
      btn.textContent = cat;
      btn.onclick = () => { State.activeCategory = cat; this.load(); };
      el.appendChild(btn);
    });
  },
 
  render() {
    if (!State.sheetData) return;
    const { characters, items } = State.sheetData;
 
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const filtered = query
      ? items.filter(i => i.name.toLowerCase().includes(query))
      : items;
 
    const sorted = [...filtered].sort((a, b) => {
      const { sortCol, sortAsc } = State;
      if (sortCol === 0) {
        return sortAsc
          ? a.name.localeCompare(b.name, 'pl')
          : b.name.localeCompare(a.name, 'pl');
      }
      if (sortCol === 1) {
        return sortAsc
          ? a.category.localeCompare(b.category, 'pl')
          : b.category.localeCompare(a.category, 'pl');
      }
      const char = characters[sortCol - 2];
      const av = a.quantities[String(char?.id)] || 0;
      const bv = b.quantities[String(char?.id)] || 0;
      return sortAsc ? av - bv : bv - av;
    });
 
    // Header
    const head = document.getElementById('sheet-head');
    if (!head) return;
    head.innerHTML = '';
    const hr = document.createElement('tr');
    ['Przedmiot', 'Kategoria', ...characters.map(c => c.name)].forEach((col, i) => {
      const th = document.createElement('th');
      const arrow = State.sortCol === i ? (State.sortAsc ? '↑' : '↓') : '↕';
      th.innerHTML = `${col} <span class="sort-arr">${arrow}</span>`;
      if (State.sortCol === i) th.classList.add('sorted');
      th.onclick = () => {
        if (State.sortCol === i) State.sortAsc = !State.sortAsc;
        else { State.sortCol = i; State.sortAsc = true; }
        this.render();
      };
      hr.appendChild(th);
    });
    head.appendChild(hr);
 
    // Body
    const body = document.getElementById('sheet-body');
    if (!body) return;
    body.innerHTML = '';
    if (!sorted.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="99">Brak wyników</td></tr>';
      return;
    }
    sorted.forEach(item => {
      const tr = document.createElement('tr');
      let html = `<td>${item.name}</td><td class="cat-cell">${item.category}</td>`;
      characters.forEach(c => {
        const q = item.quantities[String(c.id)];
        html += `<td class="num">${q || ''}</td>`;
      });
      tr.innerHTML = html;
      body.appendChild(tr);
    });
  },
 
  exportCSV() {
    const cat = State.activeCategory
      ? '?category=' + encodeURIComponent(State.activeCategory)
      : '';
    window.open(Config.PROXY + '/export' + cat, '_blank');
  },
};
