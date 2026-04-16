// ui.js — Shared UI utilities used across all modules.
const UI = {
  // ── Message display ──────────────────────────────────────────────────────
  showMsg(okId, errId, type, text) {
    const ok = document.getElementById(okId);
    const err = document.getElementById(errId);
    if (ok) ok.style.display = 'none';
    if (err) err.style.display = 'none';
    const el = type === 'ok' ? ok : err;
    if (el) { el.textContent = text; el.style.display = 'block'; }
  },

  ok(okId, errId, text) { this.showMsg(okId, errId, 'ok', text); },
  err(okId, errId, text) { this.showMsg(okId, errId, 'err', text); },

  clearMsg(okId, errId) {
    const ok = document.getElementById(okId);
    const err = document.getElementById(errId);
    if (ok) ok.style.display = 'none';
    if (err) err.style.display = 'none';
  },

  // ── Status bar ───────────────────────────────────────────────────────────
  setStatus(statusId, spinnerId, msg, loading = false) {
    const status = document.getElementById(statusId);
    const spinner = document.getElementById(spinnerId);
    if (status) status.textContent = msg;
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
  },

  // ── Tab switching ────────────────────────────────────────────────────────
  switchTab(tabs, contents, name, onSwitch = null) {
    tabs.forEach((tab, i) => tab.classList.toggle('active', contents[i] === name));
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === 'tab-' + name);
    });
    if (onSwitch) onSwitch(name);
  },

  // ── Button state ─────────────────────────────────────────────────────────
  disable(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  },

  enable(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  },

  // ── Show/hide ────────────────────────────────────────────────────────────
  show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; },
  hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },
  toggle(id, condition) {
    const el = document.getElementById(id);
    if (el) el.style.display = condition ? 'block' : 'none';
  },

  // ── Populate select ──────────────────────────────────────────────────────
  populateSelect(selectId, items, labelFn, valueFn, prevValue = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">— wybierz —</option>';
    items.forEach(item => {
      const o = document.createElement('option');
      o.value = valueFn(item);
      o.textContent = labelFn(item);
      if (String(o.value) === String(prevValue)) o.selected = true;
      sel.appendChild(o);
    });
  },
};
