# Adding a certification

The code knows nothing about any particular certification. Everything — providers, certifications, exam presets, domains, questions, translations and keyword cues — is data under `data/`, and every certification uses the **same schema**.

```
data/
  catalog.json                    providers, levels and every certification (shelf, catalog, search, exam presets)
  schema/questions.schema.json    JSON Schema for question banks (editor autocomplete + validation)
  certs/<cert-id>/
    questions.en.json             source bank: domains + questions + answers + explanations
    questions.<lang>.json         optional translations, text only, matched by id and position
    keywords.json                 optional reading cues (highlight words in answer choices)
```

## 1. Catalog entry — `data/catalog.json`

Add a provider (once) and the certification:

```json
{"id":"aws","name":"Amazon Web Services","short":"AWS","blurb":"…","color":"#8a5a17","ink":"#fbe7c6"}
```

```json
{"id":"aws-saa","provider":"aws","code":"SAA-C03","title":"Solutions Architect","level":"Associate","status":"live",
 "summary":"…","updated":"2026-12-01","questions":65,
 "bank":{"source":"questions.en.json","translations":{"vi":"questions.vi.json"}},
 "exam":{"questions":65,"minutes":130,"note":"Optional note shown in the exam dialog."},
 "storageKey":"panic-aws-saa-v1"}
```

- `code` is the provider's **official exam code** (AWS `SAP-C02`, Microsoft `AZ-104`). It is optional: leave it out when the provider has none — Google Cloud, for example — and the title is shown instead. Never invent or abbreviate a code.
- `title` is the official name. If it already contains the level (Google's "Professional Cloud Architect"), it is shown as written without repeating the level.
- `status`: `live` (open), `soon` (in preparation) or `planned` (roadmap). Only `live` needs `bank`, `exam`, `questions`, `storageKey`.
- `level` must be one of `levels`; its position sets the height of the book on the shelf. Optional `spine` is a shorter title for the book spine.
- `color`/`ink`: binding colour and lettering of the provider's books (keep contrast ≥ 4.5:1).
- Languages shown on the site come from `bank.translations` (EN + each key).
- **`storageKey` is where learners' progress lives. Never reuse or rename it.**
- Optional `"verified": true` shows a blue check badge next to the certification (library rows, search, certification page, study sidebar).

## 2. Source bank — `data/certs/<id>/questions.en.json`

```json
{
 "$schema": "../../schema/questions.schema.json",
 "schema": 2, "certification": "aws-saa", "language": "en",
 "domains": [
  {"name": "Design Secure Architectures", "weight": 30, "description": "…"},
  {"name": "Design Resilient Architectures", "weight": 26}
 ],
 "questions": [
  {"id": 1, "type": "single", "domain": "Design Secure Architectures",
   "question": "…",
   "options": [{"text": "…"}, {"text": "…", "correct": true}, {"text": "…"}],
   "explanation": "…"},
  {"id": 2, "type": "multiple", "question": "… (Choose two.)",
   "options": [{"text": "…", "correct": true}, {"text": "…"}, {"text": "…", "correct": true}]},
  {"id": 3, "type": "classification", "question": "For each statement, select Yes or No.",
   "choices": ["Yes", "No"],
   "statements": [{"text": "…", "answer": "Yes"}, {"text": "…", "answer": "No"}]}
 ]
}
```

Rules (all enforced by `node tests/banks.cjs`):

- `id` runs 1..n in order. Progress is stored by id, so never renumber a published bank. Use optional `source` to keep the original numbering.
- `type` is `single` (exactly one `correct: true`), `multiple` (two or more) or `classification`.
- Domains are written by **name** in each question and defined once in `domains` (name, weight %, description). No codes to look up. If a bank has `domains`, every question needs one; if it has none, the domain filter and breakdowns are hidden.
- Classification answers are written as the choice text (`"answer": "Yes"`), and must be one of `choices`.
- `explanation` is optional; without it the site shows only the verdict.
- Option letters shown on screen (A, B, C…) follow the order in `options`, even when choices are shuffled, so explanations may refer to them.

## 3. Translation — `data/certs/<id>/questions.vi.json`

Text only — answers, types and domains always come from the source bank.

```json
{"$schema": "../../schema/questions.schema.json", "schema": 2, "certification": "aws-saa", "language": "vi", "translates": "questions.en.json",
 "questions": [
  {"id": 1, "question": "…", "options": ["…", "…", "…"], "explanation": "…"},
  {"id": 3, "question": "…", "choices": [null, null], "statements": ["…", "…"]}
 ]}
```

Arrays match the source by position. `null` means "show the source text alone" (used for Yes/No, which need no translation line). A translation identical to the source is also hidden.

## 4. Keyword cues (optional) — `data/certs/<id>/keywords.json`

```json
{"schema": 2, "certification": "ccar-p", "language": "en",
 "kinds": [
  {"id": "check", "label": "CHECK", "color": "amber", "phrases": ["…"], "patterns": [{"regex": "cannot\\b[^.]*?\\bwithout\\b", "highlight": ["cannot", "without"]}]},
  {"id": "avoid", "label": "NÉ", "color": "red", "phrases": ["without"]},
  {"id": "pick", "label": "LỤM", "color": "green", "phrases": ["cache"]}
 ]}
```

Earlier kinds win when matches overlap. `phrases` are literal (case-insensitive, whole words; spaces match any whitespace, hyphens any dash); `patterns` are regular expressions; `highlight` colours only those words inside a pattern match. `color` is `green`, `red` or `amber`. Add `"keywords": "keywords.json"` to the catalog entry's `bank` to show the **Highlight keywords** switch.

## 5. Check before publishing

```
node tests/catalog.cjs && node tests/banks.cjs && node tests/keywords.cjs
```

Banks load only when a certification is opened, so adding certifications does not slow down the library. The site fetches JSON, so open it through a web server (Vercel, or `python3 -m http.server`), not as a `file://` page.
