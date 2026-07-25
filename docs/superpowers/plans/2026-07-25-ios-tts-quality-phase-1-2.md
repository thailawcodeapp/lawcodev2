# iOS TTS Quality — Phase 1 + 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the iOS voice read Thai section numbers correctly and stop it silently using the low-quality voice, without altering a single byte of the law text.

**Architecture:** A pure `normalizeForSpeech()` transforms a *copy* of each string on its way into the TTS engine only — display and search keep the original. The voice-selection bugs are fixed by making the resolver cache clearable and by persisting a stable `voiceURI` instead of an array index. Phase 2 adds a throwaway script that renders ten real sections through Google TTS so the engine and voice can be chosen by ear.

**Tech Stack:** Vite 5 · React 18 · Vitest (new) · Capacitor 8 · `@capacitor-community/text-to-speech` · Google Cloud Text-to-Speech (phase 2 only) · Node 22

Design spec: [`docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md`](../specs/2026-07-25-ios-tts-quality-design.md)

## Global Constraints

- Branch is `cloud-sync`. Never commit to `main`.
- **Never modify `public/data/*.json`.** Task 1 installs a checksum test that fails if any byte changes.
- Bump `APP_VERSION_CODE` in `src/config.js` **and** `versionCode` in `android/app/build.gradle` together on any commit that ships.
- iOS version train `1.0.4` is already used by spike builds 18–21. The first real release build must be **`CURRENT_PROJECT_VERSION = 22` or higher**, or Apple rejects the upload as a duplicate.
- `src/` is shared by iOS, Android and web. Any change there must be verified not to break Android.
- Do not touch `android/` unless a task says to.
- Normalization applies **only** to text handed to the TTS engine. Text rendered on screen and text fed to search must stay byte-identical to the JSON.
- `GoogleService-Info.plist` stays gitignored; it is injected by CI.
- The spike branch `spike/background-audio` is throwaway. Do not merge it.

---

### Task 1: Corpus checksum guard + test runner

The owner has previously had law text altered by accident. Before any task touches speech text, install the guard that makes such a change impossible to miss. Vitest is chosen because the project already builds on Vite, so it needs no separate transform config.

**Files:**
- Modify: `package.json` (add `vitest` devDependency and `test` script)
- Create: `vitest.config.js`
- Create: `src/data/corpus.checksums.json`
- Create: `scripts/update-corpus-checksums.mjs`
- Test: `src/data/corpus.integrity.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest in Node environment over `src/**/*.test.js`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"` (keep the existing entries):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Generate the checksum file**

Create `scripts/update-corpus-checksums.mjs`:

```js
// Regenerates src/data/corpus.checksums.json.
// Run this ONLY when a law-text change is intentional — the diff on the
// checksum file is the signal to a reviewer that the corpus was edited.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const out = {};
for (const f of FILES) {
  out[f] = createHash('sha256').update(readFileSync(f)).digest('hex');
}
writeFileSync('src/data/corpus.checksums.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(out);
```

Run it:

```bash
node scripts/update-corpus-checksums.mjs
```

- [ ] **Step 5: Write the guard test**

Create `src/data/corpus.integrity.test.js`:

```js
// The law text is the product. Nothing in this repo writes to these files,
// and this test makes an accidental edit impossible to merge unnoticed.
// If a corpus change IS intended, run scripts/update-corpus-checksums.mjs
// and commit the checksum diff alongside it.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import checksums from './corpus.checksums.json';

describe('law corpus integrity', () => {
  for (const [file, expected] of Object.entries(checksums)) {
    it(`${file} is unchanged`, () => {
      const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(actual).toBe(expected);
    });
  }
});
```

- [ ] **Step 6: Run the tests — they must pass**

Run: `npm test`
Expected: 4 passing tests, one per corpus file.

- [ ] **Step 7: Prove the guard actually catches an edit**

```bash
node -e "const f='public/data/criminal-th.json';const s=require('fs');s.writeFileSync(f,s.readFileSync(f,'utf8')+' ')"
npm test
```

Expected: FAIL on `public/data/criminal-th.json is unchanged`.

Now restore the file and confirm the tests pass again:

```bash
git checkout public/data/criminal-th.json
npm test
```

Expected: PASS. A guard that has never been seen to fail is not yet a guard.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.js scripts/update-corpus-checksums.mjs src/data/corpus.checksums.json src/data/corpus.integrity.test.js
git commit -m "test: fail the build if the law corpus changes

