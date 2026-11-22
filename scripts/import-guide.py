"""Convert the CCDV-P study guide (MDX + citation YAML) into static HTML fragments for PaNIC Study Room.

Reads the source repo as data only (no code from it is executed).
Usage: python3 -I guide_convert.py <source-repo> <output-dir> <cert-id>
"""
import html, json, re, sys, textwrap, pathlib
import yaml
from markdown_it import MarkdownIt

SRC, OUT, CERT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
BLOCK = {'KeyPoints', 'Callout', 'ExamLens', 'SelfCheck', 'Figure', 'Flow', 'Sequence', 'SignalTable'}
ALL = BLOCK | {'Cite'}
md = MarkdownIt('commonmark', {'html': False}).enable('table').enable('strikethrough')
E = html.escape

# ---------- JS literal parser (arrays, objects, strings, numbers, booleans) ----------
class JS:
    def __init__(self, s): self.s, self.i = s, 0
    def ws(self):
        while True:
            while self.i < len(self.s) and self.s[self.i].isspace(): self.i += 1
            if self.s.startswith('//', self.i): self.i = self.s.index('\n', self.i) if '\n' in self.s[self.i:] else len(self.s)
            elif self.s.startswith('/*', self.i): self.i = self.s.index('*/', self.i) + 2
            else: return
    def val(self):
        self.ws(); c = self.s[self.i]
        if c == '[':
            self.i += 1; out = []
            while True:
                self.ws()
                if self.s[self.i] == ']': self.i += 1; return out
                out.append(self.val()); self.ws()
                if self.s[self.i] == ',': self.i += 1
        if c == '{':
            self.i += 1; out = {}
            while True:
                self.ws()
                if self.s[self.i] == '}': self.i += 1; return out
                if self.s[self.i] in '"\'`': k = self.string()
                else:
                    m = re.compile(r'[A-Za-z_$][\w$]*').match(self.s, self.i); k = m.group(); self.i = m.end()
                self.ws(); assert self.s[self.i] == ':', self.s[self.i:self.i + 40]; self.i += 1
                out[k] = self.val(); self.ws()
                if self.s[self.i] == ',': self.i += 1
        if c in '"\'`': return self.string()
        m = re.compile(r'-?\d+(\.\d+)?').match(self.s, self.i)
        if m: self.i = m.end(); return float(m.group()) if '.' in m.group() else int(m.group())
        for word, v in (('true', True), ('false', False), ('null', None)):
            if self.s.startswith(word, self.i): self.i += len(word); return v
        raise ValueError('JS literal at: ' + self.s[self.i:self.i + 60])
    def string(self):
        q = self.s[self.i]; self.i += 1; out = []
        while self.s[self.i] != q:
            if self.s[self.i] == '\\':
                n = self.s[self.i + 1]; out.append({'n': '\n', 't': '\t'}.get(n, n)); self.i += 2
            else: out.append(self.s[self.i]); self.i += 1
        self.i += 1; return ''.join(out)

def js_value(text): return JS(text).val()

# ---------- MDX component scanner ----------
TAG = re.compile(r'<(' + '|'.join(sorted(ALL)) + r')\b')

def parse_attrs(s, i):
    """Parse JSX attributes starting at s[i]; return (attrs, index after tag end, self_closing)."""
    attrs = {}
    while True:
        while s[i].isspace(): i += 1
        if s.startswith('/>', i): return attrs, i + 2, True
        if s[i] == '>': return attrs, i + 1, False
        m = re.compile(r'[A-Za-z_][\w-]*').match(s, i); name = m.group(); i = m.end()
        if s[i] != '=': attrs[name] = True; continue
        i += 1
        if s[i] in '"\'':
            q = s[i]; j = s.index(q, i + 1); attrs[name] = s[i + 1:j]; i = j + 1
        elif s[i] == '{':
            depth, j, quote = 0, i, None
            while True:
                ch = s[j]
                if quote:
                    if ch == '\\': j += 1
                    elif ch == quote: quote = None
                elif ch in '"\'`': quote = ch
                elif ch == '{': depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0: break
                j += 1
            attrs[name] = js_value(s[i + 1:j]); i = j + 1
        else: raise ValueError('attr ' + s[i:i + 40])

def find_close(s, name, i):
    depth, pat = 1, re.compile(r'<(/?)' + name + r'\b')
    while True:
        m = pat.search(s, i)
        if not m: raise ValueError('unclosed ' + name)
        if m.group(1):
            depth -= 1
            if depth == 0: return m.start(), s.index('>', m.end()) + 1
            i = m.end()
        else:
            _, end, sc = parse_attrs(s, m.end())
            if not sc: depth += 1
            i = end

