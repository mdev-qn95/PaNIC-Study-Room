/* PaNIC Study Room — catalog loader.
   All provider and certification data lives in /data/catalog.json; this file only loads and indexes it. */
window.PanicCatalog = (() => {
  const C = {PROVIDERS:[], CERTS:[], LEVELS:[]};
  C.provider = id => C.PROVIDERS.find(p => p.id === id);
  C.cert = id => C.CERTS.find(c => c.id === id);
  C.live = () => C.CERTS.filter(c => c.status === 'live');
  C.levelRank = level => { const i = C.LEVELS.indexOf(level); return i < 0 ? 1 : i; };
  C.folder = c => `/data/certs/${c.id}/`;
  C.load = async () => {
    const res = await fetch('/data/catalog.json', {cache:'no-cache'});
    if (!res.ok) throw new Error(`catalog.json: HTTP ${res.status}`);
    const data = await res.json();
    C.PROVIDERS = data.providers; C.CERTS = data.certifications; C.LEVELS = data.levels || [];
    return C;
  };
  return C;
})();