Nothing in the repo writes to public/data/*.json, but the text is the
product and a past accidental edit is the reason this exists. Verified by
appending a byte and watching the test fail. An intentional corpus edit
regenerates the checksums in the same commit, so the diff is visible.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `normalizeForSpeech()`

The one text rule that survived device testing: read `/` in a section number as the Thai word "ทับ". Whitelisted rather than blacklisted, because the naive version misreads a real fraction (see spec §5.1).

**Files:**
- Create: `src/lib/thaiSpeech.js`
- Test: `src/lib/thaiSpeech.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeForSpeech(text: string) => string`. Pure, no imports, safe in both the browser bundle and a Node script. Task 3 and phase 3's render pipeline both call it.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/thaiSpeech.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeForSpeech } from './thaiSpeech';

describe('normalizeForSpeech — converts section numbers', () => {
  it('reads a slash in a section number as ทับ', () => {
    expect(normalizeForSpeech('มาตรา 193/30')).toBe('มาตรา 193 ทับ 30');
  });

  it('converts a reference inside the body', () => {
    expect(normalizeForSpeech('ให้นำมาตรา 1598/21 มาใช้บังคับ'))
      .toBe('ให้นำมาตรา 1598 ทับ 21 มาใช้บังคับ');
  });

  it('handles a Thai ordinal between the digits and the slash', () => {
    expect(normalizeForSpeech('มาตรา 172 ทวิ/1')).toBe('มาตรา 172 ทวิ ทับ 1');
  });

  it('converts a parenthesised sub-clause number', () => {
    expect(normalizeForSpeech('(4/1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง'))
      .toBe('(4 ทับ 1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง');
  });

  it('converts every occurrence in one string', () => {
    expect(normalizeForSpeech('มาตรา 3/1 และมาตรา 3/2'))
      .toBe('มาตรา 3 ทับ 1 และมาตรา 3 ทับ 2');
  });
});

describe('normalizeForSpeech — leaves everything else alone', () => {
  it('does not touch a real fraction (civil s.968 discount rate)', () => {
    const t = 'ท่านให้คิดร้อยละ 1/6 ในต้นเงินอันจะพึงใช้ตามตั๋วเงิน';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('does not touch a slash with no มาตรา in front of it', () => {
    expect(normalizeForSpeech('อัตรา 3/4 ของทั้งหมด')).toBe('อัตรา 3/4 ของทั้งหมด');
  });

  it('leaves ordinary prose untouched', () => {
    const t = 'ผู้ใดจงใจหรือประมาทเลินเล่อ ทำต่อบุคคลอื่นโดยผิดกฎหมาย';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('does not insert commas or otherwise repunctuate', () => {
    const t = 'แก่ร่างกายก็ดี อนามัยก็ดี เสรีภาพก็ดี';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('handles empty and nullish input', () => {
    expect(normalizeForSpeech('')).toBe('');
    expect(normalizeForSpeech(null)).toBe('');
    expect(normalizeForSpeech(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- thaiSpeech`
Expected: FAIL — `Failed to resolve import "./thaiSpeech"`.

- [ ] **Step 3: Implement**

Create `src/lib/thaiSpeech.js`:

```js
// Text fixes applied on the way into the speech engine — never to the text
// shown on screen or fed to search.
//
// One rule: Thai section numbers are written "193/30" and read aloud
// "193 ทับ 30". Left alone, both the iOS and Android engines read the slash
// as a fraction ("เศษ 193 ส่วน 30"), which is wrong in 437 places.
//
// It whitelists the contexts it recognises instead of blacklisting the ones
// it doesn't, because a naive \d+/\d+ rule breaks civil s.968 —
// "ให้คิดร้อยละ 1/6" is a discount rate, and "หนึ่งทับหก" states the wrong
// one. Enumerating the exceptions (ร้อยละ, อัตรา, …) means guessing at a list
// nobody can complete; recognising "this follows the word มาตรา" is a claim
// we can actually check. Anything unrecognised keeps the engine's default
// fraction reading, which is what s.968 wants anyway.
//
// The left side accepts a trailing Thai word because sections numbered
// "มาตรา 172 ทวิ/1" put an ordinal between the digits and the slash.

const SLASH_RE = /(\d+(?:\s*[฀-๿]+)?)\/(\d+)/g;

// How far back to look for "มาตรา". Long enough for "มาตรา 1598 ทวิ",
// short enough that an unrelated มาตรา earlier in the sentence can't reach.
const LOOKBACK = 20;

export function normalizeForSpeech(text) {
  if (!text) return '';
  return String(text).replace(SLASH_RE, (full, left, right, offset, str) => {
    const isSubClause = str[offset - 1] === '(' && str[offset + full.length] === ')';
    const followsMaatra = /มาตรา[\s฀-๿]{0,8}$/
      .test(str.slice(Math.max(0, offset - LOOKBACK), offset));
    return isSubClause || followsMaatra ? `${left} ทับ ${right}` : full;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- thaiSpeech`
Expected: PASS, 10 tests.

- [ ] **Step 5: Add the corpus-wide test**

Unit tests prove the rule handles the cases we thought of. This one proves it does the right thing to all 3,109 real sections, and pins the exact count so a future edit to the regex can't silently widen its reach.

Append to `src/lib/thaiSpeech.test.js`:

```js
import { readFileSync } from 'node:fs';

const BOOKS = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const allSections = () =>
  BOOKS.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).sections);

describe('normalizeForSpeech — against the real corpus', () => {
  it('converts exactly 437 sites and skips exactly 1', () => {
    let converted = 0;
    const skipped = [];
    for (const s of allSections()) {
      const text = s.text || '';
      for (const m of text.matchAll(/(\d+(?:\s*[฀-๿]+)?)\/(\d+)/g)) {
        const isSub = text[m.index - 1] === '(' && text[m.index + m[0].length] === ')';
        const follows = /มาตรา[\s฀-๿]{0,8}$/
          .test(text.slice(Math.max(0, m.index - 20), m.index));
        if (isSub || follows) converted += 1;
        else skipped.push(`${s.number}: ${m[0]}`);
      }
    }
    expect(converted).toBe(437);
    expect(skipped).toEqual(['968: 1/6']);
  });

  it('changes nothing but slashes anywhere in the corpus', () => {
    for (const s of allSections()) {
      const text = s.text || '';
      const spoken = normalizeForSpeech(text);
      // Strip the one construct the rule is allowed to introduce, then the
      // two strings must be identical — no dropped, reordered or added words.
      expect(spoken.replace(/ ทับ /g, '/')).toBe(text);
    }
  });
});
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — 12 `thaiSpeech` tests plus the 4 corpus-integrity tests.

If the count assertion fails, **do not edit the expected number to match.** It means the rule's reach changed; find out which sites moved and why.

- [ ] **Step 7: Commit**

```bash
git add src/lib/thaiSpeech.js src/lib/thaiSpeech.test.js
git commit -m "feat: read section-number slashes as ทับ for the speech engine

Both engines read 'มาตรา 193/30' as a fraction, which is wrong in 437
places across the four codes. The rule whitelists the contexts it
recognises — after มาตรา, or a parenthesised sub-clause — rather than
blacklisting exceptions, because the naive form misreads civil s.968's
'ร้อยละ 1/6', a discount rate whose default fraction reading is already
correct. The left side accepts a trailing Thai word so 'มาตรา 172 ทวิ/1'
is caught too.

A corpus test pins the 437/1 split and asserts that stripping the
introduced ' ทับ ' reproduces the source text exactly, so the rule cannot
quietly drop or reorder anything.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Feed normalized text to the engine

`buildSectionItem()` is the single place where section text becomes speech units, so it is the only place that needs to call the rule. `parseBody()` has already stripped the "มาตรา X" heading from the body by this point, which is why the heading is normalized separately.

**Files:**
- Modify: `src/lib/tts.js:64-70` (`buildSectionItem`)
- Test: `src/lib/tts.buildSectionItem.test.js`

**Interfaces:**
- Consumes: `normalizeForSpeech` from Task 2.
- Produces: no signature change. `buildSectionItem({sectionId, bookId, number, title, paragraphs})` still returns `{sectionId, bookId, number, title, label, chunks}` where `chunks` is `[{text, paraIndex}]`. `label` keeps the **unnormalized** number because it is displayed in the player UI.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tts.buildSectionItem.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSectionItem } from './tts';

describe('buildSectionItem', () => {
  it('normalizes the heading chunk', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.chunks[0].text).toBe('มาตรา 193 ทับ 30');
  });

  it('normalizes references inside the body', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '5',
      title: '', paragraphs: ['ให้นำมาตรา 1598/21 มาใช้บังคับ'],
    });
    expect(item.chunks[1].text).toBe('ให้นำมาตรา 1598 ทับ 21 มาใช้บังคับ');
  });

  it('keeps label unnormalized — it is shown on screen, not spoken', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.label).toBe('มาตรา 193/30');
    expect(item.number).toBe('193/30');
  });

  it('still maps every chunk to its paragraph index', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก', 'ย่อหน้าที่สอง'],
    });
    expect(item.chunks.map((c) => c.paraIndex)).toEqual([-1, 0, 1]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- buildSectionItem`
Expected: FAIL — first test receives `'มาตรา 193/30'`.

- [ ] **Step 3: Implement**

In `src/lib/tts.js`, add to the imports at the top of the file:

```js
import { normalizeForSpeech } from './thaiSpeech';
```

Then replace `buildSectionItem` (lines 64-70) with:

```js
// `label` and `number` stay as written — they are rendered in the player.
// Only the chunk text, which exists solely to be spoken, is normalized.
export function buildSectionItem({ sectionId, bookId, number, title, paragraphs }) {
  const chunks = [{ text: normalizeForSpeech(`มาตรา ${number}`), paraIndex: -1 }];
  (paragraphs || []).forEach((p, pi) => {
    for (const c of splitLong(normalizeForSpeech(p))) chunks.push({ text: c, paraIndex: pi });
  });
  return { sectionId, bookId, number, title: title || '', label: `มาตรา ${number}`, chunks };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- buildSectionItem`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite and build**

```bash
npm test
npm run build
```

Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tts.js src/lib/tts.buildSectionItem.test.js
git commit -m "feat: normalize section text on its way into the speech engine

buildSectionItem is the only place section text becomes speech units, so
it is the only place the rule belongs. parseBody has already stripped the
heading from the body by then, which is why the heading is normalized on
its own line.

label and number keep the written form — they are rendered in the player,
and a test pins that so the normalization cannot leak into the UI.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Stop the voice resolver from caching a stale choice

`resolveIosBestVoice()` memoizes into a module-level promise that never expires (`src/lib/tts.js:89-114`). A user who opens the app, goes to iOS Settings, downloads the Enhanced Thai voice and comes back keeps hearing the compact voice until they force-quit — exactly the complaint that started this work.

**Files:**
- Modify: `src/lib/tts.js:89-114` (resolver + new `clearVoiceCache`)
- Modify: `src/lib/tts.js:395-417` (`speakSample`)
- Modify: `src/context/TtsContext.jsx:1-24` (clear on app resume)
- Test: `src/lib/tts.voiceCache.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `clearVoiceCache(): void` exported from `src/lib/tts.js`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tts.voiceCache.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The plugin is native-only; stub it so the resolver can be exercised in Node.
const getSupportedVoices = vi.fn();
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    getSupportedVoices: (...a) => getSupportedVoices(...a),
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

const asIos = () => {
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
};

describe('voice resolver cache', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupportedVoices.mockReset();
    asIos();
  });

  it('asks the system only once while the cache is warm', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    await tts.speakSample('ทดสอบ');
    await tts.speakSample('ทดสอบ');
    expect(getSupportedVoices).toHaveBeenCalledTimes(1);
  });

  it('asks again after clearVoiceCache, so a newly installed voice is seen', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    await tts.speakSample('ทดสอบ');

    tts.clearVoiceCache();
    getSupportedVoices.mockResolvedValue({
      voices: [
        { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
        { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
      ],
    });
    await tts.speakSample('ทดสอบ');
    expect(getSupportedVoices).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- voiceCache`
Expected: FAIL — `tts.clearVoiceCache is not a function`.

- [ ] **Step 3: Implement the clearable cache**

In `src/lib/tts.js`, replace the comment block and resolver at lines 81-114 with:

```js
// ─── iOS voice quality auto-pick ─────────────────────────────────────────────
// iOS ships the Thai voice (Kanya) in three qualities: compact (default,
// robotic), enhanced, and premium. AVSpeechSynthesizer falls back to compact
// unless a specific voice is requested, which is why iOS sounds worse than
// Android's Google TTS out of the box. When the user hasn't picked a voice,
// prefer the best-quality Thai voice installed on the device.
// Android is untouched: this resolver returns null there and the engine
// default (Google TTS) is used, same as before.
//
// The result is cached because getSupportedVoices() is a native round-trip on
// every chunk, but the cache must be droppable: users download the Enhanced
// voice from iOS Settings *while the app is backgrounded*, and the WebView
// survives that trip. A cache with no way out meant they kept hearing the
// compact voice until they force-quit.
let _iosVoicePromise = null;

export function clearVoiceCache() {
  _iosVoicePromise = null;
}

function resolveIosBestVoice() {
  if (_iosVoicePromise) return _iosVoicePromise;
  _iosVoicePromise = (async () => {
    try {
      const r = await TextToSpeech.getSupportedVoices();
      const th = (r.voices || [])
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.lang === 'th-TH' || v.lang?.startsWith('th'));
      if (!th.length) return null;
      // voiceURI examples: com.apple.voice.premium.th-TH.Kanya,
      // com.apple.voice.enhanced.th-TH.Kanya, com.apple.ttsbundle.Kanya-compact
      const rank = ({ v }) => {
        const u = `${v.voiceURI || ''} ${v.name || ''}`.toLowerCase();
        if (u.includes('premium')) return 0;
        if (u.includes('enhanced')) return 1;
        return 2;
      };
      th.sort((a, b) => rank(a) - rank(b));
      return th[0].i;
    } catch {
      return null;
    }
  })();
  return _iosVoicePromise;
}
```

- [ ] **Step 4: Drop the cache before the settings preview**

In `src/lib/tts.js`, in `speakSample()`, add the cache drop as the first statement inside the `if (isNative())` branch, before `TextToSpeech.stop()`:

```js
    if (isNative()) {
      // The user reaches this button right after installing a voice — always
      // re-resolve so the preview reflects what is actually on the device now.
      clearVoiceCache();
      const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
      TextToSpeech.stop().catch(() => {});
```

- [ ] **Step 5: Drop the cache whenever the app comes back to the foreground**

In `src/context/TtsContext.jsx`, add the import:

```js
import { App as CapApp } from '@capacitor/app';
```

and add this effect immediately after the existing "Apply persisted voice settings" effect (after line 24):

```js
  // Voices are installed in iOS Settings, which means leaving and returning to
  // the app. Re-resolve on every resume so a voice downloaded mid-session is
  // picked up without a force-quit.
  useEffect(() => {
    let handle;
    CapApp.addListener('resume', () => tts.clearVoiceCache())
      .then((h) => { handle = h; })
      .catch(() => {});
    return () => { handle?.remove?.(); };
  }, []);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- voiceCache`
Expected: PASS, 2 tests.

- [ ] **Step 7: Run the whole suite and build**

```bash
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tts.js src/context/TtsContext.jsx src/lib/tts.voiceCache.test.js
git commit -m "fix: re-resolve the iOS voice after the user installs one

The resolver memoized into a module-level promise with no way out. Users
download the Enhanced Thai voice from iOS Settings while the app is
backgrounded, the WebView survives that trip, and the app kept using the
compact voice it had picked at launch until a force-quit — which is the
complaint this whole effort started from.

Keeps the cache, since getSupportedVoices is a native round-trip per
chunk, but drops it on app resume and before the settings preview.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Persist the voice as a stable id, not an array index

The plugin addresses a voice by its **position** in `AVSpeechSynthesisVoice.speechVoices()`. That array reorders when the user installs or removes any voice, in any language — so a stored index can start pointing at a different voice, or a different language entirely. `getSupportedVoices()` already returns `voiceURI` (`voice.identifier`), which is stable.

**Files:**
- Modify: `src/lib/tts.js:279-309` (`getVoices`)
- Modify: `src/lib/tts.js:116-122` (`resolveVoiceIndex`)
- Test: `src/lib/tts.voiceId.test.js`

**Interfaces:**
- Consumes: `clearVoiceCache` from Task 4 (test setup only).
- Produces: `getVoices()` resolves to `[{ id, name, lang }]` where **`id` is now the `voiceURI` string**, not a stringified index. `setVoice(v)` accepts that string, or `null` for automatic. Stored in `settings.ttsVoice`. `VoiceSettings.jsx` needs no change — it already round-trips `v.id` opaquely.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tts.voiceId.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSupportedVoices = vi.fn();
const speak = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    getSupportedVoices: (...a) => getSupportedVoices(...a),
    speak: (...a) => speak(...a),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

const VOICES = [
  { voiceURI: 'com.apple.voice.compact.en-US.Samantha', name: 'Samantha', lang: 'en-US' },
  { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
  { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
];

const asIos = () => {
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
};

describe('voice identity', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupportedVoices.mockReset();
    speak.mockClear();
    asIos();
    getSupportedVoices.mockResolvedValue({ voices: VOICES });
  });

  it('exposes the stable voiceURI as the id', async () => {
    const tts = await import('./tts');
    const list = await tts.getVoices();
    expect(list.map((v) => v.id)).toEqual([
      'com.apple.ttsbundle.Kanya-compact',
      'com.apple.voice.enhanced.th-TH.Kanya',
    ]);
  });

  it('speaks with the voice the user chose, found by id', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.enhanced.th-TH.Kanya');
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(2);
  });

  it('still resolves after the system list reorders', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.enhanced.th-TH.Kanya');
    getSupportedVoices.mockResolvedValue({ voices: [VOICES[2], VOICES[0], VOICES[1]] });
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(0);
  });

  it('falls back to auto-pick when the chosen voice is gone', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.premium.th-TH.SomeoneElse');
    await tts.speakSample('ทดสอบ');
    // auto-pick prefers enhanced over compact
    expect(speak.mock.calls[0][0].voice).toBe(2);
  });

  it('treats a legacy numeric setting as unset', async () => {
    const tts = await import('./tts');
    tts.setVoice(2); // what older builds persisted
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(2); // auto-pick, not "index 2" by luck
    expect(tts.getVoice()).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- voiceId`
Expected: FAIL — ids come back as `'1'`/`'2'`.

- [ ] **Step 3: Make `setVoice` reject legacy numeric values**

In `src/lib/tts.js`, replace the one-line `setVoice` (line 267) with:

```js
// Older builds persisted the plugin's array index here. That index is not
// stable across voice installs, so an old value cannot be translated into a
// voiceURI after the fact — drop it and fall back to auto-pick.
export function setVoice(v) {
  _voice = typeof v === 'string' && v !== '' ? v : null;
}
```

- [ ] **Step 4: Return voiceURI as the id**

In `src/lib/tts.js`, inside `getVoices()`, replace the native branch's `return { id: String(i), name, lang, isThai };` with:

```js
        // voiceURI is AVSpeechSynthesisVoice.identifier — stable across
        // installs, unlike the array position the plugin's speak() wants.
        return { id: v.voiceURI || String(i), name, lang, isThai };
```

and delete the now-stale comment above it that says the plugin addresses a voice by its index in this array.

- [ ] **Step 5: Translate the stored id to an index at speak time**

In `src/lib/tts.js`, replace `resolveVoiceIndex()` (lines 116-122) with:

```js
// The plugin's speak() takes a position in the system voice list, but that
// position moves whenever a voice is installed or removed. Persist the stable
// id and look up its current position each time we speak.
//
// The id must be derived the same way getVoices() derives it, or the lookup
// misses on Android, where the plugin may not report a voiceURI at all.
async function resolveVoiceIndex() {
  if (_voice) {
    try {
      const r = await TextToSpeech.getSupportedVoices();
      const i = (r.voices || []).findIndex((v, n) => (v.voiceURI || String(n)) === _voice);
      if (i >= 0) return i;
    } catch { /* fall through */ }
    // Chosen voice is gone — fall through rather than speak in whichever
    // language now occupies that slot.
  }
  if (platform() === 'ios') return resolveIosBestVoice();
  return null; // Android: let the engine default (Google TTS) decide
}
```

The `(v.voiceURI || String(n))` must stay in step with the same expression in `getVoices()`. If one changes, both change.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- voiceId`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the whole suite and build**