def fence_spans(s):
    spans, pos = [], 0
    for m in re.finditer(r'^( *)(```|~~~)[^\n]*\n.*?^\1\2[ \t]*$', s, re.S | re.M): spans.append((m.start(), m.end()))
    return spans

class Chapter:
    def __init__(self, cites, slugs):
        self.cites, self.slugs, self.stash, self.used, self.ids = cites, slugs, [], [], set()

    def put(self, h):
        self.stash.append(h); return f'XQPHX{len(self.stash) - 1}XQPHX'

    def cite(self, ids):
        out = []
        for cid in re.split(r'[\s,]+', ids.strip()):
            if not cid: continue
            if cid not in self.cites: raise ValueError('unknown citation ' + cid)
            if cid not in self.used: self.used.append(cid)
            n = re.sub(r'\D+', '', cid)
            out.append(f'<button type="button" class="cite" data-cite="{E(cid)}" aria-label="Source {n}">{n}</button>')
        return '<sup class="cite-group">' + ''.join(out) + '</sup>'

    def inline(self, text):
        """Inline markdown for prop strings (titles, questions, flow labels)."""
        text = unent(text)
        return self.unstash(md.renderInline(self.extract(text, inline=True)))

    def extract(self, s, inline=False):
        out, i, fences = [], 0, fence_spans(s)
        while True:
            m = TAG.search(s, i)
            while m and any(a <= m.start() < b for a, b in fences): m = TAG.search(s, m.end())
            if not m: out.append(s[i:]); break
            out.append(s[i:m.start()]); name = m.group(1)
            attrs, end, sc = parse_attrs(s, m.end())
            inner = ''
            if not sc:
                cs, ce = find_close(s, name, end); inner = s[end:cs]; end = ce
            h = self.component(name, attrs, inner)
            ph = self.put(h)
            out.append(ph if name == 'Cite' or inline else f'\n\n{ph}\n\n'); i = end
        return ''.join(out)

    def block(self, text):
        text = textwrap.dedent(text).strip('\n')
        body = self.extract(text)
        rendered = md.render(unent_code(body))
        return self.unstash(rendered)

    def unstash(self, h):
        for _ in range(4):
            h = re.sub(r'<p>(XQPHX\d+XQPHX)</p>', r'\1', h)
            h = re.sub(r'XQPHX(\d+)XQPHX', lambda m: self.stash[int(m.group(1))], h)
        return h

    def component(self, name, a, inner):
        if name == 'Cite': return self.cite(a['id'])
        if name == 'KeyPoints':
            return f'<aside class="g-keypoints" aria-label="Key points"><p class="g-keypoints__title">Key points</p>{self.block(inner)}</aside>'
        if name == 'Callout':
            t = a.get('type', 'note'); title = a.get('title')
            kind = {'mistake': 'Common mistake', 'version': 'Version check', 'note': 'Note'}.get(t, 'Note')
            if t == 'version' and title:
                head = f'<p class="g-callout__head"><span class="g-callout__kind">Version check · {self.inline(re.sub(r"(?i)^checked\s+", "", title))}</span></p>'
            else:
                nm = ' <span class="g-callout__name">' + self.inline(title) + '</span>' if title and title != kind else ''
                head = f'<p class="g-callout__head"><span class="g-callout__kind">{kind}</span>{nm}</p>'
            return f'<aside class="g-callout g-callout--{E(t)}">{head}{self.block(inner)}</aside>'
        if name == 'ExamLens':
            return f'<aside class="g-lens" aria-label="Exam lens — editorial inference, not official exam content"><p class="g-lens__head"><span class="g-lens__name">Exam lens</span><span class="g-lens__note">editorial inference</span></p>{self.block(inner)}</aside>'
        if name == 'SelfCheck':
            return f'<details class="g-check"><summary><span class="g-check__badge" aria-hidden="true">Q</span><span class="g-check__q">{self.inline(a["question"])}</span><span class="g-check__show">Show answer</span></summary><div class="g-check__a"><span class="g-check__badge a" aria-hidden="true">A</span><div>{self.block(inner)}</div></div></details>'
        if name == 'Figure':
            return f'<figure class="g-figure"><div class="g-figure__body">{self.block(inner)}</div><figcaption>{self.inline(a["caption"])}</figcaption></figure>'
        if name == 'Flow':
            d = a.get('direction', 'horizontal'); steps = [s if isinstance(s, dict) else {'label': s} for s in a['steps']]
            li = ''
            for st in steps:
                tone = ' ' + E(st['tone']) if st.get('tone') else ''
                note = '<span class="g-flow__note">' + self.inline(st['note']) + '</span>' if st.get('note') else ''
                li += f'<li class="g-flow__step{tone}"><span class="g-flow__label">{self.inline(st["label"])}</span>{note}</li>'
            return f'<ol class="g-flow g-flow--{E(d)}" aria-label="Flow with {len(steps)} steps">{li}</ol>'
        if name == 'Sequence':
            actors = a['actors']; rows = []
            for m in a['messages']:
                if 'from' in m:
                    f, t = actors[m['from']], actors[m['to']]
                    arrow = '↻' if m['from'] == m['to'] else ('⇢' if m.get('dashed') else '→')
                    rows.append(f'<li class="g-seq__msg{" dashed" if m.get("dashed") else ""}"><span class="g-seq__ends"><b>{E(f)}</b><span class="g-seq__arrow" aria-label="{"replies to" if m.get("dashed") else "to"}">{arrow}</span><b>{E(t)}</b></span><span class="g-seq__label">{self.inline(m["label"])}</span></li>')
                else:
                    rows.append(f'<li class="g-seq__note {E(m.get("tone", ""))}"><span class="g-seq__ends"><b>{E(actors[m["at"]])}</b></span><span class="g-seq__label">{self.inline(m["note"])}</span></li>')
            chips = ''.join(f'<span>{E(x)}</span>' for x in actors)
            return f'<div class="g-seq"><p class="g-seq__actors" aria-label="Participants">{chips}</p><ol class="g-seq__rows">{"".join(rows)}</ol></div>'
        if name == 'SignalTable':
            lab = {'fail': 'Fail fast', 'retry': 'Retry', 'conditional': 'Depends'}
            li = ''.join(f'<li><code>{E(r["signal"])}</code><span class="g-signal__tag {r["verdict"] if r["verdict"] in lab else "conditional"}">{lab.get(r["verdict"], "Depends")}</span></li>' for r in a['rows'])
            cap = f'<figcaption>{self.inline(a["caption"])}</figcaption>' if a.get('caption') else ''
            return f'<figure class="g-signal"><ul>{li}</ul>{cap}</figure>'
        raise ValueError(name)

