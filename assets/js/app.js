/* PaNIC Study Room. Buildless, browser-local progress. */
(() => {
'use strict';
const CAT = window.PanicCatalog, STORE = window.PanicStore;
const {shuffle, key, required, complete, correct, examIds, paragraphs, isClassification} = window.PanicCore;

/* ---------- Icons ---------- */
const paths = {
arrow:'M4 12h15m-6-6 6 6-6 6',back:'M20 12H5m6-6-6 6 6 6',close:'m6 6 12 12M18 6 6 18',check:'m5 12 4 4L19 6',
reset:'M5 7a8 8 0 1 1-1 9M5 3v5h5',flag:'M6 21V4c4-4 8 4 12 0v10c-4 4-8-4-12 0',grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2',plus:'M12 5v14M5 12h14',chevron:'m6 9 6 6 6-6',right:'m9 6 6 6-6 6',
lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',layers:'m12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5',
search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-4.3-4.3',flame:'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5',
moon:'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
book:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 16a2 2 0 0 1 2-2h13v2',target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 3.5v1',
mistake:'M12 3 2 20h20zM12 9v5m0 3v.5',play:'M7 5v14l12-7z',bookmark:'M6 3h12v18l-6-4-6 4z'
};
const icon = name => `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.layers}"/></svg>`;
// Seal with a check, shown next to certifications marked "verified" in catalog.json.
const SEAL = 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z';
const verified = c => c.verified ? `<span class="verified" role="img" aria-label="Verified" title="Verified"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${SEAL}"/><path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : '';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); if (m < 2) return 'just now'; if (m < 60) return `${m} minutes ago`; const h = Math.round(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago`; };
function injectIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = icon(e.dataset.icon); e.classList.add('icon-slot'); e.removeAttribute('data-icon'); }); }
function announce(s) { $('announcement').textContent = s; }
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 250); }, 3200); }