```bash
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tts.js src/lib/tts.voiceId.test.js
git commit -m "fix: persist the chosen voice by id instead of list position

The plugin addresses a voice by its index in speechVoices(), and that
array reorders whenever any voice is installed or removed — in any
language. A saved index could end up pointing at a different voice
entirely. voiceURI is AVSpeechSynthesisVoice.identifier and does not move,
so store that and look up the current position at speak time.

Values persisted by older builds are numbers; they cannot be translated
after the fact, so setVoice drops them and auto-pick takes over. If the
chosen voice has been uninstalled, auto-pick takes over too, rather than
speaking in whichever language now occupies that slot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Ship phase 1 and verify on both platforms

Everything so far is shared JS. This task proves it behaves on real devices and gets it out to users.

**Files:**
- Modify: `src/config.js:28` (`APP_VERSION_CODE`)
- Modify: `android/app/build.gradle` (`versionCode`, `versionName`)
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (`CURRENT_PROJECT_VERSION`, `MARKETING_VERSION`)

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: an iOS build on TestFlight and an Android AAB artifact.

- [ ] **Step 1: Confirm Android is unaffected by the shared-code changes**

```bash
npm run build
node -e "
const {normalizeForSpeech} = await import('./src/lib/thaiSpeech.js');
console.log(normalizeForSpeech('มาตรา 193/30'));
" --input-type=module
```

Expected: `มาตรา 193 ทับ 30`. The rule has no platform gate — Android gets the same fix, which is intended.

- [ ] **Step 2: Bump the version in all three places**

`src/config.js` line 28:

```js
export const APP_VERSION_CODE = 47;
```

`android/app/build.gradle`: set `versionCode 47` and `versionName "1.0.4"`.

`ios/App/App.xcodeproj/project.pbxproj`: set **both** occurrences of `CURRENT_PROJECT_VERSION = 22;` and keep `MARKETING_VERSION = 1.0.4;`.

Builds 18–21 on the 1.0.4 train were spikes, so 22 is the first free number.

- [ ] **Step 3: Verify the version numbers agree**

```bash
grep -n "APP_VERSION_CODE" src/config.js
grep -n "versionCode\|versionName" android/app/build.gradle
grep -n "CURRENT_PROJECT_VERSION\|MARKETING_VERSION" ios/App/App.xcodeproj/project.pbxproj
```

Expected: `47`, `47` / `"1.0.4"`, and `22` / `1.0.4` twice.

- [ ] **Step 4: Commit and push**

```bash
git add src/config.js android/app/build.gradle ios/App/App.xcodeproj/project.pbxproj
git commit -m "versionCode 47 / iOS 1.0.4 build 22: ship the speech text and voice fixes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin cloud-sync
```

- [ ] **Step 5: Build iOS**

```bash
TOKEN=$(git remote get-url origin | sed -E 's#https://([^:@]+)@github.com.*#\1#')
curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/thailawcodeapp/lawcodev2/actions/workflows/build-ipa.yml/dispatches \
  -d '{"ref":"cloud-sync"}' -w "HTTP %{http_code}\n"
