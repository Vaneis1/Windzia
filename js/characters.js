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
      el.innerHTML =
        '<p style="color:var(--text-m);font-style:italic;padding:0.5rem;">' +
        'Brak postaci. Dodaj pierwszą poniżej.</p>';
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
      const isOwn = State.currentUser?.role === 'admin' ||
                    c.owner_id === State.currentUser?.id;

      card.innerHTML = `
        <div class="char-info" style="flex:1;min-width:0;">
          <div class="char-name-wrap" id="char-name-wrap-${c.id}">
            <span class="char-name">${c.name}</span>
            ${isOwn ? `<button class="char-rename-btn sm" title="Zmień imię"
              onclick="Characters.startRename(${c.id})">✎</button>` : ''}
          </div>
          <div class="char-owner">${c.owner_username || ''}</div>
          ${houseBadges ? `<div class="house-badges">${houseBadges}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex-shrink:0;">
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

  startRename(id) {
    const wrap = document.getElementById('char-name-wrap-' + id);
    if (!wrap) return;
    const currentName = wrap.querySelector('.char-name')?.textContent || '';
    wrap.innerHTML = `
      <input type="text" id="rename-input-${id}" value="${currentName.replace(/"/g,'&quot;')}"
        style="font-family:'Crimson Pro',serif;font-size:1rem;background:var(--bg3);
               border:1px solid var(--gold);border-radius:3px;color:var(--text);
               padding:3px 8px;outline:none;flex:1;min-width:0;"
        onkeydown="if(event.key==='Enter')Characters.confirmRename(${id});
                   if(event.key==='Escape')Characters.load();">
      <button class="sm primary" onclick="Characters.confirmRename(${id})">✓</button>
      <button class="sm" onclick="Characters.load()">✕</button>
    `;
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';
    wrap.style.alignItems = 'center';
    const input = document.getElementById('rename-input-' + id);
    input?.focus();
    input?.select();
  },

  async confirmRename(id) {
    const input = document.getElementById('rename-input-' + id);
    const name = input?.value.trim();
    if (!name) return;
    UI.clearMsg('char-ok', 'char-err');
    try {
      const data = await API.put('/characters/' + id, { name });
      if (data.error) throw new Error(data.error);
      UI.ok('char-ok', 'char-err', `Zmieniono imię na „${name}".`);
      await this.load();
    } catch (e) {
      UI.err('char-ok', 'char-err', 'Błąd: ' + e.message);
    }
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