/* ---------- Theme ---------- */
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => { const t = STORE.prefs().theme; return t === 'dark' || (t === 'system' && systemDark.matches); };
function applyTheme() { const t = STORE.prefs().theme; if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; $('themeToggle').innerHTML = icon(isDark() ? 'sun' : 'moon'); $('themeToggle').setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
$('themeToggle').onclick = () => { STORE.setPref('theme', isDark() ? 'light' : 'dark'); applyTheme(); };
systemDark.addEventListener?.('change', applyTheme);

/* ---------- Shared pieces ---------- */
const providerOf = c => CAT.provider(c.provider);
/* Languages come from the bank files a certification declares: EN source plus each translation. */
const languages = c => ['EN', ...Object.keys(c.bank?.translations || {}).map(l => l.toUpperCase())];
const statusLabel = {live:'Open', soon:'In preparation', planned:'Planned'};
/* `code` is the provider's official exam code and is optional — never invent one. Without it, the short or full title stands in. */
const label = c => c.code || c.title;
/* Official names that already contain the level (Google's "Professional Cloud Architect") are shown as written. */
const hasLevel = c => c.title.toLowerCase().includes(c.level.toLowerCase());
const titleHtml = c => hasLevel(c) ? esc(c.title) : `${esc(c.title)} <em>${esc(c.level)}</em>`;
const fullName = c => c.code ? `${c.code} · ${c.title}` : hasLevel(c) ? c.title : `${c.title} ${c.level}`;
function spine(c, i) {
  const p = providerOf(c), s = STORE.summary(c), done = s ? pct(s.answered, s.total) : 0, last = STORE.activity().last === c.id;
    return `<a class="spine ${c.status}${c.verified ? ' verified' : ''}" href="#/cert/${c.id}" style="--c:${p.color};--on:${p.ink};--h:${CAT.levelRank(c.level)};--tilt:${c.status === 'planned' && i % 3 === 2 ? -4 : 0}deg" aria-label="${esc(`${c.code ? c.code + ', ' : ''}${c.title} ${c.level}, ${c.verified ? 'verified, ' : ''}${statusLabel[c.status]}${s ? `, ${done}% answered` : ''}`)}">
    ${c.status === 'live' && done ? `<span class="spine-fill" style="--p:${done}%"></span>` : ''}
    ${last ? '<span class="ribbon" aria-hidden="true"></span>' : ''}
    ${c.verified ? `<svg class="spine-seal" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${SEAL}"/><path d="m9 12 2 2 4-4" fill="none" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
    <span class="spine-text">${c.code ? `<b>${esc(c.code)}</b><span>${esc(c.spine || c.title)}</span>` : `<b class="name">${esc(c.spine || c.title)}</b>`}</span>
    <span class="spine-foot">${c.status === 'live' ? (done ? `${done}%` : icon('book')) : c.status === 'soon' ? icon('clock') : ''}</span>
  </a>`;
}
function shelf() {
  return `<div class="shelf" role="list" aria-label="Certification shelf">${CAT.PROVIDERS.map(p => { const certs = CAT.CERTS.filter(c => c.provider === p.id); return `<div class="shelf-group" role="listitem"><div class="books">${certs.map(spine).join('')}</div><div class="plank"><span>${esc(p.short)}</span><small>${certs.filter(c => c.status === 'live').length ? `${certs.filter(c => c.status === 'live').length} open` : 'coming'}</small></div></div>`; }).join('')}</div>`;
}
function ring(value, total, size = 76, label = '') {
  const r = size / 2 - 6, len = 2 * Math.PI * r, p = Math.min(1, total ? value / total : 0);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
function weekStrip() {
  const days = STORE.recentDays(7), goal = STORE.prefs().goal, names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `<ol class="week" aria-label="Last seven days">${days.map((d, i) => { const [y, m, dd] = d.key.split('-').map(Number), wd = new Date(y, m - 1, dd).getDay(); const lvl = !d.n ? 0 : d.n >= goal ? 3 : d.n >= goal / 2 ? 2 : 1; return `<li class="lvl-${lvl} ${i === 6 ? 'is-today' : ''}" title="${d.n} answers"><i></i><span>${names[wd].slice(0, 1)}</span><span class="sr">${names[wd]}: ${d.n} answers</span></li>`; }).join('')}</ol>`;
}
function footer() {
  return `<footer class="site-footer"><div><img src="/assets/favicon.svg" alt="" width="26" height="26"><span><b>PaNIC Study Room</b><br>Independent practice resource. Not affiliated with Anthropic, Amazon, Microsoft or Google.</span></div><p>Your answers, flags and streak are saved in this browser only. Clearing site data removes them.</p></footer>`;
}
function updateStreakChip() { const n = STORE.streak(); $('streakCount').textContent = n; $('streakChip').classList.toggle('lit', STORE.today().n > 0); $('streakChip').title = n ? `${n}-day streak` : 'Answer a question to start a streak'; }

/* ---------- Library (home) ---------- */
let libraryFilter = 'all';
function catalogRows() {
  const certs = CAT.CERTS.filter(c => libraryFilter === 'all' || c.provider === libraryFilter).sort((a, b) => ['live','soon','planned'].indexOf(a.status) - ['live','soon','planned'].indexOf(b.status));
  return certs.map(c => { const p = providerOf(c), s = STORE.summary(c), done = s ? pct(s.answered, s.total) : 0;
    return `<a class="row ${c.status}" href="#/cert/${c.id}" style="--c:${p.color}">
      <span class="row-tab" aria-hidden="true"></span>
      <span class="row-main ${c.code ? '' : 'no-code'}">${c.code ? `<span class="row-code">${esc(c.code)}${verified(c)}</span>` : ''}<span class="row-title">${titleHtml(c)}${c.code ? '' : verified(c)}</span><span class="row-sum">${esc(c.summary)}</span></span>
      <span class="row-provider">${esc(p.short)}</span>
      <span class="row-meta">${c.status === 'live' ? `${c.questions} questions${languages(c).length > 1 ? `<small>${languages(c).join(' + ')}</small>` : ''}` : `<span class="pill ${c.status}">${statusLabel[c.status]}</span>`}</span>
      <span class="row-progress">${c.status === 'live' ? (s?.answered ? `<span class="bar"><i style="width:${done}%"></i></span><small>${done}% answered</small>` : '<small>Not started</small>') : ''}</span>
      <span class="row-go">${icon('right')}</span></a>`; }).join('');
}
function renderHome() {
  const live = CAT.live(), total = live.reduce((n, c) => n + c.questions, 0), recent = live.map(c => ({c, s:STORE.summary(c)})).filter(x => x.s && (x.s.answered || x.s.examOpen)).sort((x, y) => y.s.lastAt - x.s.lastAt)[0], lastCert = recent?.c, s = recent?.s, today = STORE.today(), goal = STORE.prefs().goal, streak = STORE.streak();
  const returning = !!(s && (s.answered || s.examOpen));
  const panel = returning ? `<aside class="today" aria-label="Today">
      <a class="resume" href="#/${s.examOpen ? 'exam' : 'study'}/${lastCert.id}" style="--c:${providerOf(lastCert).color}">
        <span class="resume-label">Pick up where you left off <small>${esc(ago(s.lastAt))}</small></span>
        <strong>${esc(fullName(lastCert))}</strong>
        <span class="resume-bar"><i style="width:${pct(s.answered, s.total)}%"></i></span>
        <span class="resume-foot"><span>${s.answered} of ${s.total} answered${s.wrong ? ` · ${s.wrong} to review` : ''}</span><span class="primary small">${s.examOpen ? 'Resume exam' : 'Continue'} ${icon('arrow')}</span></span>
      </a>
      <div class="today-grid">
        <div class="goal">${ring(today.n, goal, 76, `${today.n} of ${goal} answers today`)}<div><b>${today.n}<small>/${goal}</small></b><span>${today.n >= goal ? 'Daily goal reached' : 'answers today'}</span></div></div>
        <div class="streak"><b>${streak}</b><span>${streak === 1 ? 'day' : 'days'} in a row</span>${weekStrip()}</div>
      </div>
    </aside>` : `<aside class="today first" aria-label="How a study session works">
      <h2>How a session works</h2>
      <ol class="steps">
        <li><b>Practise</b><span>Answer at your own pace. Every choice is checked instantly, with an explanation when one exists.</span></li>
        <li><b>Review mistakes</b><span>Incorrect answers collect in one place so you can return to them later.</span></li>
        <li><b>Sit a mock exam</b><span>Timed, shuffled and graded only when you submit — like the real thing.</span></li>
      </ol>
      <a class="primary" href="#/cert/${live[0].id}">Start with ${esc(label(live[0]))} ${icon('arrow')}</a>
    </aside>`;
  $('viewHome').innerHTML = `
  <div class="page">
    <section class="hero">
      <div class="hero-copy">
        <h1>Pick a certification.<br>Practise until it sticks.</h1>
        <p>Exam-style questions with explanations, timed mock exams and optional Vietnamese translation. Free, no account — your progress stays in this browser.</p>
        <p class="hero-facts"><span><b>${total}</b> questions</span><span><b>${live.length}</b> open now</span><span><b>${CAT.PROVIDERS.length}</b> providers on the shelf</span></p>
      </div>
      ${panel}
    </section>
    <section class="shelf-wrap" aria-labelledby="shelfTitle">
      <div class="section-head"><h2 id="shelfTitle">The shelf</h2><p>Coloured spines are open to study. Faded ones are being prepared.</p></div>
      ${shelf()}
    </section>
    <section class="catalog" aria-labelledby="catalogTitle">
      <div class="section-head"><h2 id="catalogTitle">All certifications</h2>
        <div class="chips" role="group" aria-label="Filter by provider">${[{id:'all', short:'All'}, ...CAT.PROVIDERS].map(p => `<button type="button" class="chip" data-filter="${p.id}" aria-pressed="${libraryFilter === p.id}">${esc(p.short)}<small>${p.id === 'all' ? CAT.CERTS.length : CAT.CERTS.filter(c => c.provider === p.id).length}</small></button>`).join('')}</div>
      </div>
      <div class="rows" id="catalogRows">${catalogRows()}</div>
    </section>
    ${footer()}
  </div>`;
  $('viewHome').querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { libraryFilter = b.dataset.filter; $('viewHome').querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('catalogRows').innerHTML = catalogRows(); });
}

/* ---------- Certification overview ---------- */
function computeStats(cert, bank, st) {
  const answers = st?.study?.answers || {}, flags = st?.study?.flags || {};
  let answered = 0, good = 0, bad = 0; const doms = {};
  bank.forEach(q => { const r = answers[q.id], g = r?.graded; const ok = g && correct(q, r); if (g) { answered++; ok ? good++ : bad++; } if (q.domain) { const d = doms[q.domain] ||= {total:0, answered:0, good:0}; d.total++; if (g) { d.answered++; if (ok) d.good++; } } });
  return {answered, good, bad, flagged:Object.values(flags).filter(Boolean).length, doms, history:st?.history || [], exam:st?.exam};
}
function renderPlannedCert(c) {
  const p = providerOf(c), siblings = CAT.live();
  $('viewCert').innerHTML = `<div class="page narrow">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Library</a>${icon('right')}<span>${esc(p.short)}</span>${icon('right')}<span aria-current="page">${esc(label(c))}</span></nav>
    <section class="cert-hero" style="--c:${p.color};--on:${p.ink}">
      <div class="cover ghosted"><span>${esc(p.short)}</span>${c.code ? `<strong>${esc(c.code)}</strong><em>${esc(c.title)}</em>` : `<strong class="name">${esc(c.title)}</strong>`}${hasLevel(c) ? '' : `<small>${esc(c.level)}</small>`}</div>
      <div class="cert-intro"><span class="pill ${c.status}">${statusLabel[c.status]}</span><h1>${hasLevel(c) ? `${esc(c.title)}${verified(c)}` : `${esc(c.title)} <span class="h1-level">${esc(c.level)}${verified(c)}</span>`}</h1><p>${esc(c.summary)}</p>
        <p class="muted">${c.status === 'soon' ? 'This question bank is being prepared. It will appear on the shelf as soon as it is ready.' : `${esc(p.name)} certifications are on the roadmap. The study room will open once a verified question bank is available.`}</p>
        <div class="actions">${siblings.map(s => `<a class="ghost" href="#/cert/${s.id}">Study ${esc(label(s))} meanwhile</a>`).join('')}</div>
      </div>
    </section>${footer()}</div>`;
}
async function renderCert(id, token) {
  const c = CAT.cert(id); if (!c) { location.hash = '#/'; return; }
  if (c.status !== 'live') { renderPlannedCert(c); return; }
  const p = providerOf(c);
  $('viewCert').innerHTML = `<div class="page narrow"><div class="loading">Opening ${esc(label(c))}…</div></div>`;
  let data; try { data = await STORE.loadBank(c); } catch { $('viewCert').innerHTML = `<div class="page narrow"><div class="loading">The ${esc(label(c))} question bank could not be loaded. Check your connection and reload the page.</div></div>`; return; }
  if (token !== routeToken) return;
  const st = STORE.certState(c), x = computeStats(c, data.bank, st), total = data.bank.length, acc = pct(x.good, x.answered), started = x.answered > 0;
  const examOpen = x.exam && !x.exam.finished, best = x.history.length ? Math.max(...x.history.map(h => pct(h.score, h.total))) : null;
  const doms = data.domains.map(d => { const s = x.doms[d.name] || {total:0, answered:0, good:0}; return {...d, ...s, acc:pct(s.good, s.answered)}; });
  $('viewCert').innerHTML = `<div class="page narrow">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Library</a>${icon('right')}<span>${esc(p.short)}</span>${icon('right')}<span aria-current="page">${esc(label(c))}</span></nav>
    <section class="cert-hero" style="--c:${p.color};--on:${p.ink}">
      <div class="cover"><span>${esc(p.short)}</span>${c.code ? `<strong>${esc(c.code)}</strong><em>${esc(c.title)}</em>` : `<strong class="name">${esc(c.title)}</strong>`}${hasLevel(c) ? '' : `<small>${esc(c.level)}</small>`}${started ? `<i class="cover-fill" style="--p:${pct(x.answered, total)}%"></i>` : ''}</div>
      <div class="cert-intro">
        <h1>${hasLevel(c) ? `${esc(c.title)}${verified(c)}` : `${esc(c.title)} <span class="h1-level">${esc(c.level)}${verified(c)}</span>`}</h1>
        <p>${esc(c.summary)}</p>
        <dl class="facts"><div><dt>Questions</dt><dd>${total}</dd></div><div><dt>Mock exam</dt><dd>${c.exam.questions} in ${c.exam.minutes} min</dd></div><div><dt>Languages</dt><dd>${languages(c).join(' + ')}</dd></div><div><dt>Bank updated</dt><dd>${c.updated ? fmtDate(c.updated) : '—'}</dd></div></dl>
        <div class="actions">
          <a class="primary" href="#/study/${c.id}">${icon('play')} ${started ? `Continue practice` : 'Start practice'}</a>
          <a class="ghost" href="#/exam/${c.id}">${icon('clock')} ${examOpen ? 'Resume mock exam' : 'Mock exam'}</a>
        </div>
      </div>
    </section>
    <section class="cert-body">
      <div class="panel progress-panel">
        <h2>Your progress</h2>
        ${started ? `<div class="big-progress">${ring(x.answered, total, 112, `${x.answered} of ${total} answered`)}<div><b>${pct(x.answered, total)}%</b><span>${x.answered} of ${total} answered</span></div></div>
        <div class="mini-stats"><div><b class="good">${x.good}</b><span>correct</span></div><div><b class="bad">${x.bad}</b><span>incorrect</span></div><div><b>${acc}%</b><span>accuracy</span></div></div>` : `<p class="empty">Nothing answered yet. Your first answer starts the progress ring, and a streak on the library page.</p>`}
        <div class="quick">
          <a class="quick-link ${x.bad ? '' : 'disabled'}" href="${x.bad ? `#/study/${c.id}/mistakes` : '#/cert/' + c.id}" ${x.bad ? '' : 'aria-disabled="true"'}>${icon('mistake')}<span><b>Review mistakes</b><small>${x.bad ? `${x.bad} question${x.bad > 1 ? 's' : ''} to revisit` : 'None yet'}</small></span>${icon('right')}</a>
          <a class="quick-link ${x.flagged ? '' : 'disabled'}" href="${x.flagged ? `#/study/${c.id}/flagged` : '#/cert/' + c.id}" ${x.flagged ? '' : 'aria-disabled="true"'}>${icon('flag')}<span><b>Flagged questions</b><small>${x.flagged ? `${x.flagged} flagged` : 'Flag a question to save it here'}</small></span>${icon('right')}</a>
        </div>
      </div>
      <div class="panel">
        <h2>Mock exams</h2>
        ${x.history.length ? `<div class="history">${x.history.slice(-10).map(h => { const v = pct(h.score, h.total); return `<div class="h-bar" title="${v}% · ${new Date(h.at).toLocaleDateString('en-GB')}"><i style="height:${Math.max(4, v)}%"></i><span>${v}</span></div>`; }).join('')}</div>
        <p class="muted">Best ${best}% · ${x.history.length} attempt${x.history.length > 1 ? 's' : ''} · last ${esc(ago(x.history.at(-1).at))}</p>` : `<p class="empty">No mock exams yet. When you're ready, a timed exam of ${c.exam.questions} shuffled questions shows how you would do on the day.</p>`}
        ${c.exam.note ? `<p class="muted small">${esc(c.exam.note)}</p>` : ''}
        <a class="ghost exam-cta" href="#/exam/${c.id}">${icon('clock')} ${examOpen ? 'Resume your exam' : x.history.length ? 'Take another mock exam' : 'Start a mock exam'}</a>
      </div>
      ${doms.length ? `<div class="panel wide"><h2>Domains</h2><p class="muted">Accuracy per exam domain, from your practice answers. The weight is the share of the exam each domain covers.</p>
        <ul class="domains">${doms.map(d => `<li><div class="d-head"><b>${esc(d.name)}</b><span>${d.weight}%</span></div><div class="d-bar"><i style="width:${pct(d.answered, d.total)}%"></i><em style="width:${d.answered ? pct(d.good, d.total) : 0}%"></em></div><small>${d.answered ? `${d.acc}% correct · ${d.answered}/${d.total} answered` : `${d.total} questions · not started`}</small></li>`).join('')}</ul></div>` : ''}
    </section>${footer()}</div>`;
}

/* ---------- My progress ---------- */
function renderProgress() {
  const goal = STORE.prefs().goal, days = STORE.recentDays(7 * 18), streak = STORE.streak(), totalAnswers = Object.values(STORE.activity().days).reduce((n, d) => n + d.n, 0);
  const pad = (() => { const [y, m, d] = days[0].key.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; })();
  const best = (() => { let b = 0, run = 0; days.forEach(d => { run = d.n ? run + 1 : 0; b = Math.max(b, run); }); return b; })();
  const certs = CAT.live().map(c => ({c, s:STORE.summary(c)}));
  $('viewProgress').innerHTML = `<div class="page narrow">
    <h1 class="page-title">My progress</h1>
    <section class="progress-top">
      <div class="panel"><h2>Streak</h2><div class="streak-big"><b>${streak}</b><span>${streak === 1 ? 'day' : 'days'} in a row<br><small>Best in the last 18 weeks: ${best}</small></span></div></div>
      <div class="panel"><h2>Daily goal</h2><p class="muted">How many answers count as a full day.</p><div class="goal-pick" role="radiogroup" aria-label="Daily goal">${[10, 20, 40, 60].map(g => `<button type="button" role="radio" aria-checked="${g === goal}" data-goal="${g}">${g}</button>`).join('')}</div></div>
      <div class="panel"><h2>All time</h2><div class="streak-big"><b>${totalAnswers}</b><span>answers on<br>this device</span></div></div>
    </section>
    <section class="panel"><h2>Activity</h2><div class="heat-wrap"><div class="heat" style="--pad:${pad}" aria-label="Answers per day, last 18 weeks">${days.map((d, i) => `<i class="lvl-${!d.n ? 0 : d.n >= goal ? 3 : d.n >= goal / 2 ? 2 : 1}" ${i === 0 ? `style="grid-row-start:${pad + 1}"` : ''} title="${fmtDate(d.key)}: ${d.n} answers"></i>`).join('')}</div></div>
      <div class="heat-legend"><span>Less</span><i class="lvl-0"></i><i class="lvl-1"></i><i class="lvl-2"></i><i class="lvl-3"></i><span>Goal met</span></div></section>
    <section class="panel"><h2>Certifications</h2><div class="rows compact">${certs.map(({c, s}) => { const p = providerOf(c), done = s ? pct(s.answered, s.total) : 0, last = s?.exams?.at(-1); return `<a class="row live" href="#/cert/${c.id}" style="--c:${p.color}"><span class="row-tab"></span><span class="row-main ${c.code ? '' : 'no-code'}">${c.code ? `<span class="row-code">${esc(c.code)}${verified(c)}</span>` : ''}<span class="row-title">${titleHtml(c)}${c.code ? '' : verified(c)}</span></span><span class="row-meta">${s?.answered ? `${s.answered}/${s.total}` : 'Not started'}${last ? `<small>Last exam ${pct(last.score, last.total)}%</small>` : ''}</span><span class="row-progress"><span class="bar"><i style="width:${done}%"></i></span><small>${done}%</small></span><span class="row-go">${icon('right')}</span></a>`; }).join('')}</div></section>
    ${footer()}</div>`;
  $('viewProgress').querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { STORE.setPref('goal', +b.dataset.goal); renderProgress(); toast(`Daily goal set to ${b.dataset.goal} answers.`); });
}

/* ---------- Search ---------- */
let searchSel = 0;
function searchItems(q) { q = q.trim().toLowerCase(); return CAT.CERTS.filter(c => { const p = providerOf(c); return !q || [c.code, c.title, c.level, p.name, p.short, c.summary].join(' ').toLowerCase().includes(q); }).sort((a, b) => (a.status !== 'live') - (b.status !== 'live')); }
function renderSearch() {
  const items = searchItems($('searchInput').value); searchSel = Math.min(searchSel, Math.max(0, items.length - 1));
  $('searchResults').innerHTML = items.length ? items.map((c, i) => { const p = providerOf(c); return `<a role="option" aria-selected="${i === searchSel}" href="#/cert/${c.id}" style="--c:${p.color}" data-i="${i}"><span class="s-tab"></span><span>${c.code ? `<b>${esc(c.code)}</b>${verified(c)} ` : ''}${titleHtml(c)}${c.code ? '' : verified(c)}<small>${esc(p.name)}</small></span><span class="pill ${c.status}">${statusLabel[c.status]}</span></a>`; }).join('') : '<p class="empty">No certification matches that search. Try a code such as “AZ-900” or a provider name.</p>';
  $('searchResults').querySelectorAll('a').forEach(a => a.onclick = () => $('searchDialog').close());
}
function openSearch() { $('searchInput').value = ''; searchSel = 0; renderSearch(); $('searchDialog').showModal(); $('searchInput').focus(); }
$('openSearch').onclick = openSearch;
$('searchInput').oninput = () => { searchSel = 0; renderSearch(); };
$('searchInput').onkeydown = e => { const items = $('searchResults').querySelectorAll('a'); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); searchSel = (searchSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); renderSearch(); $('searchResults').querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'}); } else if (e.key === 'Enter' && items[searchSel]) { e.preventDefault(); location.hash = items[searchSel].getAttribute('href'); $('searchDialog').close(); } };
$('searchDialog').onclick = e => { if (e.target === $('searchDialog')) $('searchDialog').close(); };

/* =========================================================
   Study room (state format unchanged; questions use data schema 2)
   ========================================================= */
let BANK, VI, DOMAINS, CERT, KEY, CUES;
const fresh = () => ({answers:{}, flags:{}, index:0, orders:{}});
const emptyState = () => ({version:1, mode:'study', study:fresh(), exam:null, vi:false, previewAnswers:false, highlightKeywords:false, history:[]});
let state, confirmAction, filters = {domain:'all', status:'all', type:'all'};
function selectCertification(cert, data) {
  if (CERT?.id === cert.id) return;
  if (state) persist();
  CERT = cert; BANK = data.bank; VI = new Map(data.translations.map(q => [q.id, q])); DOMAINS = data.domains; KEY = cert.storageKey; CUES = data.keywords ? window.PanicKeywords.create(data.keywords) : null;
  state = emptyState();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.version === 1 && s.study?.answers && s.study?.flags) state = {...state, ...s}; } catch {}
  state.study.orders ||= {}; state.history ||= []; if (state.exam) state.exam.orders ||= {}; if (!state.exam) state.mode = 'study';
  $('rangeFrom').max = BANK.length; $('rangeTo').max = BANK.length; $('rangeFrom').value = 1; $('rangeTo').value = BANK.length;
  $('timedExamDescription').textContent = `${cert.exam.questions} random questions in ${cert.exam.minutes} minutes`;
  $('examPresetNote').hidden = !cert.exam.note; $('examPresetNote').textContent = cert.exam.note || '';
  const p = providerOf(cert);
  $('sideCover').style.cssText = `--c:${p.color};--on:${p.ink}`;
  $('sideCover').innerHTML = cert.code ? `<span>${esc(p.short)}</span><strong>${esc(cert.code)}${verified(cert)}</strong><em>${esc(cert.title)} · ${esc(cert.level)}</em>` : `<span>${esc(p.short)}</span><strong class="name">${esc(cert.title)}</strong>`;
  $('sideBack').href = `#/cert/${cert.id}`;
  resetFilters();
}
const session = () => state.mode === 'study' ? state.study : state.exam;
const list = () => state.mode === 'study' ? BANK : state.exam.ids.map(id => BANK.find(q => q.id === id)).filter(Boolean);
const record = q => session().answers[q.id] || {picks:isClassification(q) ? Array(q.statements.length).fill(null) : [], graded:false};
const reveal = () => state.mode === 'study' || session().finished;
const status = q => { const r = record(q); return !r.graded ? 'unanswered' : reveal() ? (correct(q, r) ? 'correct' : 'wrong') : 'answered'; };
const typeLabel = {single:'Single answer', multiple:'Multiple answers', classification:'Classification'};
const previewing = () => state.mode === 'study' && state.previewAnswers === true;
const domain = name => DOMAINS.find(d => d.name === name);
function persist() {
  let answered = 0, good = 0, bad = 0;
  BANK.forEach(q => { const r = state.study.answers[q.id]; if (r?.graded) { answered++; correct(q, r) ? good++ : bad++; } });
  state.summary = {answered, correct:good, wrong:bad, total:BANK.length, at:Date.now()};
  if (!STORE.write(KEY, state)) announce('Progress could not be saved on this device.');
}
const keywordText = text => CUES && state.highlightKeywords ? CUES.render(text) : esc(text);
function bilingual(en, vi, highlight = false) { return `<span lang="en">${highlight ? keywordText(en) : esc(en)}</span>${state.vi && vi ? `<span class="vi" lang="vi">${esc(vi)}</span>` : ''}`; }
function prepareOrder() { const q = list()[session().index], old = session().orders[q.id]; session().orders[q.id] = isClassification(q) ? q.statements.map((_, ri) => shuffle(q.choices.map((_, i) => i), old?.[ri])) : shuffle(q.options.map((_, i) => i), old); }
function go(i) { session().index = Math.max(0, Math.min(i, list().length - 1)); prepareOrder(); persist(); render(); $('questionScroll').scrollTop = 0; }
function chooseFilter(id, label, items, key) {
  const host = $(id); host.innerHTML = `<button class="select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${label}"><span>${esc(items.find(x => x.value === filters[key])?.label || label)}</span>${icon('chevron')}</button><div class="select-menu" role="listbox" aria-label="${label}" hidden>${items.map(x => `<button type="button" role="option" aria-selected="${x.value === filters[key]}" data-value="${esc(x.value)}">${esc(x.label)}</button>`).join('')}</div>`;
  const trigger = host.querySelector('.select-trigger'), menu = host.querySelector('.select-menu');
  const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.onclick = () => { const open = menu.hidden; closeMenus(); menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('[aria-selected="true"]').focus(); };
  host.querySelectorAll('[data-value]').forEach(b => b.onclick = () => { filters[key] = b.dataset.value; close(); renderFilters(); navRender(); $(id).querySelector('.select-trigger').focus(); });
  host.onkeydown = e => { const options = [...menu.querySelectorAll('button')]; if (e.key === 'Escape') { close(); trigger.focus(); e.stopPropagation(); } else if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) { e.preventDefault(); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); let i = options.indexOf(document.activeElement); i = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; options[i].focus(); } };
}
function closeMenus() { document.querySelectorAll('.select-menu').forEach(m => m.hidden = true); document.querySelectorAll('.select-trigger').forEach(b => b.setAttribute('aria-expanded', 'false')); }
function renderFilters() { $('domainFilter').hidden = !DOMAINS.length; chooseFilter('domainFilter', 'Filter by domain', [{value:'all', label:'All domains'}, ...DOMAINS.map(d => ({value:d.name, label:d.name}))], 'domain'); chooseFilter('statusFilter', 'Filter by status', [{value:'all', label:'All questions'}, {value:'unanswered', label:'Unanswered'}, {value:'wrong', label:'Incorrect'}, {value:'flagged', label:'Flagged'}], 'status'); chooseFilter('typeFilter', 'Filter by question type', [{value:'all', label:'All question types'}, ...Object.keys(typeLabel).filter(t => BANK.some(q => q.type === t)).map(t => ({value:t, label:typeLabel[t]}))], 'type'); }
const matches = q => (filters.domain === 'all' || q.domain === filters.domain) && (filters.type === 'all' || q.type === filters.type) && (filters.status === 'all' || (filters.status === 'flagged' ? session().flags[q.id] : status(q) === filters.status));
function navRender() {
  const qs = list(), stats = {correct:0, wrong:0, answered:0, unanswered:0}; qs.forEach(q => stats[status(q)]++); const done = qs.length - stats.unanswered;
  $('progressCount').textContent = `${done} / ${qs.length}`; $('progressBar').style.width = `${100 * done / qs.length}%`; $('correctCount').textContent = reveal() ? stats.correct : '—'; $('wrongCount').textContent = reveal() ? stats.wrong : '—'; $('remainingCount').textContent = stats.unanswered;
  $('progressTitle').textContent = state.mode === 'study' ? 'Practice progress' : session().finished ? 'Exam results' : 'Exam progress'; $('bankCount').textContent = `${qs.length} questions`;
  const shown = qs.filter(matches);
  $('questionGrid').innerHTML = shown.length ? shown.map(q => { const i = qs.indexOf(q), s = status(q); return `<button class="q-nav ${s} ${session().flags[q.id] ? 'flagged' : ''} ${i === session().index ? 'current' : ''}" data-go="${i}" aria-label="Question ${q.id}, ${s}${session().flags[q.id] ? ', flagged' : ''}" ${i === session().index ? 'aria-current="step"' : ''}>${String(q.id).padStart(2, '0')}</button>`; }).join('') : '<p class="empty-map">No questions match these filters.</p>';
  $('questionGrid').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { go(+b.dataset.go); closeSidebar(); });
  const cur = $('questionGrid').querySelector('.current'); if (cur && !$('sidebar').classList.contains('open')) cur.scrollIntoView({block:'nearest'});
}
function feedback(q, v) { const split = isClassification(q), en = split ? paragraphs(q.explanation) : [q.explanation], vn = split ? paragraphs(v.explanation || '') : [v.explanation || '']; return `<div class="feedback-copy" lang="en">${en.map(t => `<p>${esc(t)}</p>`).join('')}</div>${state.vi && v.explanation ? `<div class="vi feedback-copy" lang="vi">${vn.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}`; }
/* Count a newly completed answer toward today's goal and streak. */
function countAnswer(q, a) {
  const beforeGoal = STORE.today().n < STORE.prefs().goal;
  STORE.recordAnswer(CERT.id, correct(q, a)); updateStreakChip();
  const t = STORE.today(), goal = STORE.prefs().goal;
  if (beforeGoal && t.n >= goal) toast(`Daily goal reached: ${goal} answers today. Streak: ${STORE.streak()} ${STORE.streak() === 1 ? 'day' : 'days'}.`);
}
function render() {
  window.PanicAnswerFx.clear(); const qs = list(); session().index = Math.max(0, Math.min(session().index, qs.length - 1));
  const q = qs[session().index], v = VI.get(q.id) || {}, r = record(q), exam = state.mode === 'exam', finished = exam && session().finished, preview = previewing(), show = reveal() && (preview || r.graded || finished), d = domain(q.domain), answerKey = key(q), need = required(q);
  if (!session().orders[q.id]) prepareOrder(); const order = session().orders[q.id];
  $('studyMode').classList.toggle('active', !exam); $('examMode').classList.toggle('active', exam);
  $('studyMode').setAttribute('aria-pressed', !exam); $('examMode').setAttribute('aria-pressed', exam);
  $('modeLabel').innerHTML = `<a href="#/cert/${CERT.id}">${esc(label(CERT))}</a>${icon('right')}<span>${exam ? (finished ? 'Exam review' : session().deadline ? 'Timed exam' : 'Untimed exam') : 'Practice'}</span>`;
  $('workspaceTitle').textContent = exam ? (finished ? 'Review your answers' : 'One question at a time') : filters.status === 'wrong' ? 'Reviewing your mistakes' : filters.status === 'flagged' ? 'Your flagged questions' : 'Practice';
  $('sessionNote').innerHTML = exam ? (finished ? '<button class="ghost" id="showResults" type="button">View results</button>' : '<span class="timer" id="timer"></span><button class="primary submit-inline" id="submitExam" type="button">Submit exam</button>') : `<span>${BANK.length} questions</span>${DOMAINS.length ? `<span>${DOMAINS.length} domains</span>` : ''}<span>${languages(CERT).join(' + ')}</span>`;
  $('position').textContent = `${session().index + 1} / ${qs.length}`; $('prev').disabled = session().index === 0; $('next').disabled = session().index === qs.length - 1 && !exam;
  $('next').innerHTML = session().index === qs.length - 1 && exam ? (finished ? 'Results' : 'Submit exam') : `<span>Next</span>${icon('arrow')}`; $('clear').disabled = !!finished || preview; $('clear').setAttribute('aria-label', 'Clear answer');
  let html = `<div class="question-meta"><div class="question-tags">${d ? `<span class="badge domain" title="${esc(d.description || '')}">${esc(d.name)}</span>` : q.domain ? `<span class="badge domain">${esc(q.domain)}</span>` : ''}<span class="badge">${typeLabel[q.type]}</span></div><div class="question-tools">${!exam ? `<button class="switch" id="toggleAnswers" type="button" role="switch" aria-checked="${preview}"><span class="switch-track" aria-hidden="true"></span><span>Show answers</span></button>` : ''}${CUES ? `<button class="switch keyword-toggle" id="toggleKeywords" type="button" role="switch" aria-checked="${!!state.highlightKeywords}"><span class="switch-track" aria-hidden="true"></span><span>Highlight keywords</span></button>` : ''}<button class="switch lang" id="toggleVi" type="button" role="switch" aria-checked="${state.vi}" aria-label="Show Vietnamese translation"><span class="switch-track" aria-hidden="true"></span><span>Tiếng Việt</span></button><button class="flag-button" id="flag" type="button" aria-pressed="${!!session().flags[q.id]}">${icon('flag')} ${session().flags[q.id] ? 'Flagged' : 'Flag'}</button></div></div>
  <div class="question-number">Question ${q.id}<span>${session().index + 1} of ${qs.length}${q.source ? ` · source #${q.source}` : ''}</span></div><div class="question-text">${bilingual(q.question, v.question)}</div>
  <p class="answer-instruction">${preview ? 'Answer preview: correct choices are green, incorrect choices red.' : isClassification(q) ? 'Choose one answer for each statement.' : `Choose ${need} answer${need > 1 ? `s · ${r.picks.length}/${need} selected` : ''}.`}${exam && !finished ? ' Results after you submit.' : ''}</p>`;
  if (!isClassification(q)) { html += '<div class="options">' + order.map((i, pos) => { const picked = r.picks.includes(i), good = answerKey.includes(i), cls = show ? (good ? 'correct' : (preview || picked) ? 'wrong' : '') : (picked ? 'selected' : ''); return `<button class="option ${cls}" data-option="${i}" data-key="${pos + 1}" aria-pressed="${picked}" ${finished || preview ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span class="option-content">${bilingual(q.options[i].text, v.options?.[i], true)}</span>${show && (preview || picked || good) ? `<span class="option-result" aria-label="${good ? 'Correct' : 'Incorrect'}">${icon(good ? 'check' : 'close')}</span>` : ''}</button>`; }).join('') + '</div>'; }
  else { html += '<div class="hot-options">' + q.statements.map((st, ri) => { const selected = r.picks[ri], rowShow = reveal() && (preview || selected !== null || finished); return `<section class="hot-row"><div class="hot-statement">${bilingual(st.text, v.statements?.[ri], true)}</div><div class="hot-choices" role="group" aria-label="Statement ${ri + 1}">${order[ri].map(ci => { const cls = rowShow ? (ci === answerKey[ri] ? 'correct' : (preview || selected === ci) ? 'wrong' : '') : (selected === ci ? 'selected' : ''); return `<button class="hot-choice ${cls}" data-row="${ri}" data-choice="${ci}" aria-pressed="${selected === ci}" ${finished || preview ? 'disabled' : ''}>${bilingual(q.choices[ci], v.choices?.[ci] === q.choices[ci] ? null : v.choices?.[ci], true)}${rowShow && ci === answerKey[ri] ? icon('check') : rowShow && (preview || selected === ci) ? icon('close') : ''}</button>`; }).join('')}</div></section>`; }).join('') + '</div>'; }
  if (show && q.explanation?.trim()) { const good = preview || (r.graded && correct(q, r)); html += `<section class="feedback ${good ? '' : 'is-wrong'}"><h3>${icon(good ? 'check' : 'close')}${preview ? 'Explanation' : good ? 'Correct' : 'Not quite'}</h3>${feedback(q, v)}</section>`; }
  else if (show && !preview && r.graded && !exam) { html += `<p class="verdict ${correct(q, r) ? '' : 'is-wrong'}">${icon(correct(q, r) ? 'check' : 'close')} ${correct(q, r) ? 'Correct' : 'Not quite — the correct answer is marked in green.'}</p>`; }
  $('question').innerHTML = html;
  if ($('toggleKeywords')) $('toggleKeywords').onclick = () => { state.highlightKeywords = !state.highlightKeywords; persist(); render(); $('toggleKeywords').focus({preventScroll:true}); announce(state.highlightKeywords ? 'Keyword highlighting on.' : 'Keyword highlighting off.'); };
  if ($('toggleAnswers')) $('toggleAnswers').onclick = () => { state.previewAnswers = !preview; persist(); render(); $('toggleAnswers').focus({preventScroll:true}); announce(state.previewAnswers ? 'Answer preview on. Practice progress is unchanged.' : 'Answer preview off.'); };
  $('toggleVi').onclick = () => { state.vi = !state.vi; persist(); render(); $('toggleVi').focus({preventScroll:true}); };
  $('flag').onclick = () => { session().flags[q.id] = !session().flags[q.id]; persist(); render(); $('flag').focus({preventScroll:true}); };
  $('question').querySelectorAll('[data-option]').forEach(b => b.onclick = () => { if (finished || preview) return; const a = record(q), before = JSON.stringify(a.picks), was = a.graded, n = +b.dataset.option; if (need === 1) a.picks = [n]; else if (a.picks.includes(n)) a.picks = a.picks.filter(x => x !== n); else if (a.picks.length < need) a.picks.push(n); else { announce('Deselect an answer before choosing another.'); return; } a.graded = complete(q, a); session().answers[q.id] = a; if (a.graded && !was) countAnswer(q, a); persist(); render(); $('question').querySelector(`[data-option="${n}"]`).focus({preventScroll:true}); if (a.graded && reveal()) announce(correct(q, a) ? 'Correct' : 'Incorrect'); if (!exam && a.graded && before !== JSON.stringify(a.picks)) window.PanicAnswerFx.show(correct(q, a)); });
  $('question').querySelectorAll('[data-row]').forEach(b => b.onclick = () => { if (finished || preview) return; const a = record(q), before = JSON.stringify(a.picks), was = a.graded, ri = +b.dataset.row, ci = +b.dataset.choice; a.picks[ri] = ci; a.graded = complete(q, a); session().answers[q.id] = a; if (a.graded && !was) countAnswer(q, a); persist(); render(); $('question').querySelector(`[data-row="${ri}"][data-choice="${ci}"]`).focus({preventScroll:true}); announce(reveal() ? (ci === answerKey[ri] ? 'Correct' : 'Incorrect') : 'Answer saved'); if (!exam && a.graded && before !== JSON.stringify(a.picks)) window.PanicAnswerFx.show(correct(q, a)); });
  $('examBar').hidden = !(exam && !finished);
  $('studyNote').textContent = exam ? (finished ? 'Open any question to see the correct answers.' : 'Answers stay hidden until you submit.') : preview ? 'Reading mode — viewing answers does not change your progress.' : 'Tip: press 1–6 to choose an answer, ← → to move between questions.';
  if ($('submitExam')) $('submitExam').onclick = requestSubmit; $('mobileSubmit').onclick = requestSubmit; if ($('showResults')) $('showResults').onclick = showResults;
  navRender(); tick();
}
function confirm(title, text, label, action) { $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('acceptConfirm').textContent = label; $('cancelConfirm').textContent = 'Cancel'; confirmAction = action; $('confirmDialog').showModal(); }
function requestSubmit() { const left = list().filter(q => !record(q).graded).length; confirm('Submit this exam?', left ? `${left} question${left > 1 ? 's are' : ' is'} unfinished and will receive no credit.` : 'All questions are answered. Submit to see your score.', 'Submit exam', finishExam); }
function examScore() { const qs = state.exam.ids.map(id => BANK.find(q => q.id === id)).filter(Boolean); let score = 0, done = 0; const ds = {}; qs.forEach(q => { const a = state.exam.answers[q.id], good = a?.graded && correct(q, a); if (good) score++; if (a?.graded) done++; if (q.domain) { ds[q.domain] ||= {good:0, total:0}; ds[q.domain].total++; if (good) ds[q.domain].good++; } }); return {qs, score, done, ds}; }
function finishExam() {
  if (!state?.exam || state.exam.finished) return; state.exam.finished = true; state.exam.finishedAt = Date.now();
  const {qs, score} = examScore(); state.history = [...(state.history || []), {at:Date.now(), score, total:qs.length, type:state.exam.type}].slice(-30);
  persist(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); if (state.mode === 'exam' && !$('studyApp').hidden) { render(); showResults(); } else announce('Your timed exam has ended. Open Mock exam to review it.');
}
function showResults() {
  const {qs, score, done, ds} = examScore(), v = pct(score, qs.length), prev = (state.history || []).slice(0, -1).at(-1);
  const elapsed = Math.floor(((state.exam.deadline ? Math.min(state.exam.finishedAt, state.exam.deadline) : state.exam.finishedAt) - state.exam.startedAt) / 1000);
  $('results').innerHTML = `<div class="score-line">${ring(score, qs.length, 104, `${v}%`)}<div class="score"><b>${v}%</b><span>${score} of ${qs.length} correct${prev && state.exam.finished ? ` · <em class="${v >= pct(prev.score, prev.total) ? 'up' : 'down'}">${v >= pct(prev.score, prev.total) ? '+' : ''}${v - pct(prev.score, prev.total)} vs last</em>` : ''}</span></div></div><p>${qs.length - done} unanswered · ${Math.floor(elapsed / 60)} min ${elapsed % 60} s. One point per fully correct question; this is a practice score, not an official pass mark.</p>${Object.entries(ds).sort((a, b) => DOMAINS.findIndex(d => d.name === a[0]) - DOMAINS.findIndex(d => d.name === b[0])).map(([name, s]) => `<div class="result-domain"><strong>${esc(name)}</strong><span class="d-mini"><i style="width:${pct(s.good, s.total)}%"></i></span><span>${s.good}/${s.total}</span></div>`).join('')}`;
  $('resultDialog').showModal();
}
function tick() { if (!state?.exam || state.exam.finished) return; const seconds = state.exam.deadline ? Math.max(0, Math.ceil((state.exam.deadline - Date.now()) / 1000)) : null; const label = seconds === null ? 'Untimed' : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; if ($('timer')) { $('timer').textContent = label; $('timer').classList.toggle('low', seconds !== null && seconds < 300); } $('mobileTimer').textContent = label; if (seconds === 0) finishExam(); }
function resetFilters() { filters = {domain:'all', status:'all', type:'all'}; renderFilters(); }
function showExamSetup() { closeSidebar(); $('examWarning').textContent = state.exam ? 'Starting a new exam replaces the previous one. Practice progress is kept.' : 'Practice progress and exam answers are saved separately.'; $('examDialog').showModal(); $('examTitle').focus(); updateRange(); }
function updateRange() { const range = document.querySelector('[name="examType"]:checked').value === 'range'; $('rangeFields').hidden = !range; $('rangeFrom').disabled = !range; $('rangeTo').disabled = !range; const from = +$('rangeFrom').value, to = +$('rangeTo').value; const valid = Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= BANK.length && from <= to; $('rangeTo').setCustomValidity(range && !valid ? `Enter a valid range from 1 to ${BANK.length}; From must not exceed To.` : ''); $('rangeSummary').textContent = valid ? `${to - from + 1} questions, ${from} to ${to}, no time limit` : `Enter a range between 1 and ${BANK.length}.`; }
function startExam() { const type = document.querySelector('[name="examType"]:checked').value; let ids; try { ids = examIds(BANK, type, +$('rangeFrom').value, +$('rangeTo').value, CERT.exam.questions); } catch (e) { announce(e.message); return; } state.exam = {...fresh(), ids, type, minutes:type === 'timed' ? CERT.exam.minutes : null, startedAt:Date.now(), deadline:type === 'timed' ? Date.now() + CERT.exam.minutes * 60000 : null, finished:false}; state.mode = 'exam'; resetFilters(); $('examDialog').close(); if (location.hash !== `#/exam/${CERT.id}`) history.replaceState(null, '', `#/exam/${CERT.id}`); go(0); }
function openSidebar() { $('sidebar').classList.add('open'); $('sidebar').setAttribute('role', 'dialog'); $('sidebar').setAttribute('aria-modal', 'true'); $('sidebar').setAttribute('aria-label', 'Question navigator'); $('backdrop').hidden = false; document.querySelector('.main').inert = true; $('nav').inert = true; $('closeSidebar').focus(); }
function closeSidebar() { const was = $('sidebar').classList.contains('open'); $('sidebar').classList.remove('open'); $('sidebar').removeAttribute('role'); $('sidebar').removeAttribute('aria-modal'); $('backdrop').hidden = true; document.querySelector('.main').inert = false; $('nav').inert = false; if (was) $('openSidebar').focus(); }
$('openSidebar').onclick = openSidebar; $('closeSidebar').onclick = closeSidebar; $('backdrop').onclick = closeSidebar;
/* In "review mistakes" / "flagged" mode, step between matching questions only. */
const reviewing = () => state.mode === 'study' && (filters.status === 'wrong' || filters.status === 'flagged');
function step(dir) { const qs = list(); if (reviewing()) { for (let i = session().index + dir; i >= 0 && i < qs.length; i += dir) if (matches(qs[i])) return go(i); toast(filters.status === 'wrong' ? 'No more mistakes in that direction.' : 'No more flagged questions in that direction.'); return; } go(session().index + dir); }
$('prev').onclick = () => step(-1);
$('next').onclick = () => { if (session().index === list().length - 1 && state.mode === 'exam') { session().finished ? showResults() : requestSubmit(); } else step(1); };
$('clear').onclick = () => { delete session().answers[list()[session().index].id]; prepareOrder(); persist(); render(); announce('Answer cleared.'); };
$('resetStudy').onclick = () => confirm('Reset practice?', 'This clears your practice answers and flags and returns to question 1. Your exam and streak are kept.', 'Reset practice', () => { state.study = fresh(); state.previewAnswers = false; state.mode = 'study'; resetFilters(); closeSidebar(); go(0); });
$('studyMode').onclick = () => { state.mode = 'study'; resetFilters(); closeSidebar(); history.replaceState(null, '', `#/study/${CERT.id}`); go(state.study.index); };
$('examMode').onclick = () => { if (state.exam) { state.mode = 'exam'; resetFilters(); closeSidebar(); history.replaceState(null, '', `#/exam/${CERT.id}`); go(state.exam.index); } else showExamSetup(); };
$('newExam').onclick = showExamSetup;
$('examForm').onsubmit = e => { e.preventDefault(); startExam(); }; document.querySelectorAll('[name="examType"]').forEach(r => r.onchange = updateRange); $('rangeFrom').oninput = updateRange; $('rangeTo').oninput = updateRange;
$('cancelExam').onclick = () => $('examDialog').close(); $('cancelConfirm').onclick = () => $('confirmDialog').close(); $('acceptConfirm').onclick = () => { $('confirmDialog').close(); confirmAction?.(); };
$('reviewExam').onclick = () => $('resultDialog').close(); $('resultStudy').onclick = () => { $('resultDialog').close(); state.mode = 'study'; resetFilters(); history.replaceState(null, '', `#/study/${CERT.id}`); go(state.study.index); };
document.addEventListener('click', e => { if (!e.target.closest('.custom-select')) closeMenus(); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', e => {
  const typing = ['INPUT','TEXTAREA'].includes(e.target.tagName);
  if ((e.key === '/' && !typing && !document.querySelector('dialog[open]')) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); return; }
  if ($('sidebar').classList.contains('open')) { if (e.key === 'Escape') closeSidebar(); if (e.key === 'Tab') { const f = [...$('sidebar').querySelectorAll('button:not(:disabled),a')].filter(x => x.offsetParent !== null), first = f[0], last = f.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } return; }
  if ($('studyApp').hidden || document.querySelector('dialog[open]') || e.target.closest('.custom-select') || typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft' && session().index > 0) step(-1);
  else if (e.key === 'ArrowRight' && session().index < list().length - 1) step(1);
  else if (/^[1-9]$/.test(e.key)) { const b = $('question').querySelector(`[data-key="${e.key}"]`); if (b && !b.disabled) b.click(); }
});

/* ---------- Router ---------- */
let routeToken = 0;
function showView(name) {
  ['viewHome','viewCert','viewProgress'].forEach(v => $(v).hidden = v !== name); $('studyApp').hidden = name !== 'studyApp';
  document.body.classList.toggle('in-study', name === 'studyApp');
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current', (a.dataset.nav === 'home' && ['viewHome','viewCert'].includes(name)) || (a.dataset.nav === 'progress' && name === 'viewProgress')));
}
function legacy(hash) { if (hash === '#home' || hash === '' || hash === '#') return '#/'; if (hash === '#study') return '#/study/ccar-p'; const m = hash.match(/^#study\/([\w-]+)$/); return m ? `#/study/${m[1]}` : hash; }
async function route() {
  const token = ++routeToken; window.PanicAnswerFx.clear(); closeSidebar(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
  const hash = legacy(location.hash); if (hash !== location.hash) { history.replaceState(null, '', hash); }
  const [, view, id, sub] = hash.split('/');
  updateStreakChip();
  if (view === 'cert') { showView('viewCert'); document.title = `${CAT.cert(id) ? label(CAT.cert(id)) : 'Certification'} · PaNIC Study Room`; window.scrollTo(0, 0); await renderCert(id, token); return; }
  if (view === 'progress') { showView('viewProgress'); document.title = 'My progress · PaNIC Study Room'; renderProgress(); window.scrollTo(0, 0); return; }
  if (view === 'study' || view === 'exam') {
    const c = CAT.cert(id); if (!c || c.status !== 'live') { location.hash = c ? `#/cert/${c.id}` : '#/'; return; }
    let data; try { data = await STORE.loadBank(c); } catch { toast(`The ${label(c)} question bank could not be loaded.`); location.hash = `#/cert/${c.id}`; return; }
    if (token !== routeToken) return;
    selectCertification(c, data); STORE.touchCert(c.id); showView('studyApp'); document.title = `${label(c)} ${view === 'exam' ? 'mock exam' : 'practice'} · PaNIC Study Room`;
    if (view === 'exam') { if (state.exam) { state.mode = 'exam'; resetFilters(); go(state.exam.index); } else { state.mode = 'study'; resetFilters(); go(state.study.index); showExamSetup(); } return; }
    state.mode = 'study'; resetFilters();
    if (sub === 'mistakes' || sub === 'flagged') { filters.status = sub === 'mistakes' ? 'wrong' : 'flagged'; renderFilters(); const first = BANK.findIndex(matches); go(first >= 0 ? first : state.study.index); if (first < 0) announce('Nothing to review here yet.'); }
    else go(state.study.index);
    return;
  }
  showView('viewHome'); document.title = 'PaNIC Study Room · Certification practice for AI and cloud'; renderHome(); window.scrollTo(0, 0);
}
window.addEventListener('resize', () => { if (innerWidth > 760) closeSidebar(); });
window.addEventListener('hashchange', route); document.addEventListener('visibilitychange', tick);
document.querySelector('.skip').onclick = e => { e.preventDefault(); ($('studyApp').hidden ? $('main') : $('question')).focus(); };
injectIcons(); applyTheme();
CAT.load().then(() => { route(); setInterval(tick, 1000); }).catch(() => { $('viewHome').hidden = false; $('viewHome').innerHTML = '<div class="page"><div class="loading">The certification catalog could not be loaded. Check your connection and reload the page.</div></div>'; });
})();
