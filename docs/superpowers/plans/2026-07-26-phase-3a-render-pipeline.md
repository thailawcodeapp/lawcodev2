# Phase 3A — Render Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the four Thai legal codes into ~6,764 pre-rendered MP3 files on Cloudflare R2, plus a manifest the app can ship, without a single file that the app will fail to find.

**Architecture:** A Node script walks the corpus using **exactly the same paragraph splitting the app uses**, names each file by a hash of its normalized text, skips anything already rendered, and splits paragraphs the engine rejects. A separate verification pass proves the audio is neither truncated nor silent before anything is uploaded.

**Tech Stack:** Node 22 · `@google-cloud/text-to-speech` (already a devDependency) · `music-metadata` (new devDependency, verification only) · Cloudflare R2 via S3 API · Vitest

Design spec: [`docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md`](../specs/2026-07-25-ios-tts-quality-design.md) — sections 7.1 through 7.5.

## Global Constraints

- Branch is `cloud-sync`. Never commit to `main`.
- **Never modify `public/data/*.json`.** `src/data/corpus.integrity.test.js` fails if any byte changes.
- Voice is **`th-TH-Chirp3-HD-Gacrux`**, `languageCode: 'th-TH'`. Chosen by ear against Neural2-C and Apple's enhanced voice; do not substitute.
- Audio format is **MP3** (`audioEncoding: 'MP3'`). iOS does not reliably play Ogg Opus and Google emits no AAC.
- **One paragraph = one file, always.** A paragraph the engine rejects is split into several requests, but the audio is concatenated back into a single file before it is written. Paragraph highlighting in `ReaderScreen.jsx:72` maps `paraIndex` to files 1:1.
- Text reaching the engine goes through `normalizeForSpeech()` from `src/lib/thaiSpeech.js`, unchanged. That function's rules are **locked** — changing them changes every hash and invalidates the whole render.
- Chirp 3 is limited to **200 requests/minute**. Throttle to 180.
- Google's per-request limit is 5,000 bytes; the corpus's longest paragraph is 3,998 bytes, so the byte limit never binds. The binding limit is an undocumented sentence-length one, somewhere between 255 and 378 characters of real text — never hardcode a number for it, always split on rejection.
- Authentication is Application Default Credentials (`gcloud auth application-default login`). No key file, no `GOOGLE_APPLICATION_CREDENTIALS` in the documented path, no credential material committed.
- Do not touch `android/`, `ios/`, or `src/screens/`.
- `npm test` must pass before every commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/sectionParagraphs.js` | **New.** Pure paragraph/title parsing, zero imports. The single definition of "what a paragraph is", shared by the app and the renderer. |
| `src/lib/sectionText.js` | **Modified.** Re-exports from the above; keeps `buildItemsFromRefs`, which needs `./tts`. |
| `src/lib/audioHash.js` | **New.** Pure. Maps normalized paragraph text to its file name. Shared by renderer and app. |
| `scripts/tts-render/corpus.mjs` | **New.** Reads the four JSON files and yields every renderable paragraph with its section id, index, text and hash. |
| `scripts/tts-render/render.mjs` | **New.** Synthesizes what is missing, with throttling, split-on-failure and resume. Writes `out/<hash>.mp3` and the manifest. |
| `scripts/tts-render/verify.mjs` | **New.** Proves each file is complete and audible before upload. |
| `scripts/tts-render/upload.mjs` | **New.** Uploads to R2 and confirms what landed. |
| `src/data/audio-manifest.json` | **Generated.** `sectionId → [hash per paragraph]`, bundled into the app. |

---

### Task 1: One definition of "paragraph", shared by app and renderer

The renderer must split paragraphs **byte-identically** to the app, because the file name is a hash of the paragraph text. Measured against the corpus today, the pilot's splitter and the app's `parseBody()` disagree on **every one of the 3,109 sections** — the pilot leaves the "มาตรา X" heading in the body and always splits on `\n+`, while the app strips the heading and prefers `\n{2,}` when present. Rendering against the wrong splitter produces 6,770 files the app will never ask for.

`src/lib/sectionText.js` cannot be imported from Node because it imports `./tts`, which loads Capacitor plugins. That is why the pilot rewrote the logic instead of reusing it, and it is the root cause to fix.

**Files:**
- Create: `src/lib/sectionParagraphs.js`
- Modify: `src/lib/sectionText.js`
- Test: `src/lib/sectionParagraphs.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseBody(text: string) => string[]` and `cleanTitle(title: string) => string`, importable from plain Node with no transpilation and no dependencies. `src/lib/sectionText.js` keeps exporting both names so no existing caller changes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sectionParagraphs.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseBody, cleanTitle } from './sectionParagraphs';

describe('parseBody', () => {
  it('strips the section heading from the body', () => {
    expect(parseBody('มาตรา 420  ผู้ใดจงใจ')[0]).toBe('ผู้ใดจงใจ');
  });

  it('strips a heading whose ordinal precedes a sub-number', () => {
    expect(parseBody('มาตรา 172 ทวิ/1  ภายหลังที่ศาล')[0]).toBe('ภายหลังที่ศาล');
  });

  it('does not eat ฉ from a real word', () => {
    expect(parseBody('มาตรา 342 ฉ้อโกงประชาชน')[0]).toBe('ฉ้อโกงประชาชน');
  });

  it('prefers blank lines as the separator when the text has them', () => {
    expect(parseBody('มาตรา 1  ก\nข\n\nค')).toEqual(['ก\nข', 'ค']);
  });

  it('falls back to single newlines when there are no blank lines', () => {
    expect(parseBody('มาตรา 1  ก\nข')).toEqual(['ก', 'ข']);
  });

  it('returns an empty array for empty or heading-only input', () => {
    expect(parseBody('')).toEqual([]);
    expect(parseBody(null)).toEqual([]);
    expect(parseBody('มาตรา 1')).toEqual([]);
  });
});

describe('cleanTitle', () => {
  it('strips the heading from a title', () => {
    expect(cleanTitle('มาตรา 420 ละเมิด')).toBe('ละเมิด');
  });
});

describe('the corpus splits the same way for everyone', () => {
  // The renderer names each audio file after a hash of the paragraph text.
  // If the renderer's idea of a paragraph ever drifts from the app's, every
  // hash misses and the app silently falls back to on-device speech for the
  // entire corpus. This pins the count so that drift fails here first.
  it('yields exactly 6764 paragraphs across the four codes', () => {
    const books = [
      'public/data/civil-th.json',
      'public/data/civil-proc-th.json',
      'public/data/criminal-th.json',
      'public/data/criminal-proc-th.json',
    ];
    let total = 0;
    for (const f of books) {
      for (const s of JSON.parse(readFileSync(f, 'utf8')).sections) {
        total += parseBody(s.text).length;
      }
    }
    expect(total).toBe(6764);
  });

  it('never leaves a heading fragment in a first paragraph', () => {
    const leaks = [];
    for (const f of ['public/data/criminal-proc-th.json', 'public/data/civil-th.json']) {
      for (const s of JSON.parse(readFileSync(f, 'utf8')).sections) {
        const first = parseBody(s.text)[0] || '';
        if (/^มาตรา\s/.test(first)) leaks.push(String(s.number));
      }
    }
    expect(leaks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- sectionParagraphs`