```

Expected: `HTTP 204`.

- [ ] **Step 6: Confirm the upload actually reached TestFlight**

The workflow's upload step sets `continue-on-error: true`, so GitHub reports `conclusion: success` **even when the upload failed**. Read the log, not the status:

```bash
TOKEN=$(git remote get-url origin | sed -E 's#https://([^:@]+)@github.com.*#\1#')
RUN=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/thailawcodeapp/lawcodev2/actions/workflows/build-ipa.yml/runs?branch=cloud-sync&per_page=1" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
JOB=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/thailawcodeapp/lawcodev2/actions/runs/$RUN/jobs" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
curl -sL -H "Authorization: token $TOKEN" "https://api.github.com/repos/thailawcodeapp/lawcodev2/actions/jobs/$JOB/logs" | grep -i "UPLOAD SUCCEEDED\|UPLOAD FAILED\|ERROR:"
```

Expected: `UPLOAD SUCCEEDED with no errors`.

- [ ] **Step 7: Test on a real iPhone**

Install 1.0.4 (22) from TestFlight and listen to each of these:

| Section | Must hear | Checks |
|---|---|---|
| แพ่ง 193/30 | "มาตรา หนึ่งร้อยเก้าสิบสาม **ทับ** สามสิบ" | the fix works |
| อาญา 172 ทวิ/1 | "...หนึ่งร้อยเจ็ดสิบสอง ทวิ **ทับ** หนึ่ง" | the Thai-ordinal case |
| **แพ่ง 968** | "ร้อยละ **เศษหนึ่งส่วนหก**" — *not* "หนึ่งทับหก" | the whitelist holds |
| วิ.แพ่ง 4 ฉ | note down how "ฉ" is read | decides open question 10 |

Then, for the voice fixes: with the Enhanced Thai voice **not** installed, open the app and play a section; go to iOS Settings and install it; return to the app and play again — the voice must change with no force-quit.

- [ ] **Step 8: Test on a real Android device**

Build the AAB:

```bash
TOKEN=$(git remote get-url origin | sed -E 's#https://([^:@]+)@github.com.*#\1#')
curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/thailawcodeapp/lawcodev2/actions/workflows/build-aab.yml/dispatches \
  -d '{"ref":"cloud-sync"}' -w "HTTP %{http_code}\n"
