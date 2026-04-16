// state.js — Central app state. All modules read/write through this object.
const State = {
  token: localStorage.getItem(Config.TOKEN_KEY) || '',
  currentUser: null,   // { id, username, email, role }
 
  // Scan tab
  images: [],          // [{ id, data, mime_type, dataUrl }]
  scanMatched: [],     // [{ item_id, name, category, raw_name, quantity }]
  scanUnmatched: [],   // [{ raw_name, quantity }]
 
  // Sheet tab
  sheetData: null,     // { characters, categories, items }
  sortCol: 0,
  sortAsc: true,
  activeCategory: '',
 
  // Admin tab
  allItemsAdmin: [],
 
  // ── Token helpers ────────────────────────────────────────────────────────
  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem(Config.TOKEN_KEY, t);
    else localStorage.removeItem(Config.TOKEN_KEY);
  },
 
  setUser(u) {
    this.currentUser = u;
  },
 
  clearSession() {
    this.token = '';
    this.currentUser = null;
    this.images = [];
    this.scanMatched = [];
    this.scanUnmatched = [];
    this.sheetData = null;
    localStorage.removeItem(Config.TOKEN_KEY);
  },
};
