/* Validates every live certification's bank against data schema 2 and exercises scoring.
   Run: node tests/banks.cjs   — this is the gate for adding any new certification. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'assets/js/core.js'),'utf8'),ctx);
const core=ctx.window.PanicCore, read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const catalog=read('data/catalog.json'), TYPES=['single','multiple','classification'];
const str=(v,where)=>assert.ok(typeof v==='string'&&v.trim(),`${where}: expected non-empty text`);
let total=0;
for(const cert of catalog.certifications.filter(c=>c.status==='live')){
  const dir=`data/certs/${cert.id}/`, src=read(dir+cert.bank.source), at=q=>`${cert.id} #${q.id}`;
  assert.equal(src.schema,2,`${cert.id}: schema`);assert.equal(src.certification,cert.id);assert.equal(src.language,'en');
  const domains=src.domains||[], names=new Set(domains.map(d=>d.name));
  assert.equal(names.size,domains.length,`${cert.id}: duplicate domain names`);
  domains.forEach(d=>{str(d.name,`${cert.id} domain`);if(d.weight!==undefined)assert.ok(typeof d.weight==='number'&&d.weight>=0);});
  const qs=src.questions;assert.equal(qs.length,cert.questions,`${cert.id}: catalog says ${cert.questions}, bank has ${qs.length}`);
  qs.forEach((q,i)=>{
    assert.equal(q.id,i+1,`${cert.id}: ids must run 1..n in order`);
    assert.ok(TYPES.includes(q.type),`${at(q)}: type must be one of ${TYPES}`);str(q.question,at(q));
    if(q.domain!==undefined)assert.ok(names.has(q.domain),`${at(q)}: domain "${q.domain}" is not listed in "domains"`);
    if(domains.length)assert.ok(q.domain,`${at(q)}: this bank defines domains, so every question needs one`);
    if(q.explanation!==undefined)str(q.explanation,at(q));
    if(q.type==='classification'){
      assert.ok(Array.isArray(q.choices)&&q.choices.length>=2,`${at(q)}: choices`);assert.equal(new Set(q.choices).size,q.choices.length,`${at(q)}: duplicate choices`);
      assert.ok(q.statements.length>=1&&!q.options);q.statements.forEach(s=>{str(s.text,at(q));assert.ok(q.choices.includes(s.answer),`${at(q)}: answer "${s.answer}" is not a choice`);});
    }else{
      assert.ok(Array.isArray(q.options)&&q.options.length>=2&&!q.statements,`${at(q)}: options`);q.options.forEach(o=>{str(o.text,at(q));if('correct' in o)assert.equal(o.correct,true,`${at(q)}: use correct:true or omit it`);});
      const n=q.options.filter(o=>o.correct).length;assert.ok(q.type==='single'?n===1:n>=2,`${at(q)}: type "${q.type}" but ${n} correct option(s)`);
    }
    // scoring: the key is correct, every single wrong pick is wrong
    const k=core.key(q);assert.ok(core.correct(q,{picks:k}),`${at(q)}: key does not score`);
    if(q.type==='single')q.options.forEach((_,j)=>assert.equal(core.correct(q,{picks:[j]}),k.includes(j)));
  });
  for(const [lang,file] of Object.entries(cert.bank.translations||{})){
    const t=read(dir+file);assert.equal(t.schema,2);assert.equal(t.language,lang);assert.equal(t.questions.length,qs.length,`${cert.id}/${lang}: question count`);
    t.questions.forEach((v,i)=>{const q=qs[i],w=`${cert.id}/${lang} #${q.id}`;assert.equal(v.id,q.id,`${w}: id order`);str(v.question,w);
      for(const f of ['answer','correct','type','domain'])assert.ok(!(f in v),`${w}: "${f}" belongs to the source bank only`);
      if(q.type==='classification'){assert.equal(v.statements.length,q.statements.length,`${w}: statements`);assert.equal(v.choices.length,q.choices.length,`${w}: choices`);v.statements.forEach(s=>s===null||str(s,w));}
      else{assert.equal(v.options.length,q.options.length,`${w}: options`);v.options.forEach(s=>s===null||str(s,w));}
      if(v.explanation!==undefined)assert.ok(q.explanation,`${w}: translated explanation without a source explanation`);
    });
  }
  for(let t=0;t<50;t++){const ids=core.examIds(qs,'timed',1,qs.length,cert.exam.questions);assert.equal(new Set(ids).size,cert.exam.questions);assert.ok(ids.every(n=>n>=1&&n<=qs.length));}
  assert.equal([...core.examIds(qs,'range',2,4)].sort((a,b)=>a-b).join(','),'2,3,4');
  assert.throws(()=>core.examIds(qs,'range',1,qs.length+1));assert.throws(()=>core.examIds(qs,'range',5,2));
  total+=qs.length;
}
const f=read('data/certs/ccar-f/questions.en.json').questions;assert.equal(f[58].source,60);assert.equal(f.at(-1).source,148);
console.log(`PASS: ${total} questions across ${catalog.certifications.filter(c=>c.status==='live').length} banks match schema 2 — types, domains, answers, translations, scoring and exam sampling.`);
