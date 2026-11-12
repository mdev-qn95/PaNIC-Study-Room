# Development notes

Live: https://panic-study-room.vercel.app

A study room for AI and cloud certifications: practice questions with explanations, timed mock exams and optional Vietnamese translation. Buildless HTML/CSS/JavaScript, no backend, no account — progress lives in the browser. Deploy the project root to Vercel with Framework Preset `Other`, no build command, output directory `.`.

## v4 — multi-provider redesign (November 2026)

- **Catalog-driven.** Providers and certifications live in `data/catalog.json` (Anthropic, AWS, Microsoft, Google Cloud). The library, shelf, search, certification pages and study room are generated from it. See `docs/adding-certifications.md`.
- **Library** (`#/`): a bookshelf of certifications grouped by provider (open, in preparation, planned), a filterable catalog, and a "pick up where you left off" panel with daily goal ring, streak and last-7-days strip for returning learners.
- **Certification page** (`#/cert/<id>`): cover, facts, progress ring, accuracy, review mistakes, flagged questions, mock-exam history and per-domain accuracy.
- **Study room** (`#/study/<id>`, `#/study/<id>/mistakes`, `#/study/<id>/flagged`, `#/exam/<id>`): the v3 engine, restyled. In mistakes/flagged mode, Previous/Next step between matching questions only. Keys 1–9 pick answers, ←/→ move.
- **My progress** (`#/progress`): streak, daily goal (10/20/40/60), 18-week activity heatmap, all certifications.
- **Retention:** daily goal toast, streak chip in the navigation, exam history (last 30 attempts per certification) and score delta in results.
- **Search:** `/` or Ctrl/⌘+K.
- **Theme:** light/dark following the system, with a manual toggle (`panic-prefs-v1`).
- **Performance:** question banks load only when a certification is opened. Fonts (Fraunces, Be Vietnam Pro — Latin + Vietnamese subsets) are self-hosted.
- **Storage:** per-certification state keys are unchanged (`panic-ccarp-v1`, `panic-ccarf-v1`), so existing progress carries over. New: `panic-activity-v1` (daily counts, last studied), `panic-prefs-v1`.
- Legacy links `#home`, `#study`, `#study/ccar-p`, `#study/ccar-f` redirect to the new routes.
- Planned AWS/Microsoft/Google entries are roadmap placeholders; edit them in the catalog.


## Data schema 2 (November 2026)

- All certification data is JSON under `data/` with one shared schema; the code holds no certification-specific names, keys or rules. See `docs/adding-certifications.md`.
- `data/catalog.json` — providers, levels, certifications, exam presets, storage keys.
- `data/certs/<id>/questions.en.json` — domains (by name, with weight and description) and questions with readable fields: `id`, `type` (`single` / `multiple` / `classification`), `domain`, `question`, `options[{text, correct}]` or `statements[{text, answer}]` + `choices`, `explanation`, `source`.
- `data/certs/<id>/questions.vi.json` — translation text only, matched by id and position; `null` = no translation line.
- `data/certs/<id>/keywords.json` — reading cues (labels, colours, phrases, patterns) formerly hard-coded in `keywords.js`.
- `data/schema/questions.schema.json` — JSON Schema for editor validation.
- Migration from the v1 JS files was verified lossless for all 272 questions and translations. Answers are still stored as source indices and question ids are unchanged, so existing progress in browsers keeps working.

Checks: `node tests/catalog.cjs && node tests/banks.cjs && node tests/keywords.cjs`.

---

## Earlier notes (v1–v3)
## Experience