```

Install it and confirm มาตรา 193/30 reads with "ทับ" and that nothing else about playback changed.

- [ ] **Step 9: Record the ฉ result**

Three sections are numbered with a bare `ฉ` (วิ.แพ่ง 4 ฉ, 83 ฉ, 199 ฉ). The letter's name is "ฉอ", and it is unknown whether the engine says that or mangles it.

**If it was read correctly:** mark open question 10 in the spec as answered — "no rule needed" — and change no code. Three sections do not justify a rule that touches text.

**If it was read wrong:** add this test to `src/lib/thaiSpeech.test.js`:

```js
describe('normalizeForSpeech — the bare ฉ suffix', () => {
  it('spells out ฉ when it numbers a section', () => {
    expect(normalizeForSpeech('มาตรา 4 ฉ คำร้องขอ')).toBe('มาตรา 4 ฉอ คำร้องขอ');
  });

  it('does not touch ฉ inside a word', () => {
    const t = 'มาตรา 342 ฉ้อโกงประชาชน';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('does not touch a bare ฉ with no section number in front', () => {
    const t = 'ตัวอักษร ฉ ในภาษาไทย';
    expect(normalizeForSpeech(t)).toBe(t);
  });
});
```

and this rule to `src/lib/thaiSpeech.js`, applied after the slash rule inside `normalizeForSpeech`:

```js
// "มาตรา 4 ฉ" numbers a section; the letter is read "ฉอ". Requires a section
// number in front and a word boundary after, so it cannot bite into ฉ้อโกง —
// which follows a section number too, and is a real word.
const CHO_RE = /(มาตรา\s+\d+\s+)ฉ(?=\s|$)/g;
```

with the body becoming:

```js
export function normalizeForSpeech(text) {
  if (!text) return '';
  const withSlashes = String(text).replace(SLASH_RE, (full, left, right, offset, str) => {
    const isSubClause = str[offset - 1] === '(' && str[offset + full.length] === ')';
    const followsMaatra = /มาตรา[\s฀-๿]{0,8}$/
      .test(str.slice(Math.max(0, offset - LOOKBACK), offset));
    return isSubClause || followsMaatra ? `${left} ทับ ${right}` : full;
  });
  return withSlashes.replace(CHO_RE, '$1ฉอ');
}
```

Then re-run `npm test` — the corpus test that strips ` ทับ ` and compares against the source will now fail on those three sections, so extend its normalization to strip `ฉอ` back to `ฉ` as well. Commit, and answer open question 10 in the spec.

---

### Task 7: Phase 2 — pilot render, to choose the engine and voice by ear

A throwaway script. Its output is a decision plus a real invoice line, not shipped code. Chirp 3 HD and Gemini-TTS both sound plausible in Google's demo; the demo does not tell us how they handle 1,352-character legal paragraphs, nor what the bill looks like.

**Files:**
- Create: `scripts/tts-pilot/render.mjs`
- Create: `scripts/tts-pilot/README.md`
- Modify: `.gitignore` (ignore the generated audio)

**Interfaces:**
- Consumes: `normalizeForSpeech` from Task 2 — the pilot must hear exactly what the render pipeline will later produce.
- Produces: `scripts/tts-pilot/out/<engine>-<voice>-<section>.mp3` plus a printed character count for cost reconciliation.

- [ ] **Step 1: Ignore the generated audio**

Append to `.gitignore`:

```
scripts/tts-pilot/out/
```

- [ ] **Step 2: Write the pilot script**

Create `scripts/tts-pilot/render.mjs`:

```js
// Phase 2 pilot — renders ten real sections so the engine and voice can be
// chosen by ear rather than from a marketing demo, and so the first bill
// tells us the real per-character cost before committing to 6,770 files.
//
// Throwaway: not imported by the app, not run in CI.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/tts-pilot/render.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { normalizeForSpeech } from '../../src/lib/thaiSpeech.js';

// Chosen to cover what the corpus actually throws at a synthesiser:
// the longest paragraph, a slash number, a Thai ordinal, a real fraction,
// a multi-paragraph section, and a couple of ordinary ones.
const SAMPLES = [
  ['civil-th', '420'],        // 9 clause-separating spaces — the phrasing case
  ['civil-th', '193/30'],     // slash number
  ['civil-th', '968'],        // real fraction, must stay a fraction
  ['civil-th', '1598/21'],    // slash in the body too
  ['criminal-th', '288'],     // short and well known
  ['criminal-th', '172 ทวิ/1'], // Thai ordinal before the slash
  ['criminal-proc-th', '7'],  // list-heavy
  ['civil-proc-th', '4 ฉ'],   // the ฉ suffix
  ['civil-proc-th', '222/12'], // procedural, dense cross-references
  ['civil-th', '1'],          // the opening section
];

// Star-named Chirp 3 voices, picked for a 43-hour listen: clear and even
// beats characterful. Upbeat and breathy voices tire the ear over an hour.
const CHIRP_VOICES = ['th-TH-Chirp3-HD-Gacrux', 'th-TH-Chirp3-HD-Charon', 'th-TH-Chirp3-HD-Schedar'];

const OUT = new URL('./out/', import.meta.url).pathname;

function loadSection(book, number) {
  const j = JSON.parse(readFileSync(`public/data/${book}.json`, 'utf8'));
  const s = j.sections.find((x) => String(x.number) === number);
  if (!s) throw new Error(`not found: ${book} ${number}`);
  return s;
}

// Same unit the render pipeline will use: one paragraph per request.
function paragraphsOf(section) {
  return (section.text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizeForSpeech);
}

const client = new TextToSpeechClient();
let totalChars = 0;

mkdirSync(OUT, { recursive: true });

for (const [book, number] of SAMPLES) {
  const paragraphs = paragraphsOf(loadSection(book, number));
  for (const voice of CHIRP_VOICES) {
    const parts = [];
    for (const text of paragraphs) {
      const bytes = Buffer.byteLength(text, 'utf8');
      if (bytes > 5000) throw new Error(`paragraph over the 5000-byte limit: ${bytes}`);
      totalChars += text.length;
      const [res] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode: 'th-TH', name: voice },
        audioConfig: { audioEncoding: 'MP3' },
      });
      parts.push(Buffer.from(res.audioContent, 'base64'));
    }
    const safe = `${book}-${number}`.replace(/[^\w.-]/g, '_');
    writeFileSync(`${OUT}${voice}-${safe}.mp3`, Buffer.concat(parts));
    console.log(`ok  ${voice}  ${book} ${number}  (${paragraphs.length} paragraphs)`);
  }
}

