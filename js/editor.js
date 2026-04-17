// editor.js — Profile editor logic.
const Editor = {
  charId: null,
  charName: '',
  blocks: [],
  selectedId: null,
  dirty: false,
  addTarget: null, // parentId for next addBlock call
 
  async init() {
    const params = new URLSearchParams(window.location.search);
    this.charId = params.get('id');
    if (!this.charId) { window.location.href = 'index.html'; return; }
 
    // Restore session
    const token = localStorage.getItem('ww_token');
    if (!token) { window.location.href = 'index.html?next=editor&id=' + this.charId; return; }
 
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
 
      this.render();
    } catch(e) {
      alert('Błąd ładowania profilu: ' + e.message);
    }
  },
 
  async _api(method, path, body) {
    const token = localStorage.getItem('ww_token') || '';
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch((window.PROXY || '') + path, opts);
    return res.json();
  },
 
  // ── Selection ─────────────────────────────────────────────────────────────
  select(id) {
    this.selectedId = this.selectedId === id ? null : id;
    this.addTarget = this.selectedId;
    this.render();
    this._renderProps();
  },
 
  deselect() {
    this.selectedId = null;
    this.addTarget = null;
    this.render();
    this._renderProps();
  },
 
  // ── Block operations ──────────────────────────────────────────────────────
  addBlock(parentId) {
    this.addTarget = parentId || null;
    // Show type picker
    document.getElementById('type-picker-target').textContent =
      parentId ? '(do kontenera)' : '(do głównego obszaru)';
    document.getElementById('type-picker').style.display = 'flex';
  },
 
  addBlockOfType(type) {
    document.getElementById('type-picker').style.display = 'none';
    const nb = makeBlock(type);
    this.blocks = addBlockTo(this.blocks, this.addTarget, nb);
    this.selectedId = nb.id;
    this.dirty = true;
    this.render();
    this._renderProps();
  },
 
  remove(id) {
    if (!confirm('Usunąć blok?')) return;
    this.blocks = removeBlock(this.blocks, id);
    if (this.selectedId === id) this.selectedId = null;
    this.dirty = true;
    this.render();
    this._renderProps();
  },
 
  move(id, dir) {
    this.blocks = moveBlock(this.blocks, id, dir);
    this.dirty = true;
    this.render();
  },
 
  updateProp(key, value) {
    if (!this.selectedId) return;
    this.blocks = updateBlockProps(this.blocks, this.selectedId, { [key]: value });
    this.dirty = true;
    this.render();
  },
 
  // ── Render canvas ─────────────────────────────────────────────────────────
  render() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const html = Renderer.render(this.blocks, true);
    canvas.innerHTML = html || '<div class="canvas-empty">Kliknij "+" aby dodać pierwszy blok</div>';
    document.getElementById('save-btn').textContent = this.dirty ? '● Zapisz' : 'Zapisz';
  },
 
  // ── Properties panel ─────────────────────────────────────────────────────
  _renderProps() {
    const panel = document.getElementById('props-panel');
    if (!panel) return;
    if (!this.selectedId) {
      panel.innerHTML = '<p class="props-hint">Kliknij blok aby edytować jego właściwości</p>';
      return;
    }
    const block = findBlock(this.blocks, this.selectedId);
    if (!block) { panel.innerHTML = ''; return; }
 
    panel.innerHTML = this._propsForm(block);
  },
 
  _propsForm(block) {
    const p = block.props || {};
    const type = block.type;
    let html = `<div class="props-header"><span class="props-type">${BlockDefs[type]?.label || type}</span></div>`;
 
    const field = (label, key, inputHtml) =>
      `<div class="prop-row"><label>${label}</label>${inputHtml}</div>`;
    const text = (key, placeholder='') =>
      `<input type="text" value="${(p[key]||'').replace(/"/g,'&quot;')}" placeholder="${placeholder}" oninput="Editor.updateProp('${key}',this.value)">`;
    const num = (key, min=0, max=999, step=1) =>
      `<input type="number" value="${p[key]||0}" min="${min}" max="${max}" step="${step}" oninput="Editor.updateProp('${key}',parseFloat(this.value)||0)">`;
    const color = (key) =>
      `<div style="display:flex;gap:6px;align-items:center"><input type="color" value="${p[key]||'#00cccc'}" oninput="Editor.updateProp('${key}',this.value)" style="width:40px;height:28px;padding:2px;cursor:pointer"><input type="text" value="${(p[key]||'').replace(/"/g,'&quot;')}" placeholder="#rrggbb lub rgba(...)" oninput="Editor.updateProp('${key}',this.value)" style="flex:1"></div>`;
    const sel = (key, opts) =>
      `<select onchange="Editor.updateProp('${key}',this.value)">${opts.map(([v,l])=>`<option value="${v}"${p[key]===v?' selected':''}>${l}</option>`).join('')}</select>`;
    const textarea = (key, rows=4) =>
      `<textarea rows="${rows}" oninput="Editor.updateProp('${key}',this.value)" style="width:100%;resize:vertical">${(p[key]||'').replace(/</g,'&lt;')}</textarea>`;
 
    if (type === 'container') {
      html += field('Kolumny', 'columns', num('columns',1,6,1));
      html += field('Tło (kolor)', 'bg_color', color('bg_color'));
      html += field('Tło (URL obrazu)', 'bg_image', text('bg_image','https://...'));
      html += field('Obramowanie (px)', 'border_width', num('border_width',0,20,1));
      html += field('Kolor obramowania', 'border_color', color('border_color'));
      html += field('Styl obramowania', 'border_style', sel('border_style',[['solid','Ciągłe'],['dashed','Kreskowane'],['dotted','Kropkowane'],['none','Brak']]));
      html += field('Zaokrąglenie (px)', 'border_radius', num('border_radius',0,100,2));
      html += field('Padding (px)', 'padding', num('padding',0,200,4));
      html += field('Odstęp kolumn (px)', 'gap', num('gap',0,100,4));
      html += field('Min. wysokość (px)', 'min_height', num('min_height',0,2000,10));
      html += field('Szerokość', 'width', text('width','100%'));
    }
 
    if (type === 'text') {
      html += field('Treść', 'content', textarea('content',6));
      html += field('Kolor', 'color', color('color'));
      html += field('Rozmiar (rem)', 'font_size', num('font_size',0.5,6,0.1));
      html += field('Grubość', 'font_weight', sel('font_weight',[['normal','Normalna'],['bold','Pogrubiona'],['300','Cienka'],['600','Semi-bold']]));
      html += field('Styl', 'font_style', sel('font_style',[['normal','Normalna'],['italic','Kursywa']]));
      html += field('Wyrównanie', 'text_align', sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo'],['justify','Wyjustowanie']]));
      html += field('Czcionka', 'font_family', sel('font_family',[['Crimson Pro, serif','Crimson Pro (szeryfowa)'],['Cinzel, serif','Cinzel (nagłówkowa)'],['sans-serif','Sans-serif'],['monospace','Monospace']]));
      html += field('Interlinia', 'line_height', num('line_height',1,4,0.1));
    }
 
    if (type === 'heading') {
      html += field('Treść', 'content', text('content'));
      html += field('Poziom (H1-H6)', 'level', num('level',1,6,1));
      html += field('Kolor', 'color', color('color'));
      html += field('Wyrównanie', 'text_align', sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo']]));
      html += field('Czcionka', 'font_family', sel('font_family',[['Cinzel, serif','Cinzel'],['Crimson Pro, serif','Crimson Pro'],['sans-serif','Sans-serif']]));
      html += field('Odstęp liter', 'letter_spacing', text('letter_spacing','0.08em'));
    }
 
    if (type === 'image') {
      html += field('URL obrazu', 'url', text('url','https://i.ibb.co/...'));
      html += field('Alt (opis)', 'alt', text('alt'));
      html += field('Szerokość', 'width', text('width','100%'));
      html += field('Max. wysokość', 'max_height', text('max_height','300px'));
      html += field('Zaokrąglenie (px)', 'border_radius', num('border_radius',0,200,4));
      html += field('Wyrównanie', 'align', sel('align',[['left','Lewo'],['center','Środek'],['right','Prawo']]));
    }
 
    if (type === 'divider') {
      html += field('Kolor', 'color', color('color'));
      html += field('Styl', 'style', sel('style',[['solid','Ciągłe'],['dashed','Kreskowane'],['dotted','Kropkowane']]));
      html += field('Grubość (px)', 'thickness', num('thickness',1,20,1));
      html += field('Margines (px)', 'margin', num('margin',0,100,4));
    }
 
    if (type === 'spacer') {
      html += field('Wysokość (px)', 'height', num('height',4,500,4));
    }
 
    if (type === 'slider') {
      html += field('Wysokość', 'height', text('height','220px'));
      html += field('Odstęp elementów (px)', 'gap', num('gap',0,80,4));
    }
 
    if (type === 'badge') {
      html += field('Treść', 'content', text('content'));
      html += field('Kolor tekstu', 'color', color('color'));
      html += field('Tło', 'bg_color', color('bg_color'));
      html += field('Kolor obramowania', 'border_color', color('border_color'));
      html += field('Zaokrąglenie (px)', 'border_radius', num('border_radius',0,50,2));
      html += field('Rozmiar tekstu (rem)', 'font_size', num('font_size',0.5,3,0.1));
    }
 
    // Delete button
    html += `<button class="danger sm" style="margin-top:1.2rem;width:100%" onclick="Editor.remove('${block.id}')">Usuń blok</button>`;
    if (BlockDefs[type]?.hasChildren) {
      html += `<button class="primary sm" style="margin-top:0.5rem;width:100%" onclick="Editor.addBlock('${block.id}')">+ Dodaj blok wewnątrz</button>`;
    }
 
    return html;
  },
 
  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    const pub = document.getElementById('toggle-public')?.checked || false;
    try {
      document.getElementById('save-btn').textContent = 'Zapisywanie...';
      const data = await this._api('PUT', `/characters/${this.charId}/profile`, {
        profile_blocks: this.blocks,
        profile_public: pub,
      });
      if (data.error) throw new Error(data.error);
      this.dirty = false;
      document.getElementById('save-btn').textContent = 'Zapisz ✓';
      setTimeout(() => { if (!this.dirty) document.getElementById('save-btn').textContent = 'Zapisz'; }, 2000);
    } catch(e) {
      alert('Błąd zapisu: ' + e.message);
      document.getElementById('save-btn').textContent = '● Zapisz';
    }
  },
};
