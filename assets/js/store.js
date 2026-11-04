/* PaNIC Study Room — device-local storage, daily activity and lazy bank loading. */
window.PanicStore = (() => {
  const PREFS = 'panic-prefs-v1', ACTIVITY = 'panic-activity-v1';
  const read = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const shiftDay = (key, delta) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + delta)); };

  const prefs = () => ({theme:'system', goal:20, ...read(PREFS, {})});
  const setPref = (k, v) => { const p = prefs(); p[k] = v; write(PREFS, p); return p; };

  const activity = () => { const a = read(ACTIVITY, {}); return {days:{}, certs:{}, ...a}; };
  /* Count one completed answer for today and remember where the learner was. */
  function recordAnswer(certId, good) {
    const a = activity(), today = dayKey();
    const d = a.days[today] ||= {n:0, good:0};
    d.n++; if (good) d.good++;
    a.certs[certId] = {...(a.certs[certId] || {}), lastAt:Date.now()};
    a.last = certId; write(ACTIVITY, a);
  }
  function touchCert(certId) { const a = activity(); a.certs[certId] = {...(a.certs[certId] || {}), lastAt:Date.now()}; a.last = certId; write(ACTIVITY, a); }
  function streak() {
    const {days} = activity(); let key = dayKey(), n = 0;
    if (!days[key]?.n) key = shiftDay(key, -1); // today not studied yet: streak still alive from yesterday
    while (days[key]?.n) { n++; key = shiftDay(key, -1); }
    return n;
  }
  const today = () => activity().days[dayKey()] || {n:0, good:0};
  /* Last `count` days, oldest first. */
  const recentDays = count => { const {days} = activity(); const out = []; let key = dayKey(); for (let i = 0; i < count; i++) { out.unshift({key, ...(days[key] || {n:0, good:0})}); key = shiftDay(key, -1); } return out; };

  /* Per-certification state written by the study room (format kept from v1). */
  const certState = cert => cert?.storageKey ? read(cert.storageKey, null) : null;
  function summary(cert) {
    const s = certState(cert); if (!s?.study) return null;
    const sum = s.summary || {};
    const answered = sum.answered ?? Object.values(s.study.answers || {}).filter(r => r.graded).length;
    return {answered, correct:sum.correct ?? null, wrong:sum.wrong ?? null, flagged:Object.values(s.study.flags || {}).filter(Boolean).length,
      total:cert.questions, index:s.study.index || 0, exams:s.history || [], examOpen:!!(s.exam && !s.exam.finished), lastAt:activity().certs[cert.id]?.lastAt || 0};
  }

  /* Question banks are JSON files under /data/certs/<id>/, fetched only when a certification is opened. */
  const cache = {};
  const getJson = url => cache[url] ||= fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }).catch(e => { delete cache[url]; throw e; });
  async function loadBank(cert) {
    const dir = `/data/certs/${cert.id}/`, b = cert.bank || {};
    const [source, vi, keywords] = await Promise.all([
      getJson(dir + b.source),
      b.translations?.vi ? getJson(dir + b.translations.vi) : null,
      b.keywords ? getJson(dir + b.keywords) : null
    ]);
    return {bank:source.questions, domains:source.domains || [], translations:vi?.questions || [], keywords};
  }

  return {read, write, prefs, setPref, activity, recordAnswer, touchCert, streak, today, recentDays, dayKey, certState, summary, loadBank};
})();