console.log(`\ncharacters billed this run: ${totalChars}`);
console.log('compare against the Cloud console billing page to get the real per-character rate');
```

- [ ] **Step 3: Write the README**

Create `scripts/tts-pilot/README.md`:

```markdown
# Phase 2 pilot

Renders ten real sections through Google TTS so the engine and voice for
phase 3 can be chosen by listening, and so the first invoice gives us the
real per-character cost before committing to 6,770 files.

Throwaway: not imported by the app, not run in CI, output is gitignored.

## Run

    npm install -D @google-cloud/text-to-speech
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/tts-pilot/render.mjs

Output lands in `out/`, one file per voice per section.

## What to listen for

1. Naturalness against the Apple enhanced voice you hear in the app today.
2. Phrasing — section 420 has nine clause-separating spaces and is the hard
   case. Turning them into commas was tried on-device and made it choppy, so
   the engine has to phrase this from context or not at all.
3. Legal vocabulary: ทวิ, ฉ้อฉล, นิติกรรมอำพราง, and the section numbers.
4. Fatigue — play the longest file to the end. A voice that is pleasant for
   ten seconds and tiring for ten minutes is the wrong voice for 43 hours.
5. Section 968 must read "ร้อยละ เศษหนึ่งส่วนหก". If it says "หนึ่งทับหก",
   normalizeForSpeech has regressed.

