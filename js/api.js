// api.js — Authenticated fetch wrapper. All HTTP calls go through here.
const API = {
  async request(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(State.token ? { 'Authorization': 'Bearer ' + State.token } : {}),
    };
 
    const res = await fetch(Config.PROXY + path, {
      ...opts,
      headers,
      body: opts.body !== undefined
        ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
        : undefined,
    });
 
    // Session expired — log out and reload
    if (res.status === 401) {
      State.clearSession();
      Auth.showLogin();
      throw new Error('Sesja wygasła — zaloguj się ponownie');
    }
 
    const data = await res.json();
    return data;
  },
 
  get: (path) => API.request(path, { method: 'GET' }),
  post: (path, body) => API.request(path, { method: 'POST', body }),
  put: (path, body) => API.request(path, { method: 'PUT', body }),
  delete: (path) => API.request(path, { method: 'DELETE' }),
};
