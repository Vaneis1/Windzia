// characters.js — Character CRUD and select population
const Characters = {
  async load() {
    try {
      const chars = await API.get('/characters');
      if (!Array.isArray(chars)) return;
      this._renderGrid(chars);
      this._populateSelects(chars);
    } catch (e) {
      console.error('loadCharacters:', e.message);
    }
  },

  _renderGrid(chars) {
    const el = document.getElementById('char-grid');
    if (!el) return;
    el.innerHTML = '';
    if (!chars.length) {
      el.innerHTML = '<p style="color:var(--text-m);font-style:italic;padding:0.5rem;">Brak postaci. Dodaj pierwszą poniżej.</p>';
      return;
    }
    chars.forEach(c => {
      const card = document.createElement('div');
      card.className = 'char-card';

      const houseBadges = (c.houses || []).map(h =>
        `<span class="house-badge" style="color:${h.color};border-color:${h.color};">` +
        `${h.heraldry ? h.heraldry + ' ' : ''}${h.name}</span>`
      ).join('');

      const currentHouseIds = (c.houses || []).map(h => h.id).join(',');

      card.innerHTML = `
        <div class="char-info">
          <div class="char-name">${c.name}</div>
          <div class="char-owner">${c.owner_username || ''}</div>
          ${houseBadges ? `<div class="house-badges">${houseBadges}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button class="sm" title="Przypisz rody"
            onclick="Houses.openModal(${c.id}, [${currentHouseIds}])">⚜ Rody</button>
          <a href="editor.html?id=${c.id}"
            style="font-family:'Cinzel',serif;font-size:0.62rem;letter-spacing:0.08em;
                   text-transform:uppercase;padding:4px 10px;border-radius:3px;
                   border:1px solid rgba(133,214,242,0.3);color:#7aafc8;text-decoration:none;">
            ✎ Profil</a>
          <button class="danger sm"
            onclick="Characters.delete(${c.id}, '${c.name.replace(/'/g, "\\'")}')">
            Usuń
          </button>
        </div>`;
      el.appendChild(card);
    });
  },

  _populateSelects(chars) {
    const isAdmin = State.currentUser?.role === 'admin';
    const labelFn = c => c.name + (isAdmin && c.owner_username ? ` (${c.owner_username})` : '');
    const valueFn = c => c.id;

    ['char-select', 'admin-char-select'].forEach(id => {
      const prev = document.getElementById(id)?.value;
      UI.populateSelect(id, chars, labelFn, valueFn, prev);
    });
  },

  async add() {
    const input = document.getElementById('new-char-input');
    const name = input?.value.trim();
    if (!name) return;
    UI.clearMsg('char-ok', 'char-err');
    try {
      const data = await API.post('/characters', { name });
      if (data.error) throw new Error(data.error);
      if (input) input.value = '';
      UI.ok('char-ok', 'char-err', `Dodano „${name}".`);
      await this.load();
    } catch (e) {
      UI.err('char-ok', 'char-err', 'Błąd: ' + e.message);
    }
  },

  async delete(id, name) {
    if (!confirm(`Usunąć postać „${name}" i wszystkie jej dane?`)) return;
    try {
      const data = await API.delete('/characters/' + id);
      if (data.error) throw new Error(data.error);
      await this.load();
    } catch (e) {
      UI.err('char-ok', 'char-err', 'Błąd: ' + e.message);
    }
  },
};
