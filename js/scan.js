// scan.js — Image upload, scanning, and result display.
const Scan = {
  // ── Image management ─────────────────────────────────────────────────────
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
    if (zone._dropZoneInit) return; // zapobiega wielokrotnemu dodaniu listenerów
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
      const scanView = document.getElementById('sheet-view-scan');
      if (!scanView || scanView.style.display === 'none') return;
      Array.from(e.clipboardData.items)
        .filter(i => i.type.startsWith('image/'))
        .forEach(i => this.addImage(i.getAsFile()));
    });
  },

  // ── Scanning ─────────────────────────────────────────────────────────────
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
      this._renderResults();
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
    const charName = document.getElementById('char-select')?.selectedOptions[0]?.text || 'Ilość';
    let csv = 'Przedmiot,Kategoria,Ilość\n';
    State.scanMatched.forEach(i => {
      csv += `"${i.name}","${i.category}",${i.quantity}\n`;
    });
    navigator.clipboard.writeText(csv).then(() =>
      UI.ok('scan-ok', 'scan-err', 'CSV skopiowano do schowka.')
    );
  },

  _renderResults() {
    const body = document.getElementById('results-body');
    const unknownBody = document.getElementById('unknown-body');
    if (!body || !unknownBody) return;

    body.innerHTML = '';
    State.scanMatched.forEach(item => {
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

    UI.show('scan-results');

    if (State.scanUnmatched.length) {
      unknownBody.innerHTML = '';
      State.scanUnmatched.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;justify-content:space-between;padding:5px 0;' +
          'border-bottom:1px solid rgba(133,214,242,0.07);font-size:0.9rem;';
        row.innerHTML =
          `<span>${item.raw_name}</span>` +
          `<span style="color:var(--gold-l);margin-left:1rem;">${item.quantity}</span>`;
        unknownBody.appendChild(row);
      });
      UI.show('unknown-wrap');
      UI.show('rescan-wrap');
    } else {
      UI.hide('unknown-wrap');
      UI.hide('rescan-wrap');
    }
  },
};
