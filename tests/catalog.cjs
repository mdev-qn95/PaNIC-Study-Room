const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),cat=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
const ids=new Set(),keys=new Set(),pids=new Set(cat.providers.map(p=>p.id));
assert.equal(cat.schema,2);assert.equal(pids.size,cat.providers.length,'duplicate provider id');
for(const p of cat.providers)assert.match(p.color,/^#[0-9a-f]{6}$/i,`${p.id}: color`);
for(const c of cat.certifications){
  assert.ok(!ids.has(c.id),`duplicate id ${c.id}`);ids.add(c.id);assert.match(c.id,/^[a-z0-9-]+$/,`${c.id}: id must be lowercase-dash`);
  assert.ok(pids.has(c.provider),`${c.id}: unknown provider`);assert.ok(['live','soon','planned'].includes(c.status),`${c.id}: status`);
  if('code' in c)assert.ok(typeof c.code==='string'&&c.code.trim(),`${c.id}: code must be the official exam code or be left out`);
  if('credit' in c){assert.ok(typeof c.credit.name==='string'&&c.credit.name.trim(),`${c.id}: credit.name`);assert.match(c.credit.url,/^https:\/\//,`${c.id}: credit.url must be https`);}
  assert.ok(cat.levels.includes(c.level),`${c.id}: level "${c.level}" is not in "levels"`);
  if(c.status!=='live')continue;
  assert.ok(c.storageKey&&!keys.has(c.storageKey),`${c.id}: storageKey missing or reused`);keys.add(c.storageKey);
  assert.ok(c.exam?.questions<=c.questions&&c.exam.minutes>0,`${c.id}: exam preset`);
  for(const f of [c.bank.source,...Object.values(c.bank.translations||{}),...(c.bank.keywords?[c.bank.keywords]:[])])assert.ok(fs.existsSync(path.join(root,'data/certs',c.id,f)),`${c.id}: missing ${f}`);
}
console.log(`PASS: catalog — ${cat.providers.length} providers, ${cat.certifications.length} certifications, ${keys.size} live with files, unique storage keys and valid levels.`);