ENT = {'&lt;': '<', '&gt;': '>', '&ge;': '≥', '&le;': '≤', '&amp;': '&'}
def unent(t): return re.sub('|'.join(ENT), lambda m: ENT[m.group()], t)
def unent_code(t):
    """MDX authors escape < inside code spans/fences as &lt;; show the intended character."""
    t = re.sub(r'(`+)(.+?)\1', lambda m: m.group(1) + unent(m.group(2)) + m.group(1), t)
    return re.sub(r'^( *)(```|~~~)([^\n]*\n)(.*?)(^\1\2)', lambda m: m.group(1) + m.group(2) + m.group(3) + unent(m.group(4)) + m.group(5), t, flags=re.S | re.M)

def slugify(t, used):
    base = re.sub(r'[^a-z0-9]+', '-', re.sub(r'<[^>]+>', '', html.unescape(t)).lower()).strip('-') or 'section'
    s, k = base, 2
    while s in used: s, k = f'{base}-{k}', k + 1
    used.add(s); return s

TAG_LABEL = {'FACT': 'Documented', 'REC': 'Recommended practice', 'VER': 'Version-sensitive', 'STD': 'Standard'}

def convert(path, cites_file, slugs):
    raw = path.read_text(encoding='utf-8')
    _, fm, body = raw.split('---', 2); meta = yaml.safe_load(fm)
    cites = {}
    if cites_file.exists():
        for c in yaml.safe_load(cites_file.read_text(encoding='utf-8')) or []: cites[str(c['id'])] = c
    ch = Chapter(cites, slugs)
    h = ch.block(body)
    # links: other chapters → hash routes, external → new tab
    def link(m):
        href = html.unescape(m.group(1))
        if re.match(r'https?://', href): return f'<a href="{E(href)}" target="_blank" rel="noopener">'
        seg = [p for p in href.split('#')[0].split('/') if p and p != '..' and p != '.']
        if seg and seg[-1] in slugs: return f'<a href="#/guide/{CERT}/{seg[-1]}">'
        raise ValueError('unresolved link ' + href + ' in ' + path.name)
    h = re.sub(r'<a href="([^"]*)">', link, h)
    toc, used = [], set()
    def head(m):
        lvl, inner = m.group(1), m.group(2); sid = slugify(inner, used)
        if lvl in '23': toc.append({'level': int(lvl), 'id': sid, 'text': html.unescape(re.sub(r'<[^>]+>', '', inner))})
        return f'<h{lvl} id="g-{sid}">{inner}</h{lvl}>'
    h = re.sub(r'<h([2-4])>(.*?)</h\1>', head, h)
    h = h.replace('<table>', '<div class="g-table"><table>').replace('</table>', '</table></div>')
    # sources: every citation in the chapter's file, in number order (as in the source site)
    src = sorted(cites.values(), key=lambda c: int(re.sub(r'\D+', '', str(c['id'])) or 0))
    if src:
        items = []
        for c in src:
            n = re.sub(r'\D+', '', str(c['id'])); host = re.sub(r'^www\.', '', re.sub(r'^https?://([^/]+).*$', r'\1', c['url']))
            items.append(f'<li class="g-source" data-src="{E(str(c["id"]))}" value="{n}"><div class="g-source__head"><span class="g-source__n">{n}</span><a href="{E(c["url"])}" target="_blank" rel="noopener">{E(c["title"])}</a><span class="g-source__tag {E(c["tag"].lower())}">{TAG_LABEL.get(c["tag"], c["tag"])}</span></div><blockquote>{E(str(c["quote"]))}</blockquote><p class="g-source__meta">{E(host)} · Accessed {E(str(c["accessed"]))}{" · " + E(c["version_note"]) if c.get("version_note") else ""}</p><p class="g-source__claim"><span class="sr">Supports: </span>{E(c["claim"])}</p></li>')
        h += f'<section class="g-sources" aria-labelledby="g-sources"><details><summary><h2 id="g-sources">Sources</h2><span class="g-sources__count">{len(src)}</span></summary><p class="muted small">Quotes are copied verbatim from each source on the access date shown. Tap a source title to open it.</p><ol>{"".join(items)}</ol></details></section>'
    return meta, h, toc, len(ch.used), len(src)