- Home: four Claude certification cards. Architect — Professional (CCAR-P), Architect — Foundations (CCAR-F) and Developer — Foundations (CCDV-F) are available; Associate Foundations remains disabled.
- Practice: questions stay in source order: 1–161 for CCAR-P, 1–147 for CCAR-F, 1–97 for CCDV-F. Answer choices shuffle when entering/revisiting a question, reloading, or clearing its answer. They remain stable while selecting answers, flagging, or toggling translation.
- Timed mock exam: CCAR-P uses 63 questions/120 minutes; CCAR-F and CCDV-F use a practice preset of 60 questions/120 minutes (not an official exam specification). Questions and choices are shuffled.
- Untimed range: inclusive start/end question IDs, from 1 through the selected bank size. Example: 5–11 includes exactly seven questions, presented in random order. Invalid or reversed ranges cannot start.
- Practice gives immediate results; multi-answer questions are graded once the required selection count is reached. Classification rows give individual results. Mock exams hide all results until submission.
- One point per completely correct question; no partial credit or inferred official passing score.
- Reset practice clears practice answers and flags, returning to question 1; it leaves the exam intact. New exam replaces only the exam, after the setup dialog explains this.
- Full domain names appear in the question badge, filter, and results. Domain blurbs are available on the badge title. The supplied domain metadata is stored in `app.js`; domain weights do not impose quotas on random selection.
- EN is the interface language. EN + VN toggles Vietnamese question, choices, and explanation below the original English. Yes/No do not gain translations.
- Classification explanations gain paragraph boundaries only; EN wording is untouched.
- Custom dropdown menus support arrows, Home/End, Escape, and keyboard selection. SVG icons and SVG favicon share a consistent design. Keyboard focus uses a thin outline.
- Mobile uses a question drawer, a bounded question scroll area, fixed navigation, and a persistent exam status/submit row. Home uses normal page scrolling.

## Data and state

`assets/data/questions.en.js` is byte-identical to the uploaded source.
SHA-256: `428c1c94409fd90b7b7433e50477242413422a4478142e3e347b838b7148429f`.

`questions.vi.js` contains all 161 translated questions, choices, classification rows and explanations. Technical terms are retained. The provided source is not independently certified as an official Anthropic exam bank.

Shuffle arrays contain original option indices. Scoring and selected answers always refer to original IDs, never visual position. Original option letters remain with their content even after shuffling, so references such as A/B/C in the unchanged EN explanations still identify the correct options.

Progress is stored under `panic-ccarp-v1` in localStorage. Existing practice progress is retained by this update. Legacy exam sessions keep their previous configuration until replaced; every new timed exam uses 63 questions/120 minutes. Existing translation preference is retained. New visitors start with English only.

Timed exams use an absolute deadline and continue across reloads/background tabs. At the next active tick after the deadline, they are submitted automatically. Untimed sessions have no deadline. Clearing browser data removes progress; there is no cross-device sync. Answers remain available in static source files; this is a study tool, not a proctored exam platform.

## Files

- `index.html`: homepage, study shell, dialogs.
- `assets/css/app.css`: responsive theme and controls.
- `assets/js/core.js`: pure shuffle, scoring, range, paragraph helpers.
- `assets/js/app.js`: UI, domain metadata, state and exam lifecycle.
- `assets/favicon.svg`: custom mark. `favicon.ico` (16/32/48), `assets/images/favicon-16/32.png`, `apple-touch-icon.png` and manifest icons are rendered from it.
- `assets/images/og-image.png`: 1200×630 social sharing card (Open Graph / Twitter).
- `assets/data/questions.en.js`, `questions.vi.js`: bilingual bank.
- `vercel.json`: static deployment configuration.

## Validation — 28 October 2026

- JavaScript syntax checks.
- 100 randomized trials verifying 63 unique in-range exam IDs, exact inclusive 5–11 range, single-question range, invalid range rejection, and changed option order on repeat visits.
- All 125 source answer mappings and translations checked; EN file byte integrity and paragraph text preservation checked.
- Browser checks: shuffled multiple-answer scoring, stable positions while selecting, shuffled revisit, Yes/No without duplicate VN, bilingual paragraph explanations, reset dialog, timed exam at 120:00 with 63 questions, untimed 5–11 with seven questions, reload persistence, hidden pre-submit feedback and final scoring.
- Mobile viewport checks at 320×700 and 390×844; tablet at 768×860 and 1024×800, plus desktop. Checked drawer, styled dropdowns, long domain names, range validation, modal scrolling, visible clear icon and persistent submit control. No horizontal page overflow observed.
- These are Chromium viewport checks, not physical iPhone/Safari testing. A full two-hour timed session was not waited out.

## Revision 3

Question badges now use equal-height pill styling, including wrapped domain names. Mobile includes the hero illustration. Question text is 17px and answer/translation/feedback copy is 15px on mobile. Answer rows use color and SVG status icons without duplicate Correct/Incorrect text; the feedback heading retains its result. The CCAR-P card displays the user-supplied question-bank update date **30/10/2026**. Unavailable banks explicitly show that no update is available.