Expected: FAIL — `Failed to resolve import "./sectionParagraphs"`.

- [ ] **Step 3: Create the pure module**

Create `src/lib/sectionParagraphs.js` by moving the parsing half of `src/lib/sectionText.js` verbatim — the two regexes, `cleanTitle` and `parseBody` — and nothing else:

```js
// What counts as a paragraph, defined once.
//
// This module has no imports on purpose. The app reaches it through
// sectionText.js, and scripts/tts-render reads it directly from Node, where
// anything importing './tts' would drag in Capacitor plugins and fail to
// load. Both must agree exactly: audio files are named after a hash of the
// paragraph text, so a renderer that splits differently from the app
// produces files the app never asks for.

// Suffix words attached to section numbers in Thai legal codes
// (e.g. "มาตรา 277 ทวิ"). When they leak into the body they should
// be stripped — they belong to the number, not the text (#4).
const THAI_NUM_SUFFIX =
  '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';

// "มาตรา 277", "มาตรา 277/1", "มาตรา 277 ทวิ", "มาตรา 172 ทวิ/1".
//
// The suffix must be a STANDALONE TOKEN (followed by whitespace or
// end-of-string) so we don't eat the first character of words that happen to
// start with one of the suffix letters:
//   "มาตรา 342 ฉ้อโกง..."  → must NOT strip "ฉ" because it's part of "ฉ้อโกง"
//   "มาตรา 4 ฉ เขตอำนาจ..." → MUST strip "ฉ" because it's a real suffix
//
// The inner "/N" group requires the slash deliberately: only "172 ทวิ/1" and
// "172 ทวิ/2" occur, both slash-attached. A looser pattern that allowed a
// space would swallow a leading digit from the body.
const HEADING_RE = new RegExp(
  `^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX}(?:/[\\d/]+)?(?=\\s|$))?\\s*`,
  'i',
);

// Same standalone-token rule for a suffix that leaked to the start of a body.
const LEADING_SUFFIX_RE = new RegExp(`^${THAI_NUM_SUFFIX}(?=\\s)\\s+`, 'i');

export function cleanTitle(title) {
  return String(title || '').replace(HEADING_RE, '').replace(LEADING_SUFFIX_RE, '');
}

// Strip the leading "มาตรา X [ทวิ]" and split the body into paragraphs.
export function parseBody(text) {
  const cleaned = String(text || '')
    .replace(HEADING_RE, '')
    .replace(LEADING_SUFFIX_RE, '')
    .trim();
  if (!cleaned) return [];
  const separator = /\n{2,}/.test(cleaned) ? /\n{2,}/ : /\n/;
  return cleaned.split(separator).map(p => p.trim()).filter(Boolean);
}
```

- [ ] **Step 4: Re-point `sectionText.js` at it**

In `src/lib/sectionText.js`, delete the two regex constants, `cleanTitle` and `parseBody`, and replace the top of the file with:

```js
// Shared helpers for turning raw section text into display paragraphs and
// TTS playlist items.
//
// Paragraph parsing lives in sectionParagraphs.js, which has no imports, so
// scripts/tts-render can use the same definition from Node. Re-exported here
// so existing callers are unaffected.
import { buildSectionItem } from './tts';

export { cleanTitle, parseBody } from './sectionParagraphs';
import { parseBody } from './sectionParagraphs';
```

Leave `buildItemsFromRefs` exactly as it is.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. The existing `src/lib/sectionText.test.js` must still pass untouched — it imports `parseBody` from `./sectionText`, which now re-exports it. If it fails, the re-export is wrong; fix that rather than editing the old test.

- [ ] **Step 6: Prove the module really loads in plain Node**

The entire point is Node-importability, so demonstrate it rather than assuming:

```bash
node --input-type=module -e "
const { parseBody } = await import('./src/lib/sectionParagraphs.js');
console.log(JSON.stringify(parseBody('มาตรา 420  ผู้ใดจงใจ')));
"
```

Expected: `["ผู้ใดจงใจ"]`. If this errors, the module still has a transitive import and Task 3 cannot work.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sectionParagraphs.js src/lib/sectionParagraphs.test.js src/lib/sectionText.js
git commit -m "refactor: make paragraph parsing importable from Node

The renderer names each audio file after a hash of its paragraph text, so
it has to split paragraphs exactly as the app does. It could not:
sectionText.js imports ./tts, which loads Capacitor plugins and will not
run under Node, so the pilot wrote its own splitter. The two disagree on
all 3,109 sections — the pilot leaves the heading in the body — which
would have produced thousands of files the app never asks for.

