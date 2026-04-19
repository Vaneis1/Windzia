// editor_code.js — Code editing modes (JSON + CSS split-pane)

const EditorCode = {
  mode: 'visual',
  jsonText: '',
  cssText: '',
  jsonError: null,

  // CSS snippets — wstawiane do edytora
  _snippets: [
    { label: 'gradient tła', code: '\n[data-bid="ID_BLOKU"] {\n  background: linear-gradient(\n    135deg,\n    #141920,\n    #1e3a5f\n  );\n}\n' },
    { label: 'tło-obrazek', code: '\n[data-bid="ID_BLOKU"] {\n  background-image: url("ADRES_URL");\n  background-size: cover;\n  background-position: center;\n}\n' },
    { label: 'ramka', code: '\n[data-bid="ID_BLOKU"] {\n  border: 1px solid #7ba7c4;\n  border-radius: 8px;\n}\n' },
    { label: 'cień', code: '\n[data-bid="ID_BLOKU"] {\n  box-shadow: 0 4px 20px rgba(0,0,0,0.4);\n}\n' },
    { label: 'zaokrąglenie', code: '\n[data-bid="ID_BLOKU"] {\n  border-radius: 12px;\n  overflow: hidden;\n}\n' },
    { label: 'czcionka', code: '\n[data-bid="ID_BLOKU"] {\n  font-family: "Cinzel", serif;\n  color: #a8c8e0;\n  letter-spacing: 0.1em;\n}\n' },
    { label: 'hover na obrazek', code: '\n[data-bid="ID_BLOKU"] img {\n  transition: transform 0.3s;\n}\n[data-bid="ID_BLOKU"] img:hover {\n  transform: scale(1.04);\n}\n' },
    { label: 'animacja wejścia', code: '\n@keyframes fadeIn {\n  from { opacity: 0; transform: translateY(16px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n[data-bid="ID_BLOKU"] {\n  animation: fadeIn 0.5s ease-out;\n}\n' },
    { label: 'tło strony', code: '\n/* Tło całej strony profilu */\nbody {\n  background: #0e1117;\n  background-image: url("ADRES_URL");\n  background-size: cover;\n  background-attachment: fixed;\n}\n' },
  ],

  init() {
    this.cssText = Editor.profileCss || '';
  },

  switchMode(newMode) {
    if (newMode === this.mode) return;

    if (this.mode === 'json' && newMode !== 'json') {
      const ok = this._applyJsonText(false);
      if (!ok && !confirm('JSON ma błąd — czy na pewno chcesz wyjść? Niezapisane zmiany przepadną.')) {
        return;
      }
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

    const visual = document.getElementById('mode-visual');
    const json   = document.getElementById('mode-json');
    const css    = document.getElementById('mode-css');
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
        <span class="css-snippets-label">Wstaw snippet:</span>
        ${this._snippets.map((s, i) => `
          <button class="css-snippet-btn" onclick="EditorCode._insertSnippet(${i})"
            title="${s.code.trim().slice(0, 80)}">
            ${s.label}
          </button>`).join('')}
        <span class="css-snippets-hint">Zaznacz blok w wizualnym, by skopiować jego ID</span>
      `;
    }

    // Textarea
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

    // Live preview
    this._updateCssPreview();
    this._applyCssLivePreview();
  },

  _insertSnippet(idx) {
    const ta = document.getElementById('css-editor');
    if (!ta) return;

    // Jeśli mamy zaznaczony blok, podmień ID_BLOKU
    let code = this._snippets[idx].code;
    const selectedId = Editor.selectedId;
    if (selectedId) code = code.replace(/ID_BLOKU/g, selectedId);

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
    // Render current blocks into preview
    const html = Renderer.render(Editor.blocks, false);
    previewCanvas.innerHTML = html || '<div style="padding:2rem;text-align:center;color:#3d5468;font-style:italic;">Brak bloków do podglądu</div>';
    // Apply scoped CSS to preview
    let previewStyle = document.getElementById('css-preview-style');
    if (!previewStyle) {
      previewStyle = document.createElement('style');
      previewStyle.id = 'css-preview-style';
      document.head.appendChild(previewStyle);
    }
    previewStyle.textContent = this._scopeCssClient(this.cssText, '#css-preview-canvas');
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

    let result = '';
    let i = 0, n = css.length;

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
          if (/@keyframes|@-webkit-keyframes|@font-face/i.test(header)) {
            result += '{' + inner + '}';
          } else {
            result += '{' + this._scopeCssClient(inner, scope) + '}';
          }
          i = j;
          continue;
        }
      }

      const selStart = i;
      while (i < n && css[i] !== '{') i++;
      if (i >= n) { result += css.slice(selStart); break; }
      const sel = css.slice(selStart, i);
      const scoped = sel.split(',').map(s => s.trim()).filter(Boolean).map(s => `${scope} ${s}`).join(', ');
      let depth = 1, j = i + 1;
      while (j < n && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      const body = css.slice(i + 1, j - 1);
      result += `${scoped}{${body}}`;
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
<p>To zapis tekstowy całego twojego profilu. Każdy blok który widzisz w trybie wizualnym to jeden obiekt w tym JSONie. Edycja kodu daje ci pełną kontrolę — możesz np. zduplikować całą sekcję, masowo zmienić kolor wszystkich nagłówków, lub ustawić właściwości których nie ma w panelu.</p>
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
  <li><code>container</code> — kontener z kolumnami</li>
  <li><code>cards</code> — siatka kart</li>
  <li><code>slider_v</code>, <code>slider_h</code> — suwak pionowy/poziomy</li>
  <li><code>richtext</code> — tekst sformatowany</li>
  <li><code>text</code>, <code>heading</code>, <code>quote</code>, <code>badge</code> — tekstowe</li>
  <li><code>image</code> — obraz</li>
  <li><code>divider</code>, <code>spacer</code> — dekoracyjne</li>
</ul>
    `;
  },

  _cssTutorialHtml() {
    return `
<h3>Jak używać edytora CSS?</h3>
<p>Po lewej piszesz CSS, po prawej widzisz efekt w czasie rzeczywistym. Kliknij przycisk snippetu żeby wstawić gotowy kod — jeśli masz zaznaczony blok w trybie wizualnym, <code>ID_BLOKU</code> zostanie zastąpione automatycznie.</p>

<h3>Jak znaleźć ID bloku?</h3>
<p>1. Wróć do trybu Wizualny. 2. Kliknij blok żeby go zaznaczyć. 3. Wróć do CSS i kliknij dowolny snippet — ID wstawi się samoczynnie.</p>
<p>Możesz też znaleźć ID w trybie Struktura (JSON) — pole <code>"id"</code> każdego bloku.</p>

<h3>Przykład: gradient tła bloku</h3>
<pre>[data-bid="twoje_id"] {
  background: linear-gradient(135deg, #2a1a3a, #0a0a1a);
  border-radius: 12px;
}</pre>

<h3>Przykład: animacja wejścia</h3>
<pre>@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
h1, h2, h3 {
  animation: fadeIn 0.6s ease-out;
}</pre>

<h3>Czego nie wolno?</h3>
<ul>
  <li><code>position: fixed</code> — mogłoby przesłonić interfejs</li>
  <li><code>@import</code>, <code>javascript:</code> — zablokowane</li>
  <li>Twój CSS jest automatycznie zawężany do twojego profilu — nie wpływa na resztę</li>
</ul>
    `;
  },

  closeTutorial() {
    document.getElementById('tutorial-overlay')?.classList.remove('open');
  },
};