See `docs/adding-certifications.md` for preparing the remaining question banks.

## Question types and answer preview

The navigator combines domain, status, and question-type filters (Classification, Multiple answers, Single answer). Filters affect the navigator; Previous/Next retain the session order.

In Practice, Show answers enables read-only answer preview for every visited question: correct options are green, incorrect options red, and explanations are visible immediately. EN + VN includes translated explanations. Preview does not change answers, grades, or progress, and its preference persists. Disable it to resume answering. Mock exams never expose this switch or reveal answers before submission. Reset practice also disables preview.

## CCAR-F — added 30 October 2026

- 147 single-answer questions imported from the supplied `interactive-quiz.html`. Original source numbers run from 1 to 148, with 59 absent. The study index is contiguous 1–147 and `sourceNumber` preserves the original label displayed in each question. EN wording, option order and answer keys are preserved exactly, including source typos/incomplete passages; no missing English content or explanations have been invented.
- `questions.ccarf.en.js` and `questions.ccarf.vi.js` contain matching question IDs and option indices. All questions and options are translated; technical identifiers and terminology are retained.
- No explanations or domains were supplied. CCAR-F hides the feedback block and domain filter/badge/results breakdown. Answer colors/icons, answer preview and score still work.
- Routes: `#study` and `#study/ccar-p` open CCAR-P; `#study/ccar-f` opens CCAR-F. A certification registry in `app.js` selects data, storage and exam settings.
- CCAR-P retains its existing `panic-ccarp-v1` storage key; CCAR-F uses `panic-ccarf-v1`. Practice/exam answers, flags, translations and preview preferences are isolated. Reset affects only the active certificate.
- CCAR-F timed mock uses 60 random questions (matching the uploaded quiz's random preset) and 120 minutes as a practice setting, clearly disclosed in setup. Untimed ranges use study positions, so 58–60 always includes three questions despite the missing source number.

Validation for CCAR-F: `node tests/banks.cjs`; source equality against the uploaded bank; Chromium UI checks at 320, 390 and 1024px; no horizontal overflow, bilingual display, empty-feedback suppression, type filtering, separate progress, 58–60 three-question range, results dialog, 60-question/120-minute mock and reload persistence. Physical iPhone/Safari not tested.

## CCDV-F — added 12 November 2026

- 97 single-answer questions from a licensed CCDV-F question bank.
- EN question/option text, option order, answer keys and VI translations are kept as published. The source has Vietnamese explanations only, so the EN explanations are translations of them; each explanation ends with the source's takeaway line ("Remember:" / "Ghi nhớ:").
- 11 domains from the source topics. Domain weights are each topic's share of this bank, not an official exam weighting.
- Q21/Q22 and Q45/Q95 are duplicate pairs with swapped answer letters, kept as in the source.
- Storage key `panic-ccdvf-v1`; mock exam uses the 60-question/120-minute practice preset.

Validation for CCDV-F: `node tests/banks.cjs`; local browser check of the certificate page, practice question 1, EN/VI explanation and no horizontal overflow at desktop width. Mobile widths not re-checked.

## Keyword highlighting

The optional **Highlight keywords** switch marks English answer choices and classification statements with user-supplied reading cues: green LỤM, red NÉ, and amber CHECK. These cues are not answer keys. The question prompt and feedback are not highlighted. There is no on-screen color legend. CHECK exceptions take priority over overlapping red or green matches. Matching ignores case and respects whole words; `per-role … allow-list` and `cannot … without …` allow intervening text within the same sentence. For `cannot … without …`, only `cannot` and `without` receive amber highlighting; intervening text is left uncolored by that rule. Generic `without …` highlights the word `without`. Vietnamese text and original question data remain unchanged. The preference is saved per certification and does not change answers, answer order or progress.

Run keyword checks with `node tests/keywords.cjs`.

Keyword highlighting is available only for CCAR-P, off by default. An explicit saved preference is remembered for CCAR-P. Other certifications do not display the switch or use this keyword list.

Practice answers trigger the approved text-free success/confetti or incorrect/ring animation once a changed answer is complete (including all classification rows). Mock exams and answer preview never trigger it. It lasts 2 seconds, does not block clicks, clears on navigation, and respects reduced motion.
