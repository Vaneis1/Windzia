// scan.js — Image OCR scanning and text paste parser.
const Scan = {

  // ── Tab switching ─────────────────────────────────────────────────────────
  _scanTab: 'ocr',   // 'ocr' | 'paste'

  switchScanTab(tab) {
    this._scanTab = tab;
    ['ocr', 'paste'].forEach(t => {
      const el = document.getElementById('scan-tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
      const btn = document.querySelector(`[data-scan-tab="${t}"]`);
      if (btn) btn.classList.toggle('active', t === tab);
    });
  },

  // ── OCR: Image management ─────────────────────────────────────────────────
  addImage(file) {
    const mime = file.type || 'image/png';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const id = Date.now() + Math.random();
      State.images.push({
        id,
        data: ev.target.result.split(',')[1],
        mime_type: mime,
        dataUrl: ev.target.result,
      });
      this._renderPreviews();
      UI.enable('scan-btn');
      UI.setStatus('scan-status', 'scan-spinner',
        State.images.length + ' zrzut(ów) wczytanych.');
    };
    reader.readAsDataURL(file);
  },

  removeImage(id) {
    State.images = State.images.filter(i => i.id !== id);
    this._renderPreviews();
    if (!State.images.length) {
      UI.disable('scan-btn');
      UI.setStatus('scan-status', 'scan-spinner', '');
    } else {
      UI.setStatus('scan-status', 'scan-spinner',
        State.images.length + ' zrzut(ów) wczytanych.');
    }
  },

  _renderPreviews() {
    const el = document.getElementById('previews');
    if (!el) return;
    el.innerHTML = '';
    State.images.forEach(img => {
      const w = document.createElement('div');
      w.className = 'preview-item';
      w.innerHTML = `<img src="${img.dataUrl}" alt="Preview">
        <button class="rm" onclick="Scan.removeImage(${img.id})">✕</button>`;
      el.appendChild(w);
    });
  },

  initDropZone() {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;
    if (zone._dropZoneInit) return;
    zone._dropZoneInit = true;

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag');
      Array.from(e.dataTransfer.files)
        .filter(f => f.type.startsWith('image/'))
        .forEach(f => this.addImage(f));
    });

    document.addEventListener('paste', e => {
      // Only intercept image paste when OCR tab is active
      if (this._scanTab !== 'ocr') return;
      const scanView = document.getElementById('sheet-view-scan');
      if (!scanView || scanView.style.display === 'none') return;
      Array.from(e.clipboardData.items)
        .filter(i => i.type.startsWith('image/'))
        .forEach(i => this.addImage(i.getAsFile()));
    });
  },

  // ── OCR: Scanning ─────────────────────────────────────────────────────────
  async run() {
    if (!State.images.length) return;
    const charId = document.getElementById('char-select')?.value;
    if (!charId) {
      UI.err('scan-ok', 'scan-err', 'Wybierz postać przed skanowaniem.');
      return;
    }

    UI.disable('scan-btn');
    UI.clearMsg('scan-ok', 'scan-err');
    UI.setStatus('scan-status', 'scan-spinner',
      'Skanowanie ' + State.images.length + ' zrzut(ów)...', true);

    State.scanMatched = [];
    State.scanUnmatched = [];

    try {
      const data = await API.post('/scan', {
        images: State.images.map(i => ({ data: i.data, mime_type: i.mime_type })),
        character_id: parseInt(charId),
      });
      if (data.error) throw new Error(data.error);

      State.scanMatched = data.matched || [];
      State.scanUnmatched = data.unmatched || [];
      this._renderResults('scan-results', 'results-body', 'unknown-wrap', 'unknown-body', 'rescan-wrap');
      UI.enable('save-btn', 'csv-btn');
      UI.setStatus('scan-status', 'scan-spinner',
        State.scanMatched.length + ' dopasowanych · ' +
        State.scanUnmatched.length + ' pominięto.');
    } catch (e) {
      UI.err('scan-ok', 'scan-err', 'Błąd: ' + e.message);
      UI.setStatus('scan-status', 'scan-spinner', '');
    } finally {
      UI.enable('scan-btn');
    }
  },

  async save() {
    const charId = document.getElementById('char-select')?.value;
    if (!charId || !State.scanMatched.length) {
      UI.err('scan-ok', 'scan-err', 'Brak danych do zapisania.');
      return;
    }

    UI.disable('save-btn');
    UI.setStatus('scan-status', 'scan-spinner', 'Zapisywanie...', true);

    try {
      const data = await API.post('/scan', {
        images: State.images.map(i => ({ data: i.data, mime_type: i.mime_type })),
        character_id: parseInt(charId),
        save: true,
      });
      if (data.error) throw new Error(data.error);
      UI.setStatus('scan-status', 'scan-spinner', '');
      UI.ok('scan-ok', 'scan-err',
        'Zapisano ' + State.scanMatched.length + ' przedmiotów.');
    } catch (e) {
      UI.err('scan-ok', 'scan-err', 'Błąd: ' + e.message);
      UI.setStatus('scan-status', 'scan-spinner', '');
    } finally {
      UI.enable('save-btn');
    }
  },

  async rescan() {
    if (!State.images.length) {
      UI.err('scan-ok', 'scan-err', 'Brak zrzutów do ponownego skanowania.');
      return;
    }
    UI.hide('scan-results');
    await this.run();
  },

  copyCSV() {
    let csv = 'Przedmiot,Kategoria,Ilość\n';
    State.scanMatched.forEach(i => {
      csv += `"${i.name}","${i.category}",${i.quantity}\n`;
    });
    navigator.clipboard.writeText(csv).then(() =>
      UI.ok('scan-ok', 'scan-err', 'CSV skopiowano do schowka.')
    );
  },

  // ── Paste: text parser ────────────────────────────────────────────────────
  // State for paste tab (separate from OCR state)
  _pasteMatched: [],
  _pasteUnmatched: [],

  /**
   * Parse raw kf2.pl inventory text.
   * Format repeats every 3 lines: name → qty → name(duplicate).
   * Returns [{name, qty}] with duplicates already summed.
   */
  _parseRawText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const acc = {};
    let i = 0;
    while (i < lines.length) {
      const name = lines[i];
      const qty = parseInt(lines[i + 1], 10);
      if (!isNaN(qty) && qty > 0) {
        acc[name] = (acc[name] || 0) + qty;
        i += 3;  // name, qty, duplicate name
      } else {
        i += 1;  // unexpected line — skip
      }
    }
    return Object.entries(acc).map(([name, qty]) => ({ name, qty }));
  },

  async runPaste() {
    const textarea = document.getElementById('paste-textarea');
    const text = textarea?.value?.trim();
    if (!text) {
      UI.err('paste-ok', 'paste-err', 'Wklej tekst ekwipunku z kf2.pl.');
      return;
    }

    const charId = document.getElementById('char-select')?.value;
    if (!charId) {
      UI.err('paste-ok', 'paste-err', 'Wybierz postać.');
      return;
    }

    const items = this._parseRawText(text);
    if (!items.length) {
      UI.err('paste-ok', 'paste-err', 'Nie udało się rozpoznać formatu. Upewnij się że zaznaczyłeś całą stronę ekwipunku (Ctrl+A).');
      return;
    }

    UI.disable('paste-load-btn');
    UI.clearMsg('paste-ok', 'paste-err');
    UI.setStatus('paste-status', 'paste-spinner', 'Dopasowywanie ' + items.length + ' surowców...', true);
    UI.hide('paste-results');

    try {
      const data = await API.post('/paste', {
        character_id: parseInt(charId),
        items,
      });
      if (data.error) throw new Error(data.error);

      this._pasteMatched = data.matched || [];
      this._pasteUnmatched = data.unmatched || [];
      this._renderResults('paste-results', 'paste-results-body', 'paste-unknown-wrap', 'paste-unknown-body', null);
      UI.enable('paste-save-btn', 'paste-csv-btn');
      UI.setStatus('paste-status', 'paste-spinner',
        this._pasteMatched.length + ' dopasowanych · ' +
        this._pasteUnmatched.length + ' pominięto.');
    } catch (e) {
      UI.err('paste-ok', 'paste-err', 'Błąd: ' + e.message);
      UI.setStatus('paste-status', 'paste-spinner', '');
    } finally {
      UI.enable('paste-load-btn');
    }
  },

  async savePaste() {
    const charId = document.getElementById('char-select')?.value;
    if (!charId || !this._pasteMatched.length) {
      UI.err('paste-ok', 'paste-err', 'Brak danych do zapisania.');
      return;
    }

    const textarea = document.getElementById('paste-textarea');
    const items = this._parseRawText(textarea?.value || '');

    UI.disable('paste-save-btn');
    UI.setStatus('paste-status', 'paste-spinner', 'Zapisywanie...', true);

    try {
      const data = await API.post('/paste', {
        character_id: parseInt(charId),
        items,
        save: true,
      });
      if (data.error) throw new Error(data.error);
      UI.setStatus('paste-status', 'paste-spinner', '');
      UI.ok('paste-ok', 'paste-err',
        'Zapisano ' + this._pasteMatched.length + ' przedmiotów.');
    } catch (e) {
      UI.err('paste-ok', 'paste-err', 'Błąd: ' + e.message);
      UI.setStatus('paste-status', 'paste-spinner', '');
    } finally {
      UI.enable('paste-save-btn');
    }
  },

  copyPasteCSV() {
    let csv = 'Przedmiot,Kategoria,Ilość\n';
    this._pasteMatched.forEach(i => {
      csv += `"${i.name}","${i.category}",${i.quantity}\n`;
    });
    navigator.clipboard.writeText(csv).then(() =>
      UI.ok('paste-ok', 'paste-err', 'CSV skopiowano do schowka.')
    );
  },

  // ── Shared results renderer ───────────────────────────────────────────────
  // Used by both OCR and paste tabs — just pass different element IDs.
  _renderResults(resultsId, bodyId, unknownWrapId, unknownBodyId, rescanWrapId) {
    const matched   = resultsId === 'scan-results' ? State.scanMatched   : this._pasteMatched;
    const unmatched = resultsId === 'scan-results' ? State.scanUnmatched : this._pasteUnmatched;

    const body = document.getElementById(bodyId);
    const unknownBody = document.getElementById(unknownBodyId);
    if (!body || !unknownBody) return;

    body.innerHTML = '';
    matched.forEach(item => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <div>
          <div>${item.name}</div>
          ${item.raw_name !== item.name
            ? `<div class="sub-name">↳ ${item.raw_name}</div>`
            : ''}
        </div>
        <div class="qty">${item.quantity}</div>
        <div class="cat-cell">${item.category}</div>`;
      body.appendChild(row);
    });

    UI.show(resultsId);

    if (unmatched.length) {
      unknownBody.innerHTML = '';
      unmatched.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;justify-content:space-between;padding:5px 0;' +
          'border-bottom:1px solid rgba(133,214,242,0.07);font-size:0.9rem;';
        row.innerHTML =
          `<span>${item.raw_name}</span>` +
          `<span style="color:var(--gold-l);margin-left:1rem;">${item.quantity}</span>`;
        unknownBody.appendChild(row);
      });
      UI.show(unknownWrapId);
    } else {
      UI.hide(unknownWrapId);
    }

    if (rescanWrapId) {
      unmatched.length ? UI.show(rescanWrapId) : UI.hide(rescanWrapId);
    }
  },
};