## Cost

The script prints the characters it billed. Reconcile that against the Cloud
console. Free tier is 1M characters/month and the whole corpus is 1.16M, so
splitting the real render across two months costs nothing.
```

- [ ] **Step 4: Install the client and run the pilot**

```bash
npm install -D @google-cloud/text-to-speech
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/tts-pilot/render.mjs
```

Expected: 30 files in `scripts/tts-pilot/out/` and a printed character count.

If a voice name is rejected, list what the project actually has access to and substitute:

```bash
node -e "
const {TextToSpeechClient} = require('@google-cloud/text-to-speech');
new TextToSpeechClient().listVoices({languageCode:'th-TH'}).then(([r]) =>
  console.log(r.voices.map(v => v.name).join('\n')));
"
```

- [ ] **Step 5: Listen and decide**

Work through the five points in the README. Record in the spec's §10: the chosen engine, the chosen voice, the real per-character cost, and whether Gemini-TTS was worth its premium over Chirp 3 HD.

- [ ] **Step 6: Commit the script**

```bash
git add scripts/tts-pilot/render.mjs scripts/tts-pilot/README.md .gitignore package.json package-lock.json
git commit -m "chore: pilot script to choose the TTS engine and voice by ear

Renders ten real sections — the longest paragraph, a slash number, a Thai
ordinal, the s.968 fraction, and a few ordinary ones — through three
Chirp 3 HD voices. Google's demo cannot tell us how a voice handles a
1,352-character legal paragraph, whether it is still bearable an hour in,
or what the bill actually comes to.

Renders one paragraph per request, the same unit phase 3 will use, and
runs the text through normalizeForSpeech first, so what we judge is what
we would ship.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Update the spec with the decision**

In `docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md`, answer open questions 2 and 3 in §10 with the measured numbers, and record the chosen engine and voice in §11. Phase 3's plan cannot be written until this is done.

```bash
git add docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md
git commit -m "docs: record the pilot result — engine, voice, and real cost

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done when

- `npm test` passes: corpus checksums, `normalizeForSpeech` unit + corpus tests, `buildSectionItem`, voice cache, voice identity.
- iOS 1.0.4 (22) on TestFlight reads 193/30 and 172 ทวิ/1 with "ทับ", still reads 968 as a fraction, and switches to a newly installed Enhanced voice without a force-quit.
- Android versionCode 47 shows the same section-number fix and no regression.
- Open question 10 (`ฉ`) is answered in the spec.
- The pilot has produced a chosen engine, a chosen voice, and a real per-character cost, recorded in the spec.
