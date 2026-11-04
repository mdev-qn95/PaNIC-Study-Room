/* Reading-cue highlighter. All words, labels and colours come from a certification's keywords.json;
   this file only knows how to apply them. Cues never inspect answer keys. */
window.PanicKeywords = (() => {
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const literal = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+').replace(/-/g, '[-‐‑–]');

  /* config: {kinds:[{id,label,color,phrases:[...],patterns:[{regex,highlight?:[words]}]}]} — earlier kinds take precedence. */
  function create(config) {
    const kinds = config?.kinds || [];
    const rules = kinds.flatMap(k => [
      ...(k.phrases || []).map(p => ({kind:k.id, re:new RegExp(`\\b(?:${literal(p)})\\b`, 'gi')})),
      ...(k.patterns || []).map(p => ({kind:k.id, re:new RegExp(`\\b(?:${p.regex})\\b`, 'gi'), only:(p.highlight || []).map(w => new RegExp(`\\b${literal(w)}\\b`, 'i'))}))
    ]);
    const meta = Object.fromEntries(kinds.map(k => [k.id, k]));
    function matches(text) {
      const accepted = [];
      for (const kind of kinds.map(k => k.id)) {
        const candidates = [];
        for (const rule of rules.filter(r => r.kind === kind)) {
          rule.re.lastIndex = 0; let m;
          while ((m = rule.re.exec(text))) {
            if (rule.only?.length) {
              // Colour only the named words inside the match, e.g. "cannot … without".
              let offset = 0;
              for (const w of rule.only) { const hit = w.exec(m[0].slice(offset)); if (!hit) continue; const start = m.index + offset + hit.index; candidates.push({start, end:start + hit[0].length, kind}); offset += hit.index + hit[0].length; }
            } else candidates.push({start:m.index, end:m.index + m[0].length, kind});
            if (m[0].length === 0) rule.re.lastIndex++;
          }
        }
        candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
        for (const m of candidates) if (!accepted.some(a => m.start < a.end && m.end > a.start)) accepted.push(m);
      }
      return accepted.sort((a, b) => a.start - b.start);
    }
    function render(text) {
      text = String(text ?? ''); let pos = 0, out = '';
      for (const m of matches(text)) { const k = meta[m.kind]; out += escape(text.slice(pos, m.start)) + `<mark class="keyword keyword-${escape(k.color || k.id)}" title="${escape(k.label || k.id)}">${escape(text.slice(m.start, m.end))}</mark>`; pos = m.end; }
      return out + escape(text.slice(pos));
    }
    return {matches, render};
  }
  return {create};
})();
