const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync(__dirname+'/../assets/js/keywords.js','utf8'),c);
const k=c.window.PanicKeywords.create(JSON.parse(fs.readFileSync(__dirname+'/../data/certs/ccar-p/keywords.json','utf8')));
for(const s of ['Disable prompt caching','Clear the prompt cache','identify any','Move credentials out','cannot be measured','without a BAA','without requiring a separate tool','Replace unrestricted','regardless of fine-tuning']){const m=k.matches(s);assert.equal(m.length,1,s);assert.equal(m[0].kind,'check',s);}
assert.equal(k.matches('per-role scoped secure allow-list')[0].kind,'pick');
assert.equal(k.matches('cannot proceed. Deploy without review.').filter(x=>x.kind==='check').length,0);
assert.equal(k.matches('risk-stratified CACHING explicit credentials').length,4);
assert.equal(k.matches('cachebuster redefined').length,0);
assert.ok(k.render('<script>cache</script>').includes('&lt;script&gt;'));
assert.equal(k.matches('without review, without check').length,2);
const example='cannot meet requirements without changes';
assert.deepEqual(Array.from(k.matches(example),m=>[example.slice(m.start,m.end),m.kind]),[['cannot','check'],['without','check']]);
assert.ok(k.render(example).includes('</mark> meet requirements <mark'));
assert.ok(k.render('cache').includes('title="LỤM"')&&k.render('cache').includes('keyword-green'),'labels and colours come from JSON');
assert.equal(c.window.PanicKeywords.create({kinds:[]}).render('<b>'),'&lt;b&gt;');
console.log('PASS: keyword cues from keywords.json — precedence, partial highlights, boundaries, case, labels and HTML escaping.');
