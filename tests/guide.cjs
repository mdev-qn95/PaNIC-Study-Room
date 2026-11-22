/* Validates every study guide declared in catalog.json (cert.guide): index shape, chapter files,
   internal links, citation markers and on-page section ids. Run: node tests/guide.cjs */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const catalog=JSON.parse(read('data/catalog.json'));let n=0,cites=0;
for(const cert of catalog.certifications.filter(c=>c.guide)){
  const dir=`data/certs/${cert.id}/`,g=JSON.parse(read(dir+cert.guide.source)),base=path.posix.dirname(dir+cert.guide.source)+'/';
  assert.equal(g.certification,cert.id);assert.ok(g.credit?.name&&g.credit?.url,`${cert.id}: guide credit`);
  const chapters=[g.intro,...g.domains.flatMap(d=>d.skills),...g.reference],slugs=new Set(chapters.map(c=>c.slug));
  assert.equal(slugs.size,chapters.length,`${cert.id}: duplicate chapter slugs`);
  g.domains.forEach(d=>{assert.ok(d.title&&typeof d.weight==='number'&&d.skills.length,`${cert.id}: domain ${d.n}`);d.skills.forEach(s=>assert.ok(s.id&&s.objective,`${cert.id}/${s.slug}: skill id/objective`));});
  for(const ch of chapters){
    const html=read(base+ch.file),w=`${cert.id}/${ch.slug}`;assert.ok(ch.title&&ch.summary&&ch.reviewed,`${w}: meta`);
    for(const [,,to] of html.matchAll(/href="#\/guide\/([\w-]+)\/([\w-]+)"/g))assert.ok(slugs.has(to),`${w}: link to unknown chapter ${to}`);
    assert.ok(!/<script|<[a-z][^>]*\son\w+=|href=\"javascript:/i.test(html),`${w}: unexpected script`);
    const srcs=new Set([...html.matchAll(/data-src="([^"]+)"/g)].map(m=>m[1]));
    for(const [,id] of html.matchAll(/data-cite="([^"]+)"/g)){assert.ok(srcs.has(id),`${w}: citation ${id} has no source`);cites++;}
    assert.equal(srcs.size,ch.sources,`${w}: source count`);
    ch.sections.forEach(s=>assert.ok(html.includes(`id="g-${s.id}"`),`${w}: section ${s.id}`));
    n++;
  }
}
console.log(`PASS: ${n} guide chapters — files, links, ${cites} citation markers and sections resolve.`);
