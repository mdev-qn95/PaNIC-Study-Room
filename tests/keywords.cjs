const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync(__dirname+'/../assets/js/keywords.js','utf8'),c);
const k=c.window.PanicKeywords.create(JSON.parse(fs.readFileSync(__dirname+'/../data/certs/ccar-p/keywords.json','utf8')));
for(const s of ['Disable prompt caching','Clear the prompt cache','identify any','Move credentials out','cannot be measured','without a BAA','without requiring a separate tool','Replace unrestricted','regardless of fine-tuning'])assert.equal(k.matches(s).length,0,s+' stays plain, without fallback colours');
assert.equal(k.matches('per-role scoped secure allow-list')[0].kind,'pick');
assert.equal(k.matches('cannot proceed. Deploy without review.')[0].kind,'avoid','exclusions do not cross sentences');
assert.equal(k.matches('risk-stratified CACHING explicit credentials').length,4);
assert.equal(k.matches('cachebuster redefined').length,0);
assert.ok(k.render('<script>cache</script>').includes('&lt;script&gt;'));
assert.equal(k.matches('without review, without check').length,2);
const example='cannot meet requirements without changes';
assert.equal(k.matches(example).length,0);
assert.equal(k.render(example),example);
assert.ok(k.render('cache').includes('title="LỤM"')&&k.render('cache').includes('keyword-green'),'labels and colours come from JSON');
assert.equal(c.window.PanicKeywords.create({kinds:[]}).render('<b>'),'&lt;b&gt;');
console.log('PASS: keyword cues from keywords.json — precedence, partial highlights, boundaries, case, labels and HTML escaping.');

// CCDV-F uses the user's replacement list, independent of CCAR-P and answer keys.
const root=__dirname+'/../',read=p=>JSON.parse(fs.readFileSync(root+p,'utf8'));
const cert=read('data/catalog.json').certifications.find(c=>c.id==='ccdv-f');
assert.equal(cert.bank.keywords,'keywords.json');
const config=read('data/certs/ccdv-f/'+cert.bank.keywords),dev=c.window.PanicKeywords.create(config);
assert.equal(config.certification,'ccdv-f');
for(const [kind,color] of [['pick','green'],['avoid','red']])assert.equal(config.kinds.find(k=>k.id===kind).color,color);
for(const s of ['only','single','every','retry','retries','validate','validation','schema','schemas','temperature','prompt caching','settings.json','pruning','compaction','fallback','checkpointing','manually','increase the']){
  assert.equal(dev.matches(s).length,0,s+' is no longer highlighted');
}
for(const [text,kind] of [['context per subagent','pick'],['Context','pick'],['Apply','pick'],['separate','pick'],['separately','pick'],['Validated','pick'],['before recommending','pick'],['rely on','avoid'],['bypass','avoid']]){
  const m=dev.matches(text);assert.equal(m.length,1,text);assert.equal(m[0].kind,kind,text);assert.equal(text.slice(m[0].start,m[0].end),text);
}
assert.equal(dev.matches('CALL fallbacker compactions')[0],undefined,'whole words only');
assert.equal(dev.matches('PROJECT–SPECIFIC')[0].kind,'pick','case and Unicode dash');
assert.equal(dev.matches('before\npassing')[0].kind,'pick','wrapped phrase');
assert.equal(config.kinds.find(k=>k.id==='avoid').phrases.length,6);
assert.equal(config.kinds.find(k=>k.id==='pick').phrases.length,76);
assert.ok(!config.exclusions,'old exclusions must not suppress the replacement list');
for(const kind of config.kinds)for(const phrase of kind.phrases){
  const m=dev.matches(phrase);assert.equal(m.length,1,phrase);assert.equal(m[0].kind,kind.id,phrase);assert.equal(phrase.slice(m[0].start,m[0].end),phrase);
}
assert.deepEqual(Array.from(dev.matches('Context window without configuration'),m=>m.kind),['pick','avoid','pick']);
assert.equal(dev.matches('risk-stratified credentials').length,0,'do not load CCAR-P phrases');
assert.equal(k.matches('explicit')[0].kind,'pick','CCAR-P stays green');
assert.equal(k.matches('without')[0].kind,'avoid','CCAR-P red stays unchanged');
assert.ok(dev.render('<img src=x onerror=alert(1)> schema').includes('&lt;img'),'escape untrusted option text');
for(const [text,color] of [['Context','green'],['all','red']])assert.ok(dev.render(text).includes(`keyword-${color}`));

// Rendering preserves every option; user-selected cues do not consult correctness.
const counts={pick:0,avoid:0};
for(const q of read('data/certs/ccdv-f/questions.en.json').questions)for(const o of q.options){
  const m=dev.matches(o.text);
  assert.equal(dev.render(o.text).replace(/<mark\b[^>]*>|<\/mark>/g,''),c.window.PanicKeywords.create({kinds:[]}).render(o.text),'highlight preserves option text');
  for(const hit of m){assert.ok(hit.kind==='pick'||hit.kind==='avoid');counts[hit.kind]++;}
}
assert.ok(Object.values(counts).every(n=>n>0));
for(const id of ['ccar-p','ccdv-f']){
  const cues=read(`data/certs/${id}/keywords.json`),highlighter=c.window.PanicKeywords.create(cues);
  assert.deepEqual(cues.kinds.map(k=>k.id).sort(),['avoid','pick']);
  for(const q of read(`data/certs/${id}/questions.en.json`).questions)for(const o of q.options||[])assert.ok(!/keyword-amber|title="CHECK"/.test(highlighter.render(o.text)),`${id}: removed CHECK marks`);
}
console.log(`PASS: CCDV-F — all 388 choices reviewed, ${counts.pick} green / ${counts.avoid} red; CHECK removed from both banks, independent config and text preservation.`);
