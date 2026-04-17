// editor.js — Profile editor logic.
const Editor = {
  charId: null, charName: '',
  blocks: [], selectedId: null,
  dirty: false, addTarget: null,
  history: [], historyIndex: -1,
 
  async init() {
    const params = new URLSearchParams(window.location.search);
    this.charId = params.get('id');
    if (!this.charId) { window.location.href = 'index.html'; return; }
 
    const token = localStorage.getItem('ww_token');
    if (!token) { window.location.href = 'index.html'; return; }
 
    try {
      const me = await this._api('GET', '/auth/me');
      if (me.error) throw new Error(me.error);
 
      const data = await this._api('GET', `/characters/${this.charId}/profile`);
      if (data.error) throw new Error(data.error);
 
      this.charName = data.name;
      this.blocks = data.profile_blocks || [];
      document.getElementById('char-name-display').textContent = data.name;
      document.getElementById('toggle-public').checked = data.profile_public || false;
      document.getElementById('profile-link').href = `profile.html?id=${this.charId}`;
 
      this._pushHistory();
      this.render();
      this._renderProps();
    } catch(e) { this._toast('Błąd: ' + e.message, 'err'); }
  },
 
  async _api(method, path, body) {
    const token = localStorage.getItem('ww_token') || '';
    const opts = { method, headers:{'Content-Type':'application/json','Authorization':'Bearer '+token} };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch((window.PROXY||'') + path, opts);
    return res.json();
  },
 
  // ── History ───────────────────────────────────────────────────────────────
  _pushHistory() {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(this.blocks));
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this._updateHistoryBtns();
  },
  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.blocks = JSON.parse(this.history[this.historyIndex]);
    this.selectedId = null;
    this.render(); this._renderProps(); this._markDirty();
  },
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.blocks = JSON.parse(this.history[this.historyIndex]);
    this.selectedId = null;
    this.render(); this._renderProps(); this._markDirty();
  },
  _updateHistoryBtns() {
    const u = document.getElementById('undo-btn'), r = document.getElementById('redo-btn');
    if (u) u.disabled = this.historyIndex <= 0;
    if (r) r.disabled = this.historyIndex >= this.history.length - 1;
  },
 
  // ── Selection ─────────────────────────────────────────────────────────────
  select(id) {
    this.selectedId = this.selectedId === id ? null : id;
    this.addTarget = this.selectedId;
    this._highlightSelected();
    this._renderProps();
  },
  deselect() {
    this.selectedId = null; this.addTarget = null;
    this._highlightSelected(); this._renderProps();
  },
  _highlightSelected() {
    document.querySelectorAll('.eb').forEach(el => {
      el.classList.toggle('eb-sel', el.dataset.bid === this.selectedId);
    });
  },
 
  // ── Add block ─────────────────────────────────────────────────────────────
  addBlock(parentId) {
    this.addTarget = parentId || null;
    const sub = document.getElementById('picker-sub');
    if (sub) sub.textContent = parentId ? '→ wewnątrz kontenera' : '→ do głównego obszaru';
    document.getElementById('type-picker').classList.add('open');
  },
  addBlockOfType(type) {
    document.getElementById('type-picker').classList.remove('open');
    const nb = makeBlock(type);
    this.blocks = addBlockTo(this.blocks, this.addTarget, nb);
    this.selectedId = nb.id;
    this._markDirty();
    this.render();
    this._renderProps();
    // Scroll new block into view
    setTimeout(() => {
      const el = document.querySelector(`[data-bid="${nb.id}"]`);
      if (el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
    }, 50);
  },
 
  // ── Mutations ─────────────────────────────────────────────────────────────
  remove(id) {
    if (!confirm('Usunąć blok?')) return;
    this.blocks = removeBlock(this.blocks, id);
    if (this.selectedId === id) this.selectedId = null;
    this._markDirty(); this.render(); this._renderProps();
  },
  move(id, dir) {
    this.blocks = moveBlock(this.blocks, id, dir);
    this._markDirty(); this.render();
    // Re-highlight after re-render
    setTimeout(() => this._highlightSelected(), 10);
  },
  duplicate(id) {
    this.blocks = duplicateBlock(this.blocks, id);
    this._markDirty(); this.render();
  },
  updateProp(key, value) {
    if (!this.selectedId) return;
    this.blocks = updateBlockProps(this.blocks, this.selectedId, {[key]: value});
    this._markDirty();
    // Re-render only changed block for performance
    const el = document.querySelector(`[data-bid="${this.selectedId}"]`);
    if (el) {
      const block = findBlock(this.blocks, this.selectedId);
      if (block) {
        const tmp = document.createElement('div');
        tmp.innerHTML = Renderer.block(block, true);
        el.replaceWith(tmp.firstChild);
        this._highlightSelected();
      }
    }
  },
  _markDirty() {
    this.dirty = true;
    this._pushHistory();
    const btn = document.getElementById('save-btn');
    if (btn) btn.classList.add('dirty');
  },
 
  // ── Render canvas ─────────────────────────────────────────────────────────
  render() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.innerHTML = Renderer.render(this.blocks, true) ||
      `<div class="canvas-empty">
        <div style="font-size:2rem;margin-bottom:1rem;opacity:0.3">⊞</div>
        <div>Kliknij <strong>＋ Dodaj blok</strong> aby rozpocząć</div>
      </div>`;
  },
 
  // ── Properties panel ─────────────────────────────────────────────────────
  _renderProps() {
    const panel = document.getElementById('props-panel');
    if (!panel) return;
    if (!this.selectedId) {
      panel.innerHTML = `<div class="props-empty">
        <div style="font-size:1.8rem;margin-bottom:0.8rem;opacity:0.3">☰</div>
        <div>Kliknij blok<br>aby edytować</div>
      </div>`;
      return;
    }
    const block = findBlock(this.blocks, this.selectedId);
    if (!block) { panel.innerHTML = ''; return; }
    panel.innerHTML = this._buildPropsForm(block);
  },
 
  _buildPropsForm(block) {
    const p = block.props || {};
    const def = BlockDefs[block.type];
 
    // Helpers
    const section = (title, content) =>
      `<details open><summary class="prop-section">${title}</summary><div class="prop-section-body">${content}</div></details>`;
    const row = (label, input, hint='') =>
      `<div class="prop-row"><label>${label}</label>${input}${hint?`<div class="prop-hint">${hint}</div>`:''}</div>`;
    const txt = (key, ph='') =>
      `<input type="text" value="${(p[key]||'').toString().replace(/"/g,'&quot;')}" placeholder="${ph}" oninput="Editor.updateProp('${key}',this.value)">`;
    const num = (key, min=0, max=9999, step=1) =>
      `<input type="number" value="${p[key]!==undefined?p[key]:0}" min="${min}" max="${max}" step="${step}" oninput="Editor.updateProp('${key}',parseFloat(this.value)||0)">`;
    const clr = (key, def='#7ba7c4') =>
      `<div class="color-row"><input type="color" value="${p[key]||def}" oninput="Editor.updateProp('${key}',this.value)"><input type="text" value="${(p[key]||'').replace(/"/g,'&quot;')}" placeholder="${def}" oninput="Editor.updateProp('${key}',this.value)"></div>`;
    const sel = (key, opts) =>
      `<select onchange="Editor.updateProp('${key}',this.value)">${opts.map(([v,l])=>`<option value="${v}"${(p[key]||'')===(v)?` selected`:``}>${l}</option>`).join('')}</select>`;
    const chk = (key, label) =>
      `<label class="chk-row"><input type="checkbox" ${p[key]?'checked':''} onchange="Editor.updateProp('${key}',this.checked)"> ${label}</label>`;
    const textarea = (key, rows=5) =>
      `<textarea rows="${rows}" oninput="Editor.updateProp('${key}',this.value)">${(p[key]||'').replace(/</g,'&lt;')}</textarea>`;
 
    let html = `<div class="props-title">${def?.icon||''} ${def?.label||block.type}</div>`;
 
    // ── Container ──────────────────────────────────────────────────────────
    if (block.type === 'container') {
      html += section('Kolumny i rozmiar',
        row('Liczba kolumn', num('columns',1,12,1)) +
        row('Własny grid', txt('column_template','np. 1fr 2fr 1fr'), 'Nadpisuje "Liczba kolumn"') +
        row('Wyrównanie kolumn', sel('align_items',[['start','Góra'],['center','Środek'],['end','Dół'],['stretch','Rozciągnij']])) +
        row('Szerokość', txt('width','100%'), '100%, 500px, auto…') +
        row('Wysokość', txt('height','auto'), 'auto, 300px, 50vh…') +
        row('Min. wysokość (px)', num('min_height',0,2000,10)) +
        row('Overflow', sel('overflow',[['visible','Widoczny'],['hidden','Ukryty'],['auto','Scroll auto'],['scroll','Scroll zawsze']])) +
        row('Odstęp kolumn (px)', num('gap',0,200,4)) +
        row('Padding (px)', num('padding',0,200,4))
      );
      html += section('Tło',
        row('Kolor tła', clr('bg_color','transparent')) +
        row('URL obrazu tła', txt('bg_image','https://...')) +
        row('Rozmiar tła', sel('bg_size',[['cover','Cover'],['contain','Contain'],['auto','Auto'],['100% 100%','Rozciągnij']])) +
        row('Pozycja tła', sel('bg_position',[['center','Środek'],['top','Góra'],['bottom','Dół'],['left','Lewo'],['right','Prawo']]))
      );
      html += section('Obramowanie',
        row('Grubość (px)', num('border_width',0,20,1)) +
        row('Kolor', clr('border_color','rgba(120,160,200,0.4)')) +
        row('Styl', sel('border_style',[['solid','Ciągłe'],['dashed','Kreskowane'],['dotted','Kropkowane'],['double','Podwójne'],['none','Brak']])) +
        row('Zaokrąglenie (px)', num('border_radius',0,200,2))
      );
    }
 
    // ── Vertical slider ────────────────────────────────────────────────────
    if (block.type === 'slider_v') {
      html += section('Rozmiar',
        row('Szerokość', txt('width','100%')) +
        row('Wysokość', txt('height','400px'), 'px, vh, rem…') +
        row('Odstęp elementów (px)', num('gap',0,100,4)) +
        row('Padding (px)', num('padding',0,100,4)) +
        row('Kolor tła', clr('bg_color','transparent'))
      );
    }
 
    // ── Horizontal slider ──────────────────────────────────────────────────
    if (block.type === 'slider_h') {
      html += section('Rozmiar',
        row('Wysokość', txt('height','220px')) +
        row('Szerokość elementu', txt('item_width','240px'), 'każdy element ma tę szerokość') +
        row('Odstęp elementów (px)', num('gap',0,100,4)) +
        row('Padding (px)', num('padding',0,100,4)) +
        row('Kolor tła', clr('bg_color','transparent'))
      );
    }
 
    // ── Text ───────────────────────────────────────────────────────────────
    if (block.type === 'text') {
      html += section('Treść', row('Tekst', textarea('content',7)));
      html += section('Typografia',
        row('Kolor', clr('color','#d8e4ee')) +
        row('Rozmiar (rem)', num('font_size',0.5,6,0.05)) +
        row('Grubość', sel('font_weight',[['300','Cienka'],['normal','Normalna'],['500','Medium'],['600','Semi-bold'],['bold','Pogrubiona'],['800','Extra-bold']])) +
        row('Styl', sel('font_style',[['normal','Normalna'],['italic','Kursywa']])) +
        row('Wyrównanie', sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo'],['justify','Wyjustowane']])) +
        row('Czcionka', sel('font_family',[['Crimson Pro, serif','Crimson Pro (domyślna)'],['Cinzel, serif','Cinzel'],['sans-serif','Sans-serif'],['monospace','Monospace']])) +
        row('Interlinia', num('line_height',1,5,0.05)) +
        row('Odstęp liter', txt('letter_spacing','normal'))
      );
      html += section('Odstępy',
        row('Margines górny (px)', num('margin_top',0,200,4)) +
        row('Margines dolny (px)', num('margin_bottom',0,200,4))
      );
    }
 
    // ── Heading ────────────────────────────────────────────────────────────
    if (block.type === 'heading') {
      html += section('Treść',
        row('Tekst', txt('content')) +
        row('Poziom', sel('level',[['1','H1 — Największy'],['2','H2'],['3','H3'],['4','H4'],['5','H5'],['6','H6 — Najmniejszy']]))
      );
      html += section('Typografia',
        row('Kolor', clr('color','#a8c8e0')) +
        row('Wyrównanie', sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo']])) +
        row('Czcionka', sel('font_family',[['Cinzel, serif','Cinzel (domyślna)'],['Crimson Pro, serif','Crimson Pro'],['sans-serif','Sans-serif']])) +
        row('Odstęp liter', txt('letter_spacing','0.08em'))
      );
      html += section('Odstępy',
        row('Margines górny (px)', num('margin_top',0,200,4)) +
        row('Margines dolny (px)', num('margin_bottom',0,200,4))
      );
    }
 
    // ── Image ──────────────────────────────────────────────────────────────
    if (block.type === 'image') {
      html += section('Źródło',
        row('URL obrazu', txt('url','https://i.ibb.co/...')) +
        row('Alt (opis dla czytników)', txt('alt'))
      );
      html += section('Rozmiar i pozycja',
        row('Szerokość', txt('width','100%'), '%, px, auto…') +
        row('Max. szerokość', txt('max_width',''), 'np. 400px') +
        row('Wysokość', txt('height','auto'), 'auto, 200px, 50vh…') +
        row('Object-fit', sel('object_fit',[['cover','Cover'],['contain','Contain'],['fill','Fill'],['none','None']])) +
        row('Wyrównanie', sel('align',[['left','Lewo'],['center','Środek'],['right','Prawo']])) +
        row('Zaokrąglenie (px)', num('border_radius',0,500,4))
      );
    }
 
    // ── Divider ────────────────────────────────────────────────────────────
    if (block.type === 'divider') {
      html += section('Wygląd',
        row('Kolor', clr('color','rgba(120,160,200,0.25)')) +
        row('Styl', sel('style',[['solid','Ciągły'],['dashed','Kreskowany'],['dotted','Kropkowany'],['double','Podwójny']])) +
        row('Grubość (px)', num('thickness',1,20,1)) +
        row('Margines pionowy (px)', num('margin',0,100,4))
      );
    }
 
    // ── Spacer ─────────────────────────────────────────────────────────────
    if (block.type === 'spacer') {
      html += section('Rozmiar', row('Wysokość (px)', num('height',4,1000,4)));
    }
 
    // ── Badge ──────────────────────────────────────────────────────────────
    if (block.type === 'badge') {
      html += section('Treść', row('Tekst', txt('content')));
      html += section('Wygląd',
        row('Kolor tekstu', clr('color','#a8c8e0')) +
        row('Tło', clr('bg_color','rgba(120,160,200,0.15)')) +
        row('Kolor obramowania', clr('border_color','rgba(120,160,200,0.4)')) +
        row('Zaokrąglenie (px)', num('border_radius',0,50,2)) +
        row('Rozmiar tekstu (rem)', num('font_size',0.5,3,0.05)) +
        row('Czcionka', sel('font_family',[['Cinzel, serif','Cinzel'],['Crimson Pro, serif','Crimson Pro'],['sans-serif','Sans-serif']]))
      );
    }
 
    // Actions
    html += `<div class="prop-actions">`;
    if (def?.hasChildren) {
      html += `<button class="prop-btn-add" onclick="Editor.addBlock('${block.id}')">＋ Dodaj blok wewnątrz</button>`;
    }
    html += `<button class="prop-btn-dup" onclick="Editor.duplicate('${block.id}')">⧉ Duplikuj</button>`;
    html += `<button class="prop-btn-del" onclick="Editor.remove('${block.id}')">✕ Usuń blok</button>`;
    html += `</div>`;
 
    return html;
  },
 
  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    const pub = document.getElementById('toggle-public')?.checked || false;
    const btn = document.getElementById('save-btn');
    try {
      if (btn) { btn.textContent = 'Zapisywanie...'; btn.disabled = true; }
      const data = await this._api('PUT', `/characters/${this.charId}/profile`, {
        profile_blocks: this.blocks, profile_public: pub,
      });
      if (data.error) throw new Error(data.error);
      this.dirty = false;
      if (btn) { btn.classList.remove('dirty'); btn.textContent = 'Zapisano ✓'; btn.disabled = false; }
      setTimeout(() => { if (btn && !this.dirty) btn.textContent = 'Zapisz'; }, 2500);
    } catch(e) {
      if (btn) { btn.textContent = 'Zapisz'; btn.disabled = false; }
      this._toast('Błąd zapisu: ' + e.message, 'err');
    }
  },
 
  _toast(msg, type='ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast toast-' + type + ' toast-show';
    setTimeout(() => t.classList.remove('toast-show'), 3000);
  },
};