Moves the parsing to a module with no imports and re-exports it, so there
is one definition. A corpus test pins the paragraph count.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: File naming

**Files:**
- Create: `src/lib/audioHash.js`
- Test: `src/lib/audioHash.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `audioHash(normalizedText: string) => string` — 16 lowercase hex characters. Used by the renderer to name files and by the app (phase 3B) to find them. `import { createHash } from 'node:crypto'` works in Vite's browser build via its Node polyfill, so this one import is safe on both sides.

- [ ] **Step 1: Write the failing test**

Create `src/lib/audioHash.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { audioHash } from './audioHash';

describe('audioHash', () => {
  it('is 16 lowercase hex characters', () => {
    expect(audioHash('ผู้ใดจงใจ')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for the same text', () => {
    expect(audioHash('ผู้ใดจงใจ')).toBe(audioHash('ผู้ใดจงใจ'));
  });

  it('differs for different text', () => {
    expect(audioHash('ก')).not.toBe(audioHash('ข'));
  });

  it('differs when only whitespace differs, because the engine hears that', () => {
    expect(audioHash('ก ข')).not.toBe(audioHash('กข'));
  });

  it('handles empty input without throwing', () => {
    expect(audioHash('')).toMatch(/^[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- audioHash`
Expected: FAIL — `Failed to resolve import "./audioHash"`.

- [ ] **Step 3: Implement**

Create `src/lib/audioHash.js`:

```js
import { createHash } from 'node:crypto';

// Audio files are named after their content, not their position, so that
// editing one section's text invalidates exactly one file: the hash stops
// matching, the app finds nothing, and falls back to on-device speech for
// that paragraph alone while every other file stays valid and cached.
//
// 16 hex characters is 64 bits. Across ~6,800 paragraphs the chance of any
// collision is around one in 10^11 — far below the chance of a bug
// elsewhere in this pipeline — and it keeps the shipped manifest near
// 250 KB instead of 550 KB.
export function audioHash(normalizedText) {
  return createHash('sha256').update(String(normalizedText), 'utf8').digest('hex').slice(0, 16);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- audioHash`
Expected: PASS, 5 tests.

- [ ] **Step 5: Check it survives the browser build**

`node:crypto` must resolve in Vite's build, not just under Vitest's Node environment:

```bash
npm run build
```

Expected: build succeeds. If Rollup cannot resolve `node:crypto`, replace the implementation with a small pure-JS FNV-1a/xxhash-style function rather than adding a polyfill dependency, keep the same signature and length, and note the change in your report — every test above still applies.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audioHash.js src/lib/audioHash.test.js
git commit -m "feat: content-addressed names for rendered audio

Naming a file after its text rather than its position means a corpus edit
invalidates exactly the paragraph that changed: its hash stops matching,
the app falls back to on-device speech for that one paragraph, and every
other file stays valid and CDN-cached.

64 bits keeps the shipped manifest near 250 KB; collision probability
across 6,800 paragraphs is around 1e-11.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Enumerate what needs rendering

Separating "what should exist" from "make it exist" means the expensive part can be re-run freely and the cheap part can be tested without touching the network.

**Files:**
- Create: `scripts/tts-render/corpus.mjs`
- Test: `scripts/tts-render/corpus.test.mjs`

`vitest.config.js` already includes `scripts/**/*.test.mjs` — phase 2's pilot tests run through it. Nothing to change there.

**Interfaces:**
- Consumes: `parseBody` from `src/lib/sectionParagraphs.js`; `normalizeForSpeech` from `src/lib/thaiSpeech.js`; `audioHash` from `src/lib/audioHash.js`.
- Produces:
  - `BOOKS: string[]` — the four book ids, in manifest order.
  - `collectParagraphs() => Array<{ book, sectionId, number, paraIndex, text, hash }>` where `text` is already normalized and `hash` is `audioHash(text)`.
  - `buildManifest(paragraphs) => Record<string, string[]>` — section id to hashes ordered by `paraIndex`.

- [ ] **Step 1: Write the failing test**

Create `scripts/tts-render/corpus.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { collectParagraphs, buildManifest, BOOKS } from './corpus.mjs';

describe('collectParagraphs', () => {
  const paragraphs = collectParagraphs();

  it('covers all four books', () => {
    expect(BOOKS).toEqual(['civil-th', 'civil-proc-th', 'criminal-th', 'criminal-proc-th']);
  });

  it('yields one entry per paragraph in the corpus', () => {
    expect(paragraphs).toHaveLength(6764);
  });

  it('normalizes the text it will send', () => {
    const withSlash = paragraphs.filter((p) => p.text.includes(' ทับ '));
    expect(withSlash.length).toBeGreaterThan(0);
    expect(paragraphs.some((p) => /มาตรา \d+\/\d+/.test(p.text))).toBe(false);
  });

  it('gives every entry a 16-hex hash matching its text', () => {
    expect(paragraphs.every((p) => /^[0-9a-f]{16}$/.test(p.hash))).toBe(true);
  });

  it('numbers paragraphs from zero within each section', () => {
    const bySection = new Map();
    for (const p of paragraphs) {
      if (!bySection.has(p.sectionId)) bySection.set(p.sectionId, []);
      bySection.get(p.sectionId).push(p.paraIndex);
    }
    for (const [, indices] of bySection) {
      expect(indices).toEqual(indices.map((_, i) => i));
    }
  });

  it('never yields empty text', () => {
    expect(paragraphs.every((p) => p.text.trim().length > 0)).toBe(true);
  });
});

describe('buildManifest', () => {
  it('maps a section id to its hashes in paragraph order', () => {
    const manifest = buildManifest([
      { sectionId: 'pp-1', paraIndex: 1, hash: 'bbbbbbbbbbbbbbbb' },
      { sectionId: 'pp-1', paraIndex: 0, hash: 'aaaaaaaaaaaaaaaa' },
      { sectionId: 'pp-2', paraIndex: 0, hash: 'cccccccccccccccc' },
    ]);
    expect(manifest).toEqual({
      'pp-1': ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'],
      'pp-2': ['cccccccccccccccc'],
    });
  });

  it('covers every section that has a paragraph', () => {
    const manifest = buildManifest(collectParagraphs());
    expect(Object.keys(manifest).length).toBeGreaterThan(3000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- corpus`
Expected: FAIL — cannot resolve `./corpus.mjs`.

- [ ] **Step 3: Implement**

Create `scripts/tts-render/corpus.mjs`:

```js
// Decides what should exist, without deciding how it gets made. Keeping this
// separate from render.mjs means the expensive half can be re-run freely and
// this half can be tested without a network or credentials.
import { readFileSync } from 'node:fs';
import { parseBody } from '../../src/lib/sectionParagraphs.js';
import { normalizeForSpeech } from '../../src/lib/thaiSpeech.js';
import { audioHash } from '../../src/lib/audioHash.js';

export const BOOKS = ['civil-th', 'civil-proc-th', 'criminal-th', 'criminal-proc-th'];

// Paths are relative to the repository root; every script here runs from there.
function loadBook(book) {
  return JSON.parse(readFileSync(`public/data/${book}.json`, 'utf8'));
}

// parseBody and normalizeForSpeech are the app's own, imported rather than
// reimplemented: the file name is a hash of this text, so any divergence
// makes the app ask for files that were never rendered.
export function collectParagraphs() {
  const out = [];
  for (const book of BOOKS) {
    for (const section of loadBook(book).sections) {
      parseBody(section.text).forEach((paragraph, paraIndex) => {
        const text = normalizeForSpeech(paragraph);
        out.push({
          book,
          sectionId: section.id,
          number: String(section.number),
          paraIndex,
          text,
          hash: audioHash(text),
        });
      });
    }
  }
  return out;
}

export function buildManifest(paragraphs) {
  const manifest = {};
  for (const p of [...paragraphs].sort((a, b) => a.paraIndex - b.paraIndex)) {
    (manifest[p.sectionId] ||= []).push(p.hash);
  }
  return manifest;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- corpus`
Expected: PASS, 8 tests.

If the count assertion reports something other than 6764, **do not change the expected number.** It means paragraph parsing moved since Task 1; find out why.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — everything from phases 1 and 2 plus the new files.

- [ ] **Step 6: Commit**

```bash
git add scripts/tts-render/corpus.mjs scripts/tts-render/corpus.test.mjs
git commit -m "feat: enumerate the paragraphs that need audio

Reads the corpus through the app's own parseBody and normalizeForSpeech
rather than reimplementing either, because the file name is a hash of this
exact text and a divergence would render thousands of files nothing ever
asks for.

Kept separate from the renderer so the expensive half can be re-run freely
while this half stays testable with no network and no credentials.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Render

**Files:**
- Create: `scripts/tts-render/render.mjs`
- Create: `scripts/tts-render/README.md`
- Test: `scripts/tts-render/render.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `collectParagraphs`, `buildManifest` from `./corpus.mjs`.
- Produces: `scripts/tts-render/out/<hash>.mp3` for every paragraph; `src/data/audio-manifest.json`. Exports `synthesizeWithSplit(client, text, opts)`, `splitPoint(text)`, `splitParagraph(text)`, `throttle(ms)` for testing.

The split logic is proven — copy `splitPoint`, `splitParagraph` and the shape of `synthesizeParagraphWithSplit` from `scripts/tts-pilot/render.mjs` rather than inventing new ones. The pilot's version splits at the space nearest the midpoint, recurses to `MAX_SPLIT_DEPTH = 4`, and concatenates pieces in reading order. A split paragraph was listened to on a real device and the seam was inaudible, because the split lands on a space that already separates clauses.

- [ ] **Step 1: Ignore the output**

Append to `.gitignore`:

```
scripts/tts-render/out/
```

- [ ] **Step 2: Write the failing test**

Create `scripts/tts-render/render.test.mjs`:

```js
import { describe, it, expect, vi } from 'vitest';
import { splitPoint, splitParagraph, synthesizeWithSplit, MAX_SPLIT_DEPTH } from './render.mjs';

// A client that rejects anything longer than `limit`, the way Chirp 3 rejects
// a sentence it considers too long.
const fakeClient = (limit) => ({
  synthesizeSpeech: vi.fn(async ({ input }) => {
    if (input.text.length > limit) {
      const err = new Error('This request contains sentences that are too long.');
      err.code = 3;
      throw err;
    }
    return [{ audioContent: Buffer.from(input.text, 'utf8').toString('base64') }];
  }),
});

describe('splitPoint', () => {
  it('picks the space nearest the middle', () => {
    expect(splitPoint('aa bbbb cc')).toBe(7);
  });

  it('falls back to the midpoint when there is no space', () => {
    expect(splitPoint('abcd')).toBe(2);
  });
});

describe('splitParagraph', () => {
  it('splits into two trimmed pieces', () => {
    expect(splitParagraph('aa bbbb cc')).toEqual(['aa bbbb', 'cc']);
  });

  it('returns one piece when it cannot usefully split', () => {
    expect(splitParagraph('a')).toEqual(['a']);
  });
});

describe('synthesizeWithSplit', () => {
  it('sends a short paragraph as one request', async () => {
    const client = fakeClient(100);
    const r = await synthesizeWithSplit(client, 'สั้น');
    expect(client.synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(r.failures).toEqual([]);
    expect(r.splits).toBe(0);
  });

  it('splits a rejected paragraph and keeps the pieces in reading order', async () => {
    const client = fakeClient(10);
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc');
    expect(r.failures).toEqual([]);
    expect(r.splits).toBeGreaterThan(0);
    expect(Buffer.concat(r.parts).toString('utf8')).toBe('aaaa bbbbcccc');
  });

  it('counts only characters it actually sent', async () => {
    const client = fakeClient(10);
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc');
    expect(r.chars).toBe('aaaa bbbb'.length + 'cccc'.length);
  });

  it('gives up at the depth limit instead of recursing forever', async () => {
    const client = fakeClient(0); // rejects everything
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc dddd');
    expect(r.failures.length).toBeGreaterThan(0);
    expect(r.parts).toEqual([]);
    expect(client.synthesizeSpeech.mock.calls.length).toBeLessThanOrEqual(2 ** (MAX_SPLIT_DEPTH + 1));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tts-render/render`
Expected: FAIL — cannot resolve `./render.mjs`.

(Filter on the directory: a bare `render.test.mjs` also matches the phase-2 pilot's test file of the same name.)

- [ ] **Step 4: Implement**

Create `scripts/tts-render/render.mjs`:

```js
// Renders every paragraph the corpus needs, and nothing it already has.
//
// Authenticate first: `gcloud auth application-default login`. Google blocks
// service-account key downloads by default for organizations, and the client
// picks up your own credentials without being told where they are.
//
// Usage, from the repository root:
//   node scripts/tts-render/render.mjs            render everything missing
//   node scripts/tts-render/render.mjs --limit 50 render at most 50 paragraphs
//   node scripts/tts-render/render.mjs --manifest write the manifest only
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { collectParagraphs, buildManifest } from './corpus.mjs';

export const VOICE = 'th-TH-Chirp3-HD-Gacrux';
export const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const MANIFEST_PATH = 'src/data/audio-manifest.json';

// Chirp 3 allows 200 requests/minute. 180 leaves headroom for the retry that
// a split costs, so one rejected paragraph cannot push the run over.
const REQUESTS_PER_MINUTE = 180;
const MIN_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

export const MAX_SPLIT_DEPTH = 4; // 16 pieces worst case, so a pathological
// paragraph cannot loop forever.

export function throttle(lastAt, now = Date.now()) {
  return Math.max(0, lastAt + MIN_INTERVAL_MS - now);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function splitPoint(text) {
  const mid = Math.floor(text.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
  }
  return best === -1 ? mid : best;
}

// Returns one element when there is nothing left on one side after trimming —
// that is what stops the caller recursing forever.
export function splitParagraph(text) {
  const cut = splitPoint(text);
  return [text.slice(0, cut).trim(), text.slice(cut).trim()].filter(Boolean);
}

// Chirp 3 rejects a request whose sentence it considers too long. The limit is
// undocumented and lies somewhere between 255 and 378 characters of real text,
// so this sends first and splits on rejection rather than hardcoding a number
// that would silently stop matching if Google moved it. The split lands on a
// space, which in Thai legal text already separates clauses — a seam there was
// inaudible when listened to on a device.
export async function synthesizeWithSplit(client, text, { maxDepth = MAX_SPLIT_DEPTH } = {}) {
  const parts = [];
  const failures = [];
  let chars = 0;
  let splits = 0;

  async function attempt(piece, depth) {
    try {
      const [res] = await client.synthesizeSpeech({
        input: { text: piece },
        voice: { languageCode: 'th-TH', name: VOICE },
        audioConfig: { audioEncoding: 'MP3' },
      });
      parts.push(Buffer.from(res.audioContent, 'base64'));
      chars += piece.length;
      return;
    } catch (err) {
      const pieces = depth < maxDepth ? splitParagraph(piece) : [piece];
      if (pieces.length < 2) {
        failures.push({ length: piece.length, message: err.message });
        return;
      }
      splits += 1;
      for (const next of pieces) await attempt(next, depth + 1);
    }
  }

  await attempt(text, 0);
  return { parts, chars, failures, splits };
}

async function main() {
  const argv = process.argv.slice(2);
  const limitArg = argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(argv[limitArg + 1]) : Infinity;

  const paragraphs = collectParagraphs();
  mkdirSync(OUT, { recursive: true });

  const manifest = buildManifest(paragraphs);
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`);
  console.log(`manifest written: ${MANIFEST_PATH} (${Object.keys(manifest).length} sections)`);
  if (argv.includes('--manifest')) return;

  const todo = paragraphs.filter((p) => !existsSync(`${OUT}${p.hash}.mp3`));
  console.log(`${paragraphs.length} paragraphs, ${paragraphs.length - todo.length} already rendered, ${todo.length} to do`);

  const client = new TextToSpeechClient();
  let done = 0;
  let chars = 0;
  let splits = 0;
  const failed = [];
  let lastAt = 0;

  for (const p of todo.slice(0, limit)) {
    await sleep(throttle(lastAt));
    lastAt = Date.now();

    const r = await synthesizeWithSplit(client, p.text);
    if (r.failures.length || !r.parts.length) {
      failed.push({ ...p, failures: r.failures });
      console.log(`FAIL  ${p.book} ${p.number} ¶${p.paraIndex} (${p.text.length} chars)`);
      continue;
    }
    writeFileSync(`${OUT}${p.hash}.mp3`, Buffer.concat(r.parts));
    chars += r.chars;
    splits += r.splits;
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${Math.min(todo.length, limit)} rendered`);
  }

  console.log(`\nrendered ${done}, split ${splits}, failed ${failed.length}, characters billed ${chars}`);
  for (const f of failed) {
    console.log(`  ${f.book} ${f.number} ¶${f.paraIndex}: ${f.failures.map((x) => x.message).join('; ')}`);
  }
  if (failed.length) console.log('\nre-run to retry only the failures — rendered files are skipped');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tts-render/render`
Expected: PASS, 7 tests.

- [ ] **Step 6: Write the manifest and check its size**

This needs no credentials:

```bash
node scripts/tts-render/render.mjs --manifest
node -e "const s=require('fs').statSync('src/data/audio-manifest.json');console.log('manifest', (s.size/1024).toFixed(0)+'KB')"
```

Expected: around 3,109 sections and roughly 250 KB. If it is over 400 KB, report it — the spec budgeted 300 KB for a file that ships inside the app.

- [ ] **Step 7: Write the README**

Create `scripts/tts-render/README.md`:

```markdown
# Phase 3A — render pipeline

Turns the four Thai legal codes into one MP3 per paragraph, named by a hash
of the text the engine was given, plus the manifest the app ships.

## Authenticate

    gcloud auth application-default login
    gcloud auth application-default set-quota-project YOUR_PROJECT_ID
    gcloud services enable texttospeech.googleapis.com

No key file. Google blocks service-account key downloads by default for
organizations, and the client finds your own credentials unaided.

## Run, from the repository root

    node scripts/tts-render/render.mjs --manifest      # manifest only, no API calls
    node scripts/tts-render/render.mjs --limit 50      # try 50 paragraphs first
    node scripts/tts-render/render.mjs                 # everything still missing

Files land in `out/<hash>.mp3` (gitignored). A file that already exists is
never re-rendered, so a failed run costs nothing to resume and the whole
thing can be split across two months to stay inside the 1M characters/month
free tier.

At 180 requests/minute the full corpus takes roughly 40 minutes.

## What to expect

6,764 paragraphs, about 1.17M characters. A paragraph the engine rejects for
sentence length is split at the space nearest its midpoint and retried; the
pieces are concatenated back into one file, so it stays one file per
paragraph. The summary reports how many were split.

Verify before uploading — see `verify.mjs`. A request that returns 200 with
truncated audio is the failure mode that matters, and it is invisible here.
```

- [ ] **Step 8: Commit**

```bash
git add .gitignore scripts/tts-render/render.mjs scripts/tts-render/render.test.mjs scripts/tts-render/README.md src/data/audio-manifest.json
git commit -m "feat: render the corpus to one MP3 per paragraph

Sends first and splits on rejection rather than hardcoding the sentence
limit, which is undocumented, sits somewhere between 255 and 378
characters, and would silently stop matching if Google moved it. A split
lands on a space — already a clause boundary in Thai legal text — and the
seam was inaudible when listened to on a device.

Skips anything already rendered, so a failed run resumes for free and the
work can straddle two months to stay inside the free tier.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Verify before uploading

The failure that matters is not a request that errors — those are counted and retried. It is a request that returns 200 with audio that is truncated or silent. Nobody can listen to 6,764 files, so this has to be mechanical.

**Files:**
- Create: `scripts/tts-render/verify.mjs`
- Test: `scripts/tts-render/verify.test.mjs`
- Modify: `package.json` (add `music-metadata` devDependency)

**Interfaces:**
- Consumes: `collectParagraphs` from `./corpus.mjs`.
- Produces: `expectedSeconds(text)`, `checkDuration(text, seconds)`, `summarize(results)` for testing; a CLI that exits non-zero if anything fails.

- [ ] **Step 1: Install the audio metadata reader**

```bash
npm install -D music-metadata@^10
```

- [ ] **Step 2: Write the failing test**

Create `scripts/tts-render/verify.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { expectedSeconds, checkDuration, summarize } from './verify.mjs';

describe('expectedSeconds', () => {
  it('scales with text length', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeGreaterThan(expectedSeconds('ก'.repeat(50)));
  });

  it('is around 20 seconds for a median 150-character paragraph', () => {
    const s = expectedSeconds('ก'.repeat(150));
    expect(s).toBeGreaterThan(10);
    expect(s).toBeLessThan(30);
  });
});

describe('checkDuration', () => {
  const text = 'ก'.repeat(150);
  const expected = expectedSeconds(text);

  it('accepts audio close to the expectation', () => {
    expect(checkDuration(text, expected).ok).toBe(true);
  });

  it('rejects audio far shorter than expected — the truncation case', () => {
    expect(checkDuration(text, expected * 0.3).ok).toBe(false);
  });

  it('rejects audio far longer than expected', () => {
    expect(checkDuration(text, expected * 3).ok).toBe(false);
  });

  it('tolerates the natural spread of speech rate', () => {
    expect(checkDuration(text, expected * 0.75).ok).toBe(true);
    expect(checkDuration(text, expected * 1.35).ok).toBe(true);
  });
});

describe('summarize', () => {
  it('separates passes from failures', () => {
    const s = summarize([
      { hash: 'a', ok: true },
      { hash: 'b', ok: false, reason: 'too short' },
    ]);
    expect(s.passed).toBe(1);
    expect(s.failed).toHaveLength(1);
    expect(s.failed[0].hash).toBe('b');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- verify.test.mjs`
Expected: FAIL — cannot resolve `./verify.mjs`.

- [ ] **Step 4: Implement**

Create `scripts/tts-render/verify.mjs`:

```js
// Proves the rendered audio is complete and audible before any of it is
// uploaded. The failure that matters here is not an error — errors are
// counted and retried by render.mjs — but a 200 response carrying truncated
// or silent audio, which nothing else in the pipeline would notice and which
// nobody can catch by listening to 6,764 files.
//
// Usage, from the repository root:
//   node scripts/tts-render/verify.mjs
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';
import { collectParagraphs } from './corpus.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));

// The corpus is 1,165,409 characters and 43.4 hours of speech at this voice's
// default rate, i.e. about 7.5 characters per second.
const CHARS_PER_SECOND = 7.5;

// Speech rate varies with sentence structure, so the band has to be wide
// enough not to cry wolf. It is here to catch audio that stopped early, which
// is off by much more than this.
const TOLERANCE = 0.4;

export function expectedSeconds(text) {
  return text.length / CHARS_PER_SECOND;
}

export function checkDuration(text, actualSeconds) {
  const expected = expectedSeconds(text);
  const ratio = actualSeconds / expected;
  if (ratio < 1 - TOLERANCE) return { ok: false, reason: `too short: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  if (ratio > 1 + TOLERANCE) return { ok: false, reason: `too long: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  return { ok: true };
}

export function summarize(results) {
  return {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  };
}

async function main() {
  const paragraphs = collectParagraphs();
  const results = [];

  for (const p of paragraphs) {
    const file = `${OUT}${p.hash}.mp3`;
    if (!existsSync(file)) {
      results.push({ hash: p.hash, ok: false, reason: 'missing', p });
      continue;
    }
    if (statSync(file).size === 0) {
      results.push({ hash: p.hash, ok: false, reason: 'empty file', p });
      continue;
    }
    try {
      const meta = await parseFile(file, { duration: true });
      const seconds = meta.format.duration ?? 0;
      const check = checkDuration(p.text, seconds);
      results.push({ hash: p.hash, ok: check.ok, reason: check.reason, p });
    } catch (e) {
      results.push({ hash: p.hash, ok: false, reason: `unreadable: ${e.message}`, p });
    }
  }

  const { passed, failed } = summarize(results);
  console.log(`${passed} ok, ${failed.length} failed of ${results.length}`);
  for (const f of failed.slice(0, 50)) {
    console.log(`  ${f.p.book} ${f.p.number} ¶${f.p.paraIndex} (${f.p.text.length} chars): ${f.reason}`);
  }
  if (failed.length > 50) console.log(`  ...and ${failed.length - 50} more`);

  if (failed.length) {
    console.log('\ndelete the failing files from out/ and re-run render.mjs to redo just those');
    process.exit(1);
  }
  console.log('\nall files complete and audible — safe to upload');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- verify.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 6: Prove the check catches a truncated file**

A guard nobody has seen fail is not yet a guard. Using the pilot's real output:

```bash
node --input-type=module -e "
const { checkDuration, expectedSeconds } = await import('./scripts/tts-render/verify.mjs');
const text = 'ก'.repeat(300);
console.log('full  :', JSON.stringify(checkDuration(text, expectedSeconds(text))));
console.log('cut   :', JSON.stringify(checkDuration(text, expectedSeconds(text) * 0.25)));
"
```

Expected: the first is `{"ok":true}`, the second is `ok:false` with a "too short" reason.

- [ ] **Step 7: Run the whole suite and commit**

```bash
npm test
git add package.json package-lock.json scripts/tts-render/verify.mjs scripts/tts-render/verify.test.mjs
git commit -m "feat: verify rendered audio is complete before it is uploaded

An erroring request is visible and retried. A 200 carrying truncated or
silent audio is not, and nobody can hear their way through 6,764 files.
Comparing each file's real duration against what its character count
predicts catches exactly that, with a band wide enough that natural
variation in speech rate does not cry wolf.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Upload to R2

**Files:**
- Create: `scripts/tts-render/upload.mjs`
- Test: `scripts/tts-render/upload.test.mjs`
- Modify: `package.json` (add `@aws-sdk/client-s3` devDependency)
- Modify: `scripts/tts-render/README.md`

**Interfaces:**
- Consumes: `collectParagraphs` from `./corpus.mjs`.
- Produces: `objectKey(hash)`, `planUpload(paragraphs, existingKeys)` for testing; a CLI that uploads and then confirms.

R2 speaks the S3 API. The bucket name, account id and credentials come from the environment, never from the repository.

- [ ] **Step 1: Install the S3 client**

```bash
npm install -D @aws-sdk/client-s3@^3
```

- [ ] **Step 2: Write the failing test**

Create `scripts/tts-render/upload.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { objectKey, planUpload } from './upload.mjs';

describe('objectKey', () => {
  it('is a flat content-addressed path', () => {
    expect(objectKey('a1b2c3d4e5f60718')).toBe('audio/a1b2c3d4e5f60718.mp3');
  });
});

describe('planUpload', () => {
  const paragraphs = [
    { hash: 'aaaaaaaaaaaaaaaa' },
    { hash: 'bbbbbbbbbbbbbbbb' },
    { hash: 'aaaaaaaaaaaaaaaa' },
  ];

  it('skips objects already in the bucket', () => {
    const plan = planUpload(paragraphs, new Set(['audio/aaaaaaaaaaaaaaaa.mp3']));
    expect(plan).toEqual(['bbbbbbbbbbbbbbbb']);
  });

  it('uploads each hash once even when paragraphs repeat', () => {
    expect(planUpload(paragraphs, new Set())).toEqual(['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
  });

  it('plans nothing when the bucket already has everything', () => {
    const keys = new Set(paragraphs.map((p) => objectKey(p.hash)));
    expect(planUpload(paragraphs, keys)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- upload.test.mjs`
Expected: FAIL — cannot resolve `./upload.mjs`.

- [ ] **Step 4: Implement**

Create `scripts/tts-render/upload.mjs`:

```js
// Uploads the rendered audio to Cloudflare R2, which speaks the S3 API.
//
// Credentials come from the environment and are never read from a file in
// this repository:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Usage, from the repository root:
//   node scripts/tts-render/upload.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { collectParagraphs } from './corpus.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));

// Flat and content-addressed: the key never changes for a given piece of
// audio, so the CDN can cache it forever and a re-upload is always a no-op.
export function objectKey(hash) {
  return `audio/${hash}.mp3`;
}

export function planUpload(paragraphs, existingKeys) {
  const seen = new Set();
  const plan = [];
  for (const p of paragraphs) {
    if (seen.has(p.hash)) continue;
    seen.add(p.hash);
    if (!existingKeys.has(objectKey(p.hash))) plan.push(p.hash);
  }
  return plan;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name} — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET`);
    process.exit(1);
  }
  return v;
}

async function listExisting(client, bucket) {
  const keys = new Set();
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: 'audio/', ContinuationToken: token,
    }));
    for (const o of res.Contents ?? []) keys.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const bucket = requireEnv('R2_BUCKET');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  const paragraphs = collectParagraphs();
  const existing = await listExisting(client, bucket);
  console.log(`bucket already holds ${existing.size} objects`);

  const plan = planUpload(paragraphs, existing);
  console.log(`${plan.length} to upload`);

  const missingLocally = plan.filter((h) => !existsSync(`${OUT}${h}.mp3`));
  if (missingLocally.length) {
    console.error(`${missingLocally.length} files are missing from out/ — run render.mjs and verify.mjs first`);
    process.exit(1);
  }

  let done = 0;
  for (const hash of plan) {
    const file = `${OUT}${hash}.mp3`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(hash),
      Body: createReadStream(file),
      ContentLength: statSync(file).size,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    done += 1;
    if (done % 200 === 0) console.log(`  ${done}/${plan.length}`);
  }

  // Confirm from the bucket's own listing rather than from having sent the
  // requests — an upload that half-succeeded should not read as complete.
  const after = await listExisting(client, bucket);
  const stillMissing = paragraphs.filter((p) => !after.has(objectKey(p.hash)));
  console.log(`\nuploaded ${done}; bucket now holds ${after.size} objects`);
  if (stillMissing.length) {
    console.error(`${stillMissing.length} paragraphs still have no object — re-run`);
    process.exit(1);
  }
  console.log('every paragraph in the manifest has an object in the bucket');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- upload.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Document the R2 setup**

Append to `scripts/tts-render/README.md`:

```markdown
## Upload

Create an R2 bucket in the Cloudflare dashboard, then an API token scoped to
it (R2 → Manage API tokens → Object Read & Write). Export the four values —
never put them in a file in this repository:

    export R2_ACCOUNT_ID=...
    export R2_ACCESS_KEY_ID=...
    export R2_SECRET_ACCESS_KEY=...
    export R2_BUCKET=juris-voice-audio

    node scripts/tts-render/verify.mjs   # must pass first
    node scripts/tts-render/upload.mjs

Objects are `audio/<hash>.mp3`, immutable and cached for a year. Re-running
uploads only what the bucket does not already have, and finishes by listing
the bucket to confirm every paragraph in the manifest has an object — a
half-finished upload exits non-zero rather than reporting success.

Connect a custom domain or enable the r2.dev subdomain so the app can fetch
these over HTTPS; that base URL is what phase 3B needs.

### Cost at this size

468 MB of audio against R2's 10 GB free storage, and egress is free. At 1,000
daily users fetching ~8 paragraphs each, reads land near 240k/month against a
10M free allowance. Nothing here bills at this scale.
```

- [ ] **Step 7: Run the whole suite and commit**

```bash
npm test
git add package.json package-lock.json scripts/tts-render/upload.mjs scripts/tts-render/upload.test.mjs scripts/tts-render/README.md
git commit -m "feat: upload rendered audio to R2

Keys are content-addressed and immutable, so the CDN caches them forever
and a re-upload is a no-op. Credentials come from the environment only.

Finishes by listing the bucket and comparing against the manifest rather
than trusting that the PUTs it issued all landed — a half-finished upload
exits non-zero instead of reading as done.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Render the corpus for real

Everything before this is machinery. This is the run, and it is the only task whose output costs money.

**Files:** none — this task runs the tools built above and records what happened.

- [ ] **Step 1: Confirm the manifest is current**

```bash
node scripts/tts-render/render.mjs --manifest
git diff --stat src/data/audio-manifest.json
```

Expected: no diff. A diff here means paragraph parsing or the normalizer changed since Task 3, which would invalidate every hash — stop and find out why before spending anything.

- [ ] **Step 2: Render fifty paragraphs and verify them**

```bash
node scripts/tts-render/render.mjs --limit 50
node scripts/tts-render/verify.mjs
```

Expected: 50 files rendered; verify reports 50 ok and 6,714 missing, exiting non-zero because of the missing ones. Confirm the 50 that exist all passed the duration check.

- [ ] **Step 3: Listen to three of them**

Pick three files from `scripts/tts-render/out/` and play them. This is the last point at which a wrong voice, a wrong language or a mangled normalization is cheap to discover.

- [ ] **Step 4: Render the rest**

```bash
node scripts/tts-render/render.mjs
```

Expect roughly 40 minutes at 180 requests/minute. The summary reports how many paragraphs were split and how many characters were billed. If the run dies, re-run it — finished files are skipped.

- [ ] **Step 5: Verify everything**

```bash
node scripts/tts-render/verify.mjs
```

Expected: `all files complete and audible — safe to upload`.

If anything fails, delete those files from `out/` and re-run `render.mjs`; it will redo only what is missing. Do not upload until this exits zero.

- [ ] **Step 6: Sample by ear**

Automated checks prove nothing was truncated. They cannot tell you the audio is *right*. Listen to:
- 20 random files
- every file the verifier flagged and you re-rendered
- the paragraphs of civil 968, which must say "ร้อยละ เศษหนึ่งส่วนหก" and not "หนึ่งทับหก"
- civil 193/30 and criminal-proc 172 ทวิ/1, which must say "ทับ"

- [ ] **Step 7: Upload**

```bash
node scripts/tts-render/upload.mjs
```

Expected: `every paragraph in the manifest has an object in the bucket`.

- [ ] **Step 8: Record the outcome in the spec**

In `docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md`, add to §7.4 the numbers this run produced: paragraphs rendered, how many needed splitting, characters billed, the real cost from the Cloud console, and the bucket's public base URL. Phase 3B needs that URL.

```bash
git add docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md
git commit -m "docs: record the phase 3A render — counts, cost and bucket URL

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done when

- `npm test` passes, including the corpus paragraph-count pin and the app/renderer agreement test.
- `src/data/audio-manifest.json` is committed, around 250 KB, covering every section that has a paragraph.
- `node scripts/tts-render/verify.mjs` exits zero.
- Every paragraph in the manifest has an object in R2, confirmed by listing the bucket.
- The spec records the render's real counts, cost and the bucket base URL.

## Not in this plan

Phase 3B — playing this audio in the app — is a separate plan: `audioCache.js`, `audioPlayer.js`, the change to `speakOne`, prefetching, the fallback path, and the offline download screen. It depends on the manifest and base URL this plan produces, and on `@capgo/native-audio`, which phase 0 chose and spike round 5 verified for long playback and for handing the audio session back and forth with the TTS plugin.
