/* Pure scoring and ordering helpers for schema-2 questions.
   Answers are stored as indices into the untouched EN source (options[] or choices[]),
   so shuffling never changes what an answer means. */
window.PanicCore = (() => {
  const shuffle = (items, previous = []) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.length > 1 && a.every((v, i) => v === previous[i])) a.push(a.shift());
    return a;
  };
  const isClassification = q => q.type === 'classification';
  /* Correct option indices (single/multiple) or the correct choice index per statement (classification). */
  const key = q => isClassification(q) ? q.statements.map(s => q.choices.indexOf(s.answer)) : q.options.flatMap((o, i) => o.correct ? [i] : []);
  const required = q => isClassification(q) ? q.statements.length : key(q).length;
  const complete = (q, r) => isClassification(q) ? r.picks.length === q.statements.length && r.picks.every(v => v !== null && v !== undefined) : r.picks.length === required(q);
  const correct = (q, r) => { if (!complete(q, r)) return false; const k = key(q); return isClassification(q) ? r.picks.every((v, i) => v === k[i]) : r.picks.every(v => k.includes(v)); };
  const examIds = (bank, type, from, to, count) => {
    if (type === 'timed') return shuffle(bank.map(q => q.id)).slice(0, count);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > bank.length || from > to) throw new Error(`Enter a valid range from 1 to ${bank.length}. The first question must not exceed the last.`);
    return shuffle(bank.filter(q => q.id >= from && q.id <= to).map(q => q.id));
  };
  // Retain every character; only insert paragraph boundaries after sentence whitespace.
  const paragraphs = text => text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ0-9])/u);
  return {shuffle, key, required, complete, correct, examIds, paragraphs, isClassification};
})();
