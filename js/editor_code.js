// editor_code.js — Code editing modes (JSON + CSS split-pane)

const EditorCode = {
  mode: 'visual',
  jsonText: '',
  cssText: '',
  jsonError: null,
  _selectedPreviewBlock: null,

  _snippets: [
    { label: 'gradient tła', code: '\n[data-bid="ID"] {\n  background: linear-gradient(\n    135deg,\n    #141920,\n    #1e3a5f\n  );\n}\n' },
    { label: 'tło-obrazek', code: '\n[data-bid="ID"] {\n  background-image: url("ADRES_URL");\n  background-size: cover;\n  background-position: center;\n}\n' },
    { label: 'ramka', code: '\n[data-bid="ID"] {\n  border: 1px solid #7ba7c4;\n  border-radius: 8px;\n}\n' },
    { label: 'cień', code: '\n[data-bid="ID"] {\n  box-shadow: 0 4px 20px rgba(0,0,0,0.4);\n}\n' },
    { label: 'zaokrąglenie', code: '\n[data-bid="ID"] {\n  border-radius: 12px;\n  overflow: hidden;\n}\n' },
    { label: 'czcionka', code: '\n[data-bid="ID"] {\n  font-family: "Cinzel", serif;\n  color: #a8c8e0;\n  letter-spacing: 0.1em;\n}\n' },
    { label: 'hover obrazek', code: '\n[data-bid="ID"] img {\n  transition: transform 0.3s;\n}\n[data-bid="ID"] img:hover {\n  transform: scale(1.04);\n}\n' },
    { label: 'animacja wejścia', code: '\n@keyframes fadeIn {\n  from { opacity: 0; transform: translateY(16px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n[data-bid="ID"] {\n  animation: fadeIn 0.5s ease-out;\n}\n' },
  ],

  init() {
    this.cssText = Editor.profileCss || '';
  },

  switchMode(newMode) {
    if (newMode === this.mode) return;

    if (this.mode === 'json' && newMode !== 'json') {
      const ok = this._applyJsonText(false);
      if (!ok && !confirm('JSON ma błąd — czy na pewno chcesz wyjść? Niezapisane zmiany przepadną.')) return;
    }
    if (this.mode === 'css' && newMode !== 'css') {
      const ta = document.getElementById('css-editor');
      if (ta) this.cssText = ta.value;
      Editor.profileCss = this.cssText;
      this._applyCssLivePreview();
    }

    this.mode = newMode;
    this._render();
  },

  _render() {
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === this.mode);
    });

    const visual  = document.getElementById('mode-visual');
    const json    = document.getElementById('mode-json');
    const css     = document.getElementById('mode-css');
    const sidebar = document.querySelector('.sidebar');
    const props   = document.querySelector('.props-panel');

    if (this.mode === 'visual') {
      visual.style.display = 'flex';
      json.style.display   = 'none';
      css.style.display    = 'none';
      if (sidebar) sidebar.style.display = '';
      if (props)   props.style.display   = '';
      Editor.render();
    } else if (this.mode === 'json') {
      visual.style.display = 'none';
      json.style.display   = 'flex';
      css.style.display    = 'none';
      if (sidebar) sidebar.style.display = 'none';
      if (props)   props.style.display   = 'none';
      this._renderJsonEditor();
    } else if (this.mode === 'css') {
      visual.style.display = 'none';
      json.style.display   = 'none';
      css.style.display    = 'flex';
      if (sidebar) sidebar.style.display = 'none';
      if (props)   props.style.display   = 'none';
      this._renderCssEditor();
    }
  },

  // ── JSON mode ──────────────────────────────────────────────────────────────
  _renderJsonEditor() {
    const data = { blocks: Editor.blocks, settings: Editor.pageSettings };
    this.jsonText = JSON.stringify(data, null, 2);
    const ta = document.getElementById('json-editor');
    if (ta) {
      ta.value = this.jsonText;
      ta.oninput = () => this._validateJson(ta.value);
    }
    this._validateJson(this.jsonText);
  },

  _validateJson(text) {
    const status = document.getElementById('json-status');
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Musi być obiektem lub tablicą');
      this.jsonError = null;
      if (status) { status.textContent = '✓ Poprawny JSON'; status.className = 'code-status code-status-ok'; }
      return true;
    } catch(e) {
      this.jsonError = e.message;
      if (status) { status.textContent = '✕ Błąd: ' + e.message; status.className = 'code-status code-status-err'; }
      return false;
    }
  },

  applyJsonNow() {
    const ta = document.getElementById('json-editor');
    if (!ta) return;
    if (this._applyJsonText(true, ta.value)) Editor._toast('Zastosowano zmiany w strukturze', 'ok');
  },

  _applyJsonText(strict = false, text = null) {
    if (text === null) { const ta = document.getElementById('json-editor'); if (!ta) return false; text = ta.value; }
    try {
      const parsed = JSON.parse(text);
      let blocks, settings;
      if (Array.isArray(parsed)) { blocks = parsed; settings = Editor.pageSettings; }
      else if (typeof parsed === 'object' && parsed !== null) { blocks = parsed.blocks || []; settings = parsed.settings || Editor.pageSettings; }
      else throw new Error('Nieprawidłowa struktura');
      if (!Array.isArray(blocks)) throw new Error('Pole "blocks" musi być tablicą');
      Editor.blocks = blocks;
      Editor.pageSettings = settings;
      Editor.selectedId = null;
      Editor._markDirty();
      Editor._applyPageSettingsToEditor();
      Editor._renderPageSettingsForm();
      return true;
    } catch(e) {
      if (strict) Editor._toast('Błąd JSON: ' + e.message, 'err');
      return false;
    }
  },

  // ── CSS split-pane mode ────────────────────────────────────────────────────
  _renderCssEditor() {
    // Snippets bar
    const snippetsBar = document.getElementById('css-snippets-bar');
    if (snippetsBar) {
      snippetsBar.innerHTML = `
        <span class="css-snippets-label">Snippet:</span>
        ${this._snippets.map((s, i) => `
          <button class="css-snippet-btn" onclick="EditorCode._insertSnippet(${i})">${s.label}</button>
        `).join('')}
        <span class="css-snippets-hint">Kliknij blok w podglądzie →</span>
      `;
    }

    const ta = document.getElementById('css-editor');
    if (ta) {
      ta.value = this.cssText;
      ta.oninput = () => {
        this.cssText = ta.value;
        Editor.profileCss = ta.value;
        Editor._markDirty(false);
        this._applyCssLivePreview();
        this._updateCssPreview();
      };
    }

    this._updateCssPreview();
    this._applyCssLivePreview();
  },

  _insertSnippet(idx) {
    const ta = document.getElementById('css-editor');
    if (!ta) return;
    let code = this._snippets[idx].code;
    // Jeśli jest wybrany blok w podglądzie — wstaw jego ID
    const bid = this._selectedPreviewBlock || Editor.selectedId;
    if (bid) code = code.replace(/\bID\b/g, bid);
    const pos = ta.selectionEnd;
    ta.value = ta.value.slice(0, pos) + code + ta.value.slice(pos);
    ta.selectionStart = ta.selectionEnd = pos + code.length;
    ta.focus();
    this.cssText = ta.value;
    Editor.profileCss = ta.value;
    Editor._markDirty(false);
    this._applyCssLivePreview();
    this._updateCssPreview();
  },

  _updateCssPreview() {
    const previewCanvas = document.getElementById('css-preview-canvas');
    if (!previewCanvas) return;

    // Render bloków z data-bid wrapperami (bez trybu edycji)
    const blocksHtml = (Editor.blocks || []).map(b =>
      `<div data-bid="${b.id}" class="css-prev-block">${Renderer._inner(b, false)}</div>`
    ).join('');

    previewCanvas.innerHTML = blocksHtml ||
      '<div style="padding:2rem;text-align:center;color:#3d5468;font-style:italic;">Brak bloków — dodaj je w trybie Wizualny</div>';

    // Dodaj click handlery do bloków w podglądzie
    previewCanvas.querySelectorAll('.css-prev-block').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        EditorCode._focusBlockCss(el.dataset.bid);
      });
    });

    // Przywróć podświetlenie wybranego
    if (this._selectedPreviewBlock) {
      this._highlightPreviewBlock(this._selectedPreviewBlock);
    }

    // Zastosuj CSS do podglądu
    let previewStyle = document.getElementById('css-preview-style');
    if (!previewStyle) {
      previewStyle = document.createElement('style');
      previewStyle.id = 'css-preview-style';
      document.head.appendChild(previewStyle);
    }
    previewStyle.textContent = this._scopeCssClient(this.cssText, '#css-preview-canvas');
  },

  // Kliknięcie bloku w podglądzie — skocz do jego CSS lub wstaw szablon
  _focusBlockCss(blockId) {
    this._selectedPreviewBlock = blockId;
    this._highlightPreviewBlock(blockId);

    const ta = document.getElementById('css-editor');
    if (!ta) return;

    const searchStr = `[data-bid="${blockId}"]`;
    const idx = ta.value.indexOf(searchStr);

    if (idx !== -1) {
      // Znaleziono — przewiń i zaznacz
      ta.focus();
      ta.setSelectionRange(idx, idx + searchStr.length);
      const lineH = 22;
      const lines = ta.value.substring(0, idx).split('\n');
      ta.scrollTop = Math.max(0, (lines.length - 3)) * lineH;
      Editor._toast(`Znaleziono styl bloku ${blockId}`, 'ok');
    } else {
      // Nie ma — wstaw pusty szablon
      const snippet = `\n[data-bid="${blockId}"] {\n  \n}\n`;
      ta.value += snippet;
      const newIdx = ta.value.lastIndexOf(`[data-bid="${blockId}"]`);
      ta.focus();
      ta.setSelectionRange(newIdx, newIdx + searchStr.length);
      ta.scrollTop = ta.scrollHeight;
      this.cssText = ta.value;
      Editor.profileCss = ta.value;
      Editor._markDirty(false);
      this._applyCssLivePreview();
      this._updateCssPreview();
      Editor._toast(`Dodano szablon dla bloku ${blockId}`, 'ok');
    }
  },

  _highlightPreviewBlock(blockId) {
    document.querySelectorAll('.css-prev-block').forEach(el => {
      if (el.dataset.bid === blockId) {
        el.style.outline = '2px solid var(--accent)';
        el.style.outlineOffset = '2px';
      } else {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    });
  },

  _applyCssLivePreview() {
    let style = document.getElementById('user-css-preview');
    if (!style) {
      style = document.createElement('style');
      style.id = 'user-css-preview';
      document.head.appendChild(style);
    }
    style.textContent = this._scopeCssClient(this.cssText, '#canvas');
  },

  _scopeCssClient(css, scope) {
    if (!css) return '';
    css = css.replace(/javascript\s*:/gi, '/*x*/');
    css = css.replace(/@import[^;]*;/gi, '/*x*/');
    css = css.replace(/expression\s*\(/gi, '/*x*/(');
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    let result = '', i = 0, n = css.length;
    while (i < n) {
      while (i < n && /\s/.test(css[i])) { result += css[i]; i++; }
      if (i >= n) break;
      if (css[i] === '@') {
        let end = i;
        while (end < n && css[end] !== '{' && css[end] !== ';') end++;
        const header = css.slice(i, end);
        result += header;
        if (end < n && css[end] === ';') { result += ';'; i = end + 1; continue; }
        if (end < n && css[end] === '{') {
          let depth = 1, j = end + 1;
          while (j < n && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
          const inner = css.slice(end + 1, j - 1);
          result += /@keyframes|@-webkit-keyframes|@font-face/i.test(header)
            ? '{' + inner + '}'
            : '{' + this._scopeCssClient(inner, scope) + '}';
          i = j; continue;
        }
      }
      const selStart = i;
      while (i < n && css[i] !== '{') i++;
      if (i >= n) { result += css.slice(selStart); break; }
      const sel = css.slice(selStart, i);
      const scoped = sel.split(',').map(s => s.trim()).filter(Boolean).map(s => `${scope} ${s}`).join(', ');
      let depth = 1, j = i + 1;
      while (j < n && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      result += `${scoped}{${css.slice(i + 1, j - 1)}}`;
      i = j;
    }
    return result;
  },

  // ── Tutorial ───────────────────────────────────────────────────────────────
  showTutorial(mode) {
    const tut = document.getElementById('tutorial-overlay');
    const content = document.getElementById('tutorial-content');
    const title = document.getElementById('tutorial-title');
    if (!tut || !content) return;
    if (mode === 'json') { title.textContent = 'Tutorial: edycja struktury (JSON)'; content.innerHTML = this._jsonTutorialHtml(); }
    else { title.textContent = 'Tutorial: własny CSS'; content.innerHTML = this._cssTutorialHtml(); }
    tut.classList.add('open');
  },

  _jsonTutorialHtml() {
    return `
<h3>Czym jest JSON struktury?</h3>
<p>To zapis tekstowy całego twojego profilu. Każdy blok który widzisz w trybie wizualnym to jeden obiekt w tym JSONie.</p>
<h3>Struktura pojedynczego bloku</h3>
<pre>{
  "id": "b8x4k2m",
  "type": "heading",
  "props": {
    "content": "Mój nagłówek",
    "level": 2,
    "color": "#a8c8e0"
  }
}</pre>
<h3>Bloki z dziećmi</h3>
<pre>{
  "id": "b1",
  "type": "container",
  "props": { "columns": 2, "gap": 16 },
  "children": [
    { "id": "b2", "type": "text", "props": { "content": "Lewa kolumna" } },
    { "id": "b3", "type": "text", "props": { "content": "Prawa kolumna" } }
  ]
}</pre>
<h3>Dostępne typy bloków</h3>
<ul>
  <li><code>container</code>, <code>cards</code>, <code>slider_v</code>, <code>slider_h</code> — układy</li>
  <li><code>richtext</code>, <code>text</code>, <code>heading</code>, <code>quote</code>, <code>badge</code> — treść</li>
  <li><code>image</code>, <code>divider</code>, <code>spacer</code> — media i dekoracje</li>
</ul>`;
  },

  _cssTutorialHtml() {
    return `
<h3>Jak używać edytora CSS?</h3>
<p>Po lewej piszesz CSS, po prawej widzisz efekt na żywo. <strong>Kliknij blok w podglądzie</strong> — edytor przeskoczy do jego stylu lub doda pusty szablon.</p>

<h3>Jak celować w blok?</h3>
<pre>[data-bid="twoje_id"] {
  background: linear-gradient(135deg, #2a1a3a, #0a0a1a);
  border-radius: 12px;
}</pre>
<p>ID bloku znajdziesz klikając go w podglądzie — zostanie zaznaczone w edytorze lub automatycznie wstawione.</p>

<h3>Przykład: animacja wejścia</h3>
<pre>@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
h1, h2 { animation: fadeIn 0.6s ease-out; }</pre>

<h3>Czego nie wolno?</h3>
<ul>
  <li><code>position: fixed</code> — mogłoby przesłonić interfejs</li>
  <li><code>@import</code>, <code>javascript:</code> — zablokowane ze względów bezpieczeństwa</li>
</ul>`;
  },

  closeTutorial() {
    document.getElementById('tutorial-overlay')?.classList.remove('open');
  },
};
