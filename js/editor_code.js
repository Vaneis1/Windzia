// editor_code.js — Code editing modes (JSON structure + CSS) for editor

const EditorCode = {
  mode: 'visual', // 'visual' | 'json' | 'css'
  jsonText: '',
  cssText: '',
  jsonError: null,

  init() {
    // Restore CSS from loaded data (set by Editor.init)
    this.cssText = Editor.profileCss || '';
  },

  switchMode(newMode) {
    if (newMode === this.mode) return;

    // Leaving JSON mode: try to apply
    if (this.mode === 'json' && newMode !== 'json') {
      const ok = this._applyJsonText(false);
      if (!ok && !confirm('JSON ma błąd — czy na pewno chcesz wyjść? Niezapisane zmiany przepadną.')) {
        return;
      }
    }
    // Leaving CSS mode: capture latest text from textarea
    if (this.mode === 'css' && newMode !== 'css') {
      const ta = document.getElementById('css-editor');
      if (ta) this.cssText = ta.value;
      Editor.profileCss = this.cssText;
      this._applyCssToEditor();
    }

    this.mode = newMode;
    this._render();
  },

  _render() {
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === this.mode);
    });

    const visual = document.getElementById('mode-visual');
    const json = document.getElementById('mode-json');
    const css = document.getElementById('mode-css');
    const sidebar = document.querySelector('.sidebar');
    const props = document.querySelector('.props-panel');

    if (this.mode === 'visual') {
      visual.style.display = 'flex';
      json.style.display = 'none';
      css.style.display = 'none';
      if (sidebar) sidebar.style.display = '';
      if (props) props.style.display = '';
      Editor.render();
    } else if (this.mode === 'json') {
      visual.style.display = 'none';
      json.style.display = 'flex';
      css.style.display = 'none';
      if (sidebar) sidebar.style.display = 'none';
      if (props) props.style.display = 'none';
      this._renderJsonEditor();
    } else if (this.mode === 'css') {
      visual.style.display = 'none';
      json.style.display = 'none';
      css.style.display = 'flex';
      if (sidebar) sidebar.style.display = 'none';
      if (props) props.style.display = 'none';
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
      // Quick structure check
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Musi być obiektem lub tablicą');
      this.jsonError = null;
      if (status) {
        status.textContent = '✓ Poprawny JSON';
        status.className = 'code-status code-status-ok';
      }
      return true;
    } catch(e) {
      this.jsonError = e.message;
      if (status) {
        status.textContent = '✕ Błąd: ' + e.message;
        status.className = 'code-status code-status-err';
      }
      return false;
    }
  },

  applyJsonNow() {
    const ta = document.getElementById('json-editor');
    if (!ta) return;
    if (this._applyJsonText(true, ta.value)) {
      Editor._toast('Zastosowano zmiany w strukturze', 'ok');
    }
  },

  _applyJsonText(strict = false, text = null) {
    if (text === null) {
      const ta = document.getElementById('json-editor');
      if (!ta) return false;
      text = ta.value;
    }
    try {
      const parsed = JSON.parse(text);
      let blocks, settings;
      if (Array.isArray(parsed)) {
        blocks = parsed;
        settings = Editor.pageSettings;
      } else if (typeof parsed === 'object' && parsed !== null) {
        blocks = parsed.blocks || [];
        settings = parsed.settings || Editor.pageSettings;
      } else {
        throw new Error('Nieprawidłowa struktura');
      }
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

  // ── CSS mode ───────────────────────────────────────────────────────────────
  _renderCssEditor() {
    const ta = document.getElementById('css-editor');
    if (ta) {
      ta.value = this.cssText;
      ta.oninput = () => {
        this.cssText = ta.value;
        Editor.profileCss = ta.value;
        Editor._markDirty(false); // keep dirty flag, don't push history each keystroke
        this._applyCssLivePreview();
      };
    }
    this._applyCssLivePreview();
  },

  _applyCssLivePreview() {
    // Apply user CSS to a preview area inside the editor
    let style = document.getElementById('user-css-preview');
    if (!style) {
      style = document.createElement('style');
      style.id = 'user-css-preview';
      document.head.appendChild(style);
    }
    // Scope to the canvas-inner so it works in editor preview
    const scoped = this._scopeCssClient(this.cssText, '#canvas');
    style.textContent = scoped;
  },

  _applyCssToEditor() {
    // Same as live preview - re-apply when leaving css mode
    this._applyCssLivePreview();
  },

  // Client-side CSS scoping for live preview (server does the real sanitization)
  _scopeCssClient(css, scope) {
    if (!css) return '';
    // Strip dangerous patterns for preview safety
    css = css.replace(/javascript\s*:/gi, '/*x*/');
    css = css.replace(/@import[^;]*;/gi, '/*x*/');
    css = css.replace(/expression\s*\(/gi, '/*x*/(');
    css = css.replace(/\/\*.*?\*\//gs, ''); // strip comments

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

    if (mode === 'json') {
      title.textContent = 'Tutorial: edycja struktury (JSON)';
      content.innerHTML = this._jsonTutorialHtml();
    } else {
      title.textContent = 'Tutorial: własny CSS';
      content.innerHTML = this._cssTutorialHtml();
    }
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
<p>Trzy pola: <strong>id</strong> (unikalny identyfikator), <strong>type</strong> (rodzaj bloku), <strong>props</strong> (właściwości).</p>

<h3>Bloki z dziećmi</h3>
<p>Kontenery, suwaki i siatki kart mają dodatkowe pole <strong>children</strong> — tablicę bloków wewnątrz:</p>
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
  <li><code>richtext</code> — tekst sformatowany (HTML wewnątrz <code>props.content</code>)</li>
  <li><code>text</code>, <code>heading</code>, <code>quote</code>, <code>badge</code> — tekstowe</li>
  <li><code>image</code> — obraz</li>
  <li><code>divider</code>, <code>spacer</code> — dekoracyjne</li>
</ul>

<h3>Praktyczne wskazówki</h3>
<ul>
  <li><strong>Identyfikatory</strong> — jeśli kopiujesz blok, wygeneruj nowe id (dowolny tekst typu <code>"b" + losowe litery</code>)</li>
  <li><strong>Kolejność</strong> — bloki wyświetlają się w kolejności w jakiej są w tablicy</li>
  <li><strong>Walidacja</strong> — błędny JSON zostanie zaznaczony na czerwono i nie zostanie zapisany</li>
  <li><strong>Reset</strong> — wróć do trybu wizualnego, nie klikając "Zastosuj", aby odrzucić zmiany</li>
</ul>

<h3>Przykład: ustawienie tła całego profilu</h3>
<p>W obiekcie głównym pole <code>settings</code> trzyma ustawienia strony:</p>
<pre>{
  "blocks": [ ... ],
  "settings": {
    "bg_color": "#0a0a0f",
    "bg_image": "https://example.com/tlo.jpg",
    "max_width": "1100px"
  }
}</pre>
    `;
  },

  _cssTutorialHtml() {
    return `
<h3>Po co własny CSS?</h3>
<p>CSS pozwala na efekty których nie ma w panelu — animacje, efekty hover, niestandardowe czcionki, gradient overlays, transformacje 3D. Twój CSS jest aplikowany tylko do twojego profilu, nie wpływa na resztę aplikacji ani innych użytkowników.</p>

<h3>Jak celować w bloki?</h3>
<p>Każdy blok ma atrybut <code>data-bid</code> z jego id. Możesz znaleźć id bloku w trybie JSON. Przykład:</p>
<pre>[data-bid="b8x4k2m"] {
  background: linear-gradient(135deg, #2a1a3a, #0a0a1a);
  border-radius: 12px;
}</pre>

<h3>Globalne klasy</h3>
<p>Wszystkie bloki danego typu mają wspólną klasę <code>.profile-container</code>. Możesz też używać własnych klas — wystarczy dodać je w polu <code>className</code> bloku w trybie JSON (jeśli typ je obsługuje) lub po prostu celować w typ.</p>

<h3>Przykład: animowane wejście nagłówków</h3>
<pre>@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

h1, h2, h3 {
  animation: fadeIn 0.6s ease-out;
}</pre>

<h3>Przykład: efekt hover na obrazach</h3>
<pre>img {
  transition: transform 0.3s, box-shadow 0.3s;
}

img:hover {
  transform: scale(1.03);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}</pre>

<h3>Przykład: gradient na tle kontenera</h3>
<pre>[data-bid="b1k2j3"] {
  background: linear-gradient(
    135deg,
    rgba(120, 80, 200, 0.2),
    rgba(40, 80, 160, 0.1)
  );
  backdrop-filter: blur(8px);
}</pre>

<h3>Przykład: niestandardowa czcionka</h3>
<pre>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond&display=swap');

h1, h2 {
  font-family: 'Cormorant Garamond', serif;
}</pre>
<p class="warn-note">⚠ <code>@import</code> jest zablokowany ze względów bezpieczeństwa. Użyj zamiast tego <code>&lt;link&gt;</code> w panelu CSS — niedostępne. Najlepiej używać czcionek systemowych lub dodawać przez ustawienia bloku.</p>

<h3>Czego nie wolno?</h3>
<ul>
  <li><code>position: fixed</code> i <code>position: sticky</code> — mogłyby przesłonić interfejs</li>
  <li><code>@import</code>, <code>javascript:</code>, <code>expression()</code> — zablokowane</li>
  <li>Skrypty, iframe, JavaScript — niemożliwe</li>
  <li>Twój CSS jest automatycznie zawężany do <code>#profile-blocks</code> — nie wycieknie poza profil</li>
</ul>

<h3>Zmienne kolorystyczne</h3>
<p>Możesz używać CSS custom properties żeby spójnie zarządzać kolorami:</p>
<pre>#profile-blocks {
  --akcent: #c8a060;
  --tlo: #1a1410;
}

h1, h2 { color: var(--akcent); }
.profile-container { border-color: var(--akcent); }</pre>
    `;
  },

  closeTutorial() {
    document.getElementById('tutorial-overlay')?.classList.remove('open');
  },
};