def main():
    syl = (SRC / 'src/data/syllabus.ts').read_text(encoding='utf-8')
    guide = js_value(re.search(r'export const GUIDE = (\{.*?\n\});', syl, re.S).group(1))
    domains = js_value(re.search(r'export const DOMAINS: Domain\[\] = (\[.*?\n\]);', syl, re.S).group(1))
    files = sorted((SRC / 'content').rglob('*.mdx'))
    files = [f for f in files if 'practice' not in f.parts and f.name != 'component-demo.mdx']
    metas = {}
    for f in files:
        meta = yaml.safe_load(f.read_text(encoding='utf-8').split('---', 2)[1]); metas[meta['slug']] = (f, meta)
    slugs = set(metas)
    (OUT / 'chapters').mkdir(parents=True, exist_ok=True)
    for old in (OUT / 'chapters').glob('*.html'): old.unlink()
    info, stats = {}, []
    for slug, (f, meta) in metas.items():
        cf = SRC / 'research/citations' / f"{meta.get('citations') or slug}.yaml"
        meta, h, toc, ncited, nsrc = convert(f, cf, slugs)
        (OUT / 'chapters' / f'{slug}.html').write_text(h + '\n', encoding='utf-8')
        info[slug] = {'slug': slug, 'title': meta['title'], 'summary': meta['summary'], 'status': meta.get('status', 'draft'),
                      'reviewed': str(meta['lastReviewed']), 'file': f'chapters/{slug}.html', 'sections': toc, 'sources': nsrc}
        stats.append((slug, ncited, nsrc, len(h)))
    skills = {s['slug'] for d in domains for s in d['skills']}
    missing = skills - set(info); assert not missing, missing
    index = {
        'schema': 1, 'certification': CERT, 'language': 'en',
        'title': f"{guide['name']} ({guide['code']}) Study Guide",
        'credit': {'name': 'dbirks', 'url': 'https://github.com/dbirks/claude-certified-developer-professional-study-guide',
                   'site': 'https://dbirks.github.io/claude-certified-developer-professional-study-guide/'},
        'summary': f"A source-cited study guide: {sum(len(d['skills']) for d in domains)} skill chapters across the {len(domains)} domains of the official blueprint, with every factual claim linked to a verbatim quote from its source.",
        'about': 'A source-cited study guide for the CCDV-P exam, republished in PaNIC Study Room with the author’s permission. Not affiliated with, endorsed or reviewed by Anthropic. Exam-lens boxes are the author’s editorial inference, not official exam content. Reviews were performed by AI models, not human subject-matter experts.',
        'blueprint': {'name': guide['name'], 'code': guide['code'], 'version': guide['version'], 'effective': guide['effective'], 'verified': guide['verified']},
        'intro': info['introduction'],
        'domains': [{'n': d['n'], 'slug': d['slug'], 'title': d['title'], 'weight': d['weight'],
                     'skills': [{**info[s['slug']], 'id': s['id'], 'short': s['short'], 'skillTitle': s['title'], 'objective': s['objective']} for s in d['skills']]} for d in domains],
        'reference': sorted([v for k, v in info.items() if metas[k][1]['kind'] == 'reference'], key=lambda v: metas[v['slug']][1].get('order', 0)),
    }
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for s in sorted(stats): print(*s)

main()
