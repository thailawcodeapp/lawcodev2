# ธีม Wave — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มธีม Wave เป็นค่าเริ่มต้น โดยคงหน้าตาเดิมไว้เป็นธีม Classic
- หน้าแรกเปิดด้วยเวทีสีเข้ม เทพีจากไอคอนเป็นปุ่มเล่น แตะแล้วหูฟังลอยขึ้นไปสวมหัว
- ห้องสมุดเป็นคลื่นเสียงที่เติมสีตามที่ฟังแล้ว
- หน้าเลือกฟังมีชิปเลือกฉบับ คลื่นของฉบับ การ์ดสารบัญซูม และ popup โฟลเดอร์
- ปุ่มฟังต่อเล่นทั้งคิวที่ค้างไว้

**Architecture:**
- **สีและฟอนต์เป็นตัวแปร CSS** (`--c-*`, `--f-*`) Classic ตั้งค่าเดิมใน `:root` ส่วน Wave ทับค่าใน `html.theme-wave` (สว่าง) และ `html.theme-wave.dark` (มืด) หน้าที่ใช้ร่วมกันจึงเปลี่ยนธีมได้โดยไม่แตะ layout
- **หน้าแรกและหน้าเลือกฟังมี component ของ Wave เอง** (`WaveHome`, `WaveSelect`) โดย `App.jsx` เลือกตาม `settings.theme`
- **คณิตของคลื่น** (`lib/wave.js`), **คิวฟังต่อ** (`lib/resumeQueue.js`), **การใส่โฟลเดอร์** (`lib/folderPicker.js`) และ **การติ๊กมาตรา** (`lib/selection.js`) เป็นโมดูลล้วนที่มีเทสต์

**Tech Stack:** React 18.3, Vite, Tailwind 3.4, Vitest 2.1 (environment node), Capacitor 8, `@fontsource/anuphan@5.3.0`, `@fontsource/ibm-plex-sans-thai-looped@5.3.0`

**Spec:** `docs/superpowers/specs/2026-10-29-wave-theme-design.md`
**ต้นแบบอ้างอิง:** https://claude.ai/artifact/R26uNUctPLpaSHKaFoX4tU

## Global Constraints

- **ธีม:** ไม่มีค่า `settings.theme` หรือค่าไม่รู้จัก (รวม `'galaxy'`) → Wave, `'classic'` → Classic (spec 2.1)
- **โหมดสี:** `settings.waveMode` เป็น `'auto' | 'light' | 'dark'` ค่าเริ่มต้น `'auto'` ตาม `prefers-color-scheme` ส่วน `isDarkMode` ใช้กับ Classic เท่านั้นและห้ามแก้ (spec 2.1–2.2)
- **ลดการเคลื่อนไหว:** `settings.reduceMotion` ไม่มีค่า → ตาม `prefers-reduced-motion`
- **Classic ต้องหน้าตาเหมือนเดิมทุกพิกเซล** ทั้งโหมดสว่างและมืด (spec 2.3, 7.2)
- **ฟอนต์ Wave:** Anuphan สำหรับ `--f-display`, `--f-serif`, `--f-ui` และ IBM Plex Sans Thai Looped สำหรับ `--f-body` (เนื้อตัวบท)
- **แถบล่าง:** หน้าแรก · เลือกฟัง · สถิติ · บุ๊กมาร์ก · ตั้งค่า เหมือน Classic (spec 2.8)
- **ตัวเล่นเสียงบนหน้าแรก:** ในธีม Wave ที่ `/` ซ่อน `TtsPlayer` ยกเว้นตอนขึ้นข้อความโควตาหมด (spec 3.1)
- **คีย์ localStorage ใหม่:** `lawcode-th-resume`, `lawcode-th-folder-recent` ไม่มีอะไร sync ขึ้น cloud
- การสร้างโฟลเดอร์ยังเป็นฟีเจอร์ Pro
- ทุก commit อยู่บน branch `feat/wave-theme` และลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- รันเทสต์ทั้งหมดด้วย `npm test` (vitest run) และเทสต์เดี่ยวด้วย `npx vitest run <path>`
- ขั้นตอนที่เขียนว่า "ผู้ควบคุมงานทำ" ใช้ dev server จาก `.claude/launch.json` ชื่อ `dev` (port 5173) กับเครื่องมือ Browser preview

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `tailwind.config.js` | แก้ | สีและฟอนต์อ่านจากตัวแปร CSS |
| `src/index.css` | แก้ | token ของ Classic ใน `:root` |
| `src/styles/wave.css` | ใหม่ | token ของ Wave และสไตล์ทุกอย่างของ Wave (ขอบเขต `html.theme-wave` หรือคลาส `wv-*`) |
| `src/styles/themeTokens.test.js` | ใหม่ | token ครบทั้งสองธีม และไม่มีสี Classic ฝังในหน้าที่ใช้ร่วมกัน |
| `src/lib/theme.js` (+ test) | ใหม่ | ธีม, คลาสบน `<html>`, สี status bar, ลดการเคลื่อนไหว |
| `src/data/lawMeta.js` (+ `lawMeta.wave.test.js`) | แก้ | `shortLabel`, `waveColor` ต่อฉบับ |
| `src/lib/toast.js` (+ test), `src/components/ToastHost.jsx` | แก้ | toast มีปุ่ม action ได้ |
| `src/lib/resumeQueue.js` (+ test), `src/context/TtsContext.jsx` | ใหม่ / แก้ | คิวฟังต่อ |
| `src/lib/wave.js` (+ test) | ใหม่ | แท่งคลื่นของฉบับ แท่งคลื่นของคิว และเส้นทางสารบัญไปยังมาตรา |
| `src/lib/selection.js` (+ test), `src/hooks/useTocNavigation.js`, `useSectionSelection.js`, `useFolderPlayback.js`, `src/lib/toc.js` | ใหม่ / แก้ | logic หน้าเลือกฟังที่ Classic และ Wave ใช้ร่วมกัน |
| `src/lib/folderPicker.js` (+ test) | ใหม่ | ใส่หลายโฟลเดอร์ เลิกทำ และโฟลเดอร์ที่ใช้ล่าสุด |
| `src/assets/wave/*` | ใหม่ | ภาพเทพีและหูฟัง |
| `src/components/wave/*` | ใหม่ | `ThemisButton`, `WaveHero`, `FolderRow`, `WaveBars`, `WaveLibrary`, `ThemePicker`, `FolderPickerSheet`, `FoldersView` |
| `src/screens/WaveHome.jsx`, `WaveSelect.jsx` | ใหม่ | หน้าแรกและหน้าเลือกฟังของ Wave |
| `src/screens/SelectScreen.jsx` | แก้ | ใช้ hook ร่วม หน้าตาและการทำงานไม่เปลี่ยน |
| `src/App.jsx`, `src/main.jsx`, `index.html`, `capacitor.config.ts`, `src/components/TabBar.jsx`, `src/components/TtsPlayer.jsx`, `src/screens/SettingsScreen.jsx`, `src/screens/ReaderScreen.jsx` | แก้ | ต่อธีมเข้ากับแอป |

---

### Task 1: สีและฟอนต์เป็น token (Classic ไม่เปลี่ยน)

**Files:**
- Modify: `tailwind.config.js`, `src/index.css`
- Modify: `src/components/AppTour.jsx`, `src/components/TtsPlayer.jsx`, `src/screens/BookScreen.jsx`, `src/screens/ReaderScreen.jsx`, `src/screens/SearchScreen.jsx`, `src/screens/SettingsScreen.jsx`, `src/screens/StatsScreen.jsx`
- Test: `src/styles/themeTokens.test.js`

`HomeScreen.jsx` และ `SelectScreen.jsx` ไม่ต้องแปลงสี เพราะ Wave ใช้หน้าของตัวเองแทนสองหน้านี้ ส่วน `App.jsx` ยังใช้ hex เพราะเป็นค่าที่ส่งให้ status bar ของ native

**Interfaces:**
- Produces:
  - ตัวแปรสี `--c-paper`, `--c-paper-dk`, `--c-card`, `--c-ink`, `--c-ink-soft`, `--c-rule`, `--c-rule-soft`, `--c-accent`, `--c-ochre`, `--c-ink-2`, `--c-dark-bg`, `--c-dark-card` ค่าเป็นเลข RGB สามตัวคั่นช่องว่าง ใช้เป็น `rgb(var(--c-accent))` หรือ `rgb(var(--c-accent) / 0.1)`
  - ตัวแปรฟอนต์ `--f-display`, `--f-serif`, `--f-ui`, `--f-body`

- [ ] **Step 1: ถ่ายภาพ Classic ก่อนแก้ (ผู้ควบคุมงานทำ)**

ตั้ง `theme: 'classic'` ใน `lawcode-eng-settings` ผ่าน devtools แล้วถ่ายภาพที่ขนาด mobile ทั้งโหมดสว่างและโหมดมืด (สลับที่ ตั้งค่า › โหมดมืด) หน้า:
- `/`, `/#/select`, `/#/code/criminal`
- `/#/code/criminal/section/<id แรกของอาญา>`
- `/#/search`, `/#/stats`, `/#/bookmarks`, `/#/settings`

เก็บภาพไว้ใน scratchpad เพื่อเทียบใน Step 9 (ก่อนจบ Task 2 ยังไม่มีค่า `theme` แอปจึงยังเป็น Classic อยู่ดี)

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/styles/themeTokens.test.js`:

```js
// The two themes share every screen except Home and Select, so their colours
// and fonts live in CSS variables. These tests keep the variable sets complete
// and stop a Classic colour from being written straight into a shared screen.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// The declarations between `selector {` and the next `}`.
function block(css, selector) {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
}

const TOKENS = Object.values(config.theme.extend.colors).map(v => /--c-([\w-]+)/.exec(v)?.[1]);

const CLASSIC = {
  paper: '236 228 212', 'paper-dk': '216 205 180', card: '244 236 218', ink: '16 17 15',
  'ink-soft': '90 85 71', rule: '29 28 25', 'rule-soft': '189 177 154', accent: '169 50 37',
  ochre: '192 138 42', 'ink-2': '34 32 26', 'dark-bg': '15 14 12', 'dark-card': '26 25 20',
};

const SHARED = [
  'src/components/AppTour.jsx', 'src/components/TtsPlayer.jsx', 'src/screens/BookScreen.jsx',
  'src/screens/ReaderScreen.jsx', 'src/screens/SearchScreen.jsx', 'src/screens/SettingsScreen.jsx',
  'src/screens/StatsScreen.jsx',
];

describe('theme tokens', () => {
  it('every Tailwind colour reads a --c- variable', () => {
    expect(TOKENS).toHaveLength(Object.keys(CLASSIC).length);
    expect(TOKENS.every(Boolean)).toBe(true);
  });

  it('Classic keeps its exact colours and fonts', () => {
    const root = block(read('src/index.css'), ':root');
    for (const [name, rgb] of Object.entries(CLASSIC)) {
      expect(root).toContain(`--c-${name}: ${rgb};`);
    }
    expect(root).toContain("--f-display: 'Trirong', Georgia, serif;");
    expect(root).toContain("--f-ui: 'Sarabun', system-ui, sans-serif;");
    expect(root).toContain("--f-body: 'Trirong', Georgia, serif;");
  });

  it('shared screens hold no hard-coded Classic colour or face', () => {
    for (const f of SHARED) {
      expect(read(f), f).not.toMatch(/#a93225|#ece4d4|#bdb19a|rgba\(169, ?50, ?37/i);
    }
    expect(read('src/screens/ReaderScreen.jsx')).not.toContain("fontFamily: \"'Trirong'");
  });
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/styles/themeTokens.test.js`
Expected: FAIL ทั้งสามเทสต์

- [ ] **Step 4: เปลี่ยน `tailwind.config.js`**

แทน `colors` และ `fontFamily` ใน `theme.extend` ทั้งก้อนด้วย:

```js
      // Every colour is a CSS variable holding "R G B", so one class list
      // serves both themes: :root in index.css sets Classic, and
      // html.theme-wave in styles/wave.css overrides it. <alpha-value> keeps
      // modifiers such as bg-paper-dk/30 working.
      colors: {
        paper:       'rgb(var(--c-paper) / <alpha-value>)',
        'paper-dk':  'rgb(var(--c-paper-dk) / <alpha-value>)',
        card:        'rgb(var(--c-card) / <alpha-value>)',
        ink:         'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft':  'rgb(var(--c-ink-soft) / <alpha-value>)',
        rule:        'rgb(var(--c-rule) / <alpha-value>)',
        'rule-soft': 'rgb(var(--c-rule-soft) / <alpha-value>)',
        accent:      'rgb(var(--c-accent) / <alpha-value>)',
        ochre:       'rgb(var(--c-ochre) / <alpha-value>)',
        'ink-2':     'rgb(var(--c-ink-2) / <alpha-value>)',
        // dark mode surface
        'dark-bg':   'rgb(var(--c-dark-bg) / <alpha-value>)',
        'dark-card': 'rgb(var(--c-dark-card) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--f-display)'],
        serif:   ['var(--f-serif)'],
        ui:      ['var(--f-ui)'],
        body:    ['var(--f-body)'],
      },
```

- [ ] **Step 5: ตั้ง token ของ Classic ใน `src/index.css`**

ใน `@layer base` ที่บล็อก `:root {` เพิ่มเป็นบรรทัดแรกของบล็อก:

```css
    /* Theme tokens — Classic. Each colour holds "R G B" for Tailwind's
       rgb(var(--c-x) / <alpha-value>); styles/wave.css overrides them. */
    --c-paper: 236 228 212;
    --c-paper-dk: 216 205 180;
    --c-card: 244 236 218;
    --c-ink: 16 17 15;
    --c-ink-soft: 90 85 71;
    --c-rule: 29 28 25;
    --c-rule-soft: 189 177 154;
    --c-accent: 169 50 37;
    --c-ochre: 192 138 42;
    --c-ink-2: 34 32 26;
    --c-dark-bg: 15 14 12;
    --c-dark-card: 26 25 20;
    --f-display: 'Trirong', Georgia, serif;
    --f-serif: 'Trirong', Georgia, serif;
    --f-ui: 'Sarabun', system-ui, sans-serif;
    /* The statute text in the reader. */
    --f-body: 'Trirong', Georgia, serif;
```

แล้วเปลี่ยนสีพื้นที่เขียนตายตัวในไฟล์เดียวกัน:

```bash
sed -i 's/background: #ece4d4;/background: rgb(var(--c-paper));/g; s/background: #d8cdb4;/background: rgb(var(--c-paper-dk));/g; s/background: #0f0e0c;/background: rgb(var(--c-dark-bg));/g' src/index.css
grep -n "background: #" src/index.css
```

Expected: grep ไม่พบบรรทัด `background: #…` เหลือ

- [ ] **Step 6: แปลงสีและฟอนต์ในหน้าที่ใช้ร่วมกัน**

```bash
FILES="src/components/AppTour.jsx src/components/TtsPlayer.jsx src/screens/BookScreen.jsx src/screens/ReaderScreen.jsx src/screens/SearchScreen.jsx src/screens/SettingsScreen.jsx src/screens/StatsScreen.jsx"
sed -i "s/'#a93225'/'rgb(var(--c-accent))'/g; s/'#ece4d4'/'rgb(var(--c-paper))'/g; s/'#bdb19a'/'rgb(var(--c-rule-soft))'/g" $FILES
grep -n "#a93225\|#ece4d4\|#bdb19a\|rgba(169" $FILES
```

grep จะเหลือ 3 จุดที่ต้องแก้ด้วยมือ:
- `src/components/TtsPlayer.jsx` (ราวบรรทัด 401): `'rgba(169,50,37,0.10)'` → `'rgb(var(--c-accent) / 0.10)'`
- `src/components/TtsPlayer.jsx` (ราวบรรทัด 413): `<svg width="16" height="16" viewBox="0 0 24 24" fill="#a93225">` → `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-accent">` (attribute ของ SVG อ่าน `var()` ไม่ได้)
- `src/screens/SearchScreen.jsx` (ราวบรรทัด 154): `'2px solid #a93225'` → `'2px solid rgb(var(--c-accent))'`

ถ้าเจอจุดอื่นนอกเหนือจากนี้ ใช้หลักเดียวกัน: ค่าใน `style` เขียน `rgb(var(--c-…))` ส่วน attribute ของ SVG เปลี่ยนเป็น `currentColor` คู่กับคลาส `text-…`

ใน `src/screens/ReaderScreen.jsx` (ราวบรรทัด 420) เปลี่ยน:

```jsx
            style={{ fontFamily: "'Trirong', Georgia, serif", fontSize: bodyFontSize, lineHeight: 1.7, textAlign: 'left' }}
```

เป็น:

```jsx
            style={{ fontFamily: 'var(--f-body)', fontSize: bodyFontSize, lineHeight: 1.7, textAlign: 'left' }}
```

- [ ] **Step 7: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/styles/themeTokens.test.js`
Expected: PASS 3 tests

- [ ] **Step 8: รันเทสต์ทั้งหมดและ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 9: เทียบภาพ Classic (ผู้ควบคุมงานทำ)**

ถ่ายภาพ 8 หน้า × 2 โหมดเหมือน Step 1 แล้วเทียบ ต้องเหมือนกัน

- [ ] **Step 10: Commit**

```bash
git add tailwind.config.js src/index.css src/styles/themeTokens.test.js src/components/AppTour.jsx src/components/TtsPlayer.jsx src/screens/BookScreen.jsx src/screens/ReaderScreen.jsx src/screens/SearchScreen.jsx src/screens/SettingsScreen.jsx src/screens/StatsScreen.jsx
git commit -m "refactor(theme): colours and fonts as CSS variables, Classic unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ฐานของธีม Wave

**Files:**
- Create: `src/lib/theme.js`, `src/lib/theme.test.js`, `src/styles/wave.css`, `src/data/lawMeta.wave.test.js`
- Modify: `src/data/lawMeta.js`, `src/styles/themeTokens.test.js`, `src/main.jsx`, `index.html`, `src/App.jsx`, `capacitor.config.ts`, `src/components/TabBar.jsx`, `package.json`

**Interfaces:**
- Consumes: ตัวแปร `--c-*`, `--f-*` จาก Task 1
- Produces (`src/lib/theme.js`):
  - `resolveTheme(settings) → 'classic' | 'wave'`
  - `resolveWaveMode(settings) → 'auto' | 'light' | 'dark'`
  - `systemPrefersDark() → boolean`
  - `htmlClasses(settings, systemDark) → { wave: boolean, dark: boolean }`
  - `statusBarColors(settings, systemDark) → { color: string, dark: boolean }`
  - `resolveReduceMotion(settings) → boolean`
- Produces (`lawMeta.js`): ทุก meta มี `shortLabel: string`, `waveColor: '#RRGGBB'`
- Produces (CSS): `html.theme-wave`, `html.theme-wave.dark`, ตัวแปร `--w-track`, `--w-golds`, `--w-shadow`, คลาส `.wv-tabbar`, `.wv-tab-on`, `.wv-tab-pill`

- [ ] **Step 1: เขียนเทสต์ของ `theme.js`**

สร้าง `src/lib/theme.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { resolveTheme, resolveWaveMode, htmlClasses, statusBarColors, resolveReduceMotion } from './theme.js';

describe('theme', () => {
  it('defaults to Wave; keeps a saved Classic; anything else is Wave', () => {
    expect(resolveTheme({})).toBe('wave');
    expect(resolveTheme(undefined)).toBe('wave');
    expect(resolveTheme({ theme: 'classic' })).toBe('classic');
    expect(resolveTheme({ theme: 'galaxy' })).toBe('wave');
  });

  it('Wave mode defaults to auto', () => {
    expect(resolveWaveMode({})).toBe('auto');
    expect(resolveWaveMode({ waveMode: 'dark' })).toBe('dark');
    expect(resolveWaveMode({ waveMode: 'nonsense' })).toBe('auto');
  });

  it('Wave is dark when chosen, or when auto and the device is dark', () => {
    expect(htmlClasses({}, false)).toEqual({ wave: true, dark: false });
    expect(htmlClasses({}, true)).toEqual({ wave: true, dark: true });
    expect(htmlClasses({ waveMode: 'light' }, true)).toEqual({ wave: true, dark: false });
    expect(htmlClasses({ waveMode: 'dark' }, false)).toEqual({ wave: true, dark: true });
  });

  it('Classic follows isDarkMode and ignores the device', () => {
    expect(htmlClasses({ theme: 'classic', isDarkMode: false }, true)).toEqual({ wave: false, dark: false });
    expect(htmlClasses({ theme: 'classic', isDarkMode: true }, false)).toEqual({ wave: false, dark: true });
    expect(htmlClasses({ theme: 'classic', isDarkMode: false, waveMode: 'dark' }, true)).toEqual({ wave: false, dark: false });
  });

  it('status bar colours', () => {
    expect(statusBarColors({}, false)).toEqual({ color: '#F4F2EE', dark: false });
    expect(statusBarColors({}, true)).toEqual({ color: '#131211', dark: true });
    expect(statusBarColors({ theme: 'classic', isDarkMode: true }, false)).toEqual({ color: '#0f0e0c', dark: true });
    expect(statusBarColors({ theme: 'classic' }, true)).toEqual({ color: '#ece4d4', dark: false });
  });

  it('reduce motion: explicit setting wins, else the device', () => {
    expect(resolveReduceMotion({ reduceMotion: true })).toBe(true);
    expect(resolveReduceMotion({ reduceMotion: false })).toBe(false);
    expect(resolveReduceMotion({})).toBe(false); // no window.matchMedia under node
  });
});
```

- [ ] **Step 2: เขียนเทสต์ของ `lawMeta`**

สร้าง `src/data/lawMeta.wave.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { LAW_BOOKS_META } from './lawMeta.js';

describe('Wave labels and colours', () => {
  it('has the short labels from the spec, in book order', () => {
    expect(LAW_BOOKS_META.map(m => m.shortLabel)).toEqual([
      'แพ่ง', 'อาญา', 'วิแพ่ง', 'วิอาญา', 'รัฐธรรมนูญ', 'พระธรรมนูญ', 'แรงงาน',
      'ศาลแขวง', 'ศาลปกครอง', 'ล้มละลาย', 'ลิขสิทธิ์', 'ผู้บริโภค', 'ศาลเยาวชน',
    ]);
  });

  it('gives every book its own colour', () => {
    const colours = LAW_BOOKS_META.map(m => m.waveColor);
    expect(colours.every(c => /^#[0-9A-F]{6}$/.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
```

- [ ] **Step 3: เพิ่มเทสต์ token ของ Wave**

ใน `src/styles/themeTokens.test.js` เพิ่มใน `describe` เดิม:

```js
  it('Wave overrides every token in both modes, and every font in light', () => {
    const css = read('src/styles/wave.css');
    const light = block(css, 'html.theme-wave');
    const dark = block(css, 'html.theme-wave.dark');
    for (const name of Object.keys(CLASSIC)) {
      expect(light, `light ${name}`).toMatch(new RegExp(`--c-${name}: \\d+ \\d+ \\d+;`));
      expect(dark, `dark ${name}`).toMatch(new RegExp(`--c-${name}: \\d+ \\d+ \\d+;`));
    }
    for (const f of ['display', 'serif', 'ui']) {
      expect(light).toContain(`--f-${f}: 'Anuphan', 'IBM Plex Sans Thai', system-ui, sans-serif;`);
    }
    expect(light).toContain("--f-body: 'IBM Plex Sans Thai Looped', 'Anuphan', system-ui, sans-serif;");
  });
```

- [ ] **Step 4: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/theme.test.js src/data/lawMeta.wave.test.js src/styles/themeTokens.test.js`
Expected: FAIL (ไม่มี `./theme.js`, `shortLabel` เป็น `undefined`, ไม่มี `wave.css`)

- [ ] **Step 5: เขียน `src/lib/theme.js`**

```js
// Which theme is on, and what follows from it. Classic is today's look; Wave
// is the default for everyone, existing users included (spec 2.1). Settings
// live in AppContext's `lawcode-eng-settings`.

export function resolveTheme(settings) {
  return settings?.theme === 'classic' ? 'classic' : 'wave';
}

export function resolveWaveMode(settings) {
  const m = settings?.waveMode;
  return m === 'light' || m === 'dark' ? m : 'auto';
}

export function systemPrefersDark() {
  try {
    return !!window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

// Wave's dark mode rides on the same `dark` class Classic uses, so every
// screen's dark: classes apply and wave.css only has to recolour them
// (spec 2.2). isDarkMode belongs to Classic and is never touched here.
export function htmlClasses(settings, systemDark) {
  if (resolveTheme(settings) === 'classic') return { wave: false, dark: !!settings?.isDarkMode };
  const mode = resolveWaveMode(settings);
  return { wave: true, dark: mode === 'dark' || (mode === 'auto' && !!systemDark) };
}

export function statusBarColors(settings, systemDark) {
  const { wave, dark } = htmlClasses(settings, systemDark);
  if (wave) return dark ? { color: '#131211', dark: true } : { color: '#F4F2EE', dark: false };
  return dark ? { color: '#0f0e0c', dark: true } : { color: '#ece4d4', dark: false };
}

// Unset follows the device's own reduce-motion setting.
export function resolveReduceMotion(settings) {
  if (typeof settings?.reduceMotion === 'boolean') return settings.reduceMotion;
  try {
    return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: เพิ่ม `shortLabel` และ `waveColor` ใน `src/data/lawMeta.js`**

ในแต่ละ entry ของ `LAW_BOOKS_META` เพิ่มสองบรรทัดต่อจากบรรทัด `shortName:` ของ entry นั้น

| `id` | เพิ่ม |
|---|---|
| `civil` | `shortLabel: 'แพ่ง',` `waveColor: '#3D6FB6',` |
| `criminal` | `shortLabel: 'อาญา',` `waveColor: '#C24A3A',` |
| `civil_proc` | `shortLabel: 'วิแพ่ง',` `waveColor: '#2F8A5B',` |
| `criminal_proc` | `shortLabel: 'วิอาญา',` `waveColor: '#7B55B8',` |
| `constitution` | `shortLabel: 'รัฐธรรมนูญ',` `waveColor: '#C99232',` |
| `court_org` | `shortLabel: 'พระธรรมนูญ',` `waveColor: '#4E7FA8',` |
| `labour_protection` | `shortLabel: 'แรงงาน',` `waveColor: '#2E9C8E',` |
| `district_court` | `shortLabel: 'ศาลแขวง',` `waveColor: '#B0577D',` |
| `admin_court` | `shortLabel: 'ศาลปกครอง',` `waveColor: '#7F8F3A',` |
| `bankruptcy` | `shortLabel: 'ล้มละลาย',` `waveColor: '#A06B45',` |
| `copyright` | `shortLabel: 'ลิขสิทธิ์',` `waveColor: '#3E95C2',` |
| `consumer_proc` | `shortLabel: 'ผู้บริโภค',` `waveColor: '#D07A48',` |
| `juvenile_court` | `shortLabel: 'ศาลเยาวชน',` `waveColor: '#A876C4',` |

entry แรกมี comment กำกับ:

```js
  {
    id: 'civil',
    shortName: 'แพ่งและพาณิชย์',
    // Wave theme: the label on chips and the waveform's colour.
    shortLabel: 'แพ่ง',
    waveColor: '#3D6FB6',
    abbr: 'พ.พ.',
```

- [ ] **Step 7: ติดตั้งฟอนต์**

```bash
npm install @fontsource/anuphan@5.3.0 @fontsource/ibm-plex-sans-thai-looped@5.3.0
```

- [ ] **Step 8: สร้าง `src/styles/wave.css`**

```css
/* Wave theme. Imported after index.css (see main.jsx), so a rule here beats
   an index.css rule of equal specificity. Everything is scoped to
   html.theme-wave or to wv-* classes that only Wave screens render, so
   Classic never matches anything in this file. */

/* ── Tokens: light ──────────────────────────────────────────────────────── */
html.theme-wave {
  --c-paper: 244 242 238;
  --c-paper-dk: 233 228 217;
  --c-card: 255 255 255;
  --c-ink: 27 26 23;
  --c-ink-soft: 107 103 94;
  --c-rule: 230 225 215;
  --c-rule-soft: 214 207 194;
  --c-accent: 138 95 18;
  --c-ochre: 217 164 65;
  --c-ink-2: 34 32 26;
  --c-dark-bg: 19 18 17;
  --c-dark-card: 30 28 26;
  --f-display: 'Anuphan', 'IBM Plex Sans Thai', system-ui, sans-serif;
  --f-serif: 'Anuphan', 'IBM Plex Sans Thai', system-ui, sans-serif;
  --f-ui: 'Anuphan', 'IBM Plex Sans Thai', system-ui, sans-serif;
  --f-body: 'IBM Plex Sans Thai Looped', 'Anuphan', system-ui, sans-serif;
  --w-track: #E9E4D9;
  --w-golds: #F4E7CB;
  --w-shadow: 0 1px 2px rgba(40, 30, 10, 0.06), 0 6px 18px rgba(40, 30, 10, 0.07);
  --tap-row-bg: rgba(217, 164, 65, 0.16);
  --rule-hair: #E6E1D7;
  --rule-strong: #CFC8BA;
  --row-alt: rgba(0, 0, 0, 0.02);
}

/* ── Tokens: dark ───────────────────────────────────────────────────────── */
/* In the dark, screens use their dark: classes: paper is the main text,
   rule-soft the secondary text, ink-soft the hairlines, dark-bg the page. */
html.theme-wave.dark {
  --c-paper: 241 237 230;
  --c-paper-dk: 47 44 40;
  --c-card: 30 28 26;
  --c-ink: 19 18 17;
  --c-ink-soft: 45 42 38;
  --c-rule: 45 42 38;
  --c-rule-soft: 165 158 146;
  --c-accent: 233 190 100;
  --c-ochre: 226 176 78;
  --c-ink-2: 241 237 230;
  --c-dark-bg: 19 18 17;
  --c-dark-card: 30 28 26;
  --w-track: #2F2C28;
  --w-golds: #3A2F19;
  --w-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 18px rgba(0, 0, 0, 0.35);
  --tap-row-bg: rgba(226, 176, 78, 0.16);
  --rule-hair: #2D2A26;
  --rule-strong: #4A463F;
  --row-alt: rgba(255, 255, 255, 0.03);
}

/* body and the frame round the phone shell read --c-paper, which in the dark
   is the text colour. */
html.theme-wave.dark body,
html.theme-wave.dark #root { background: rgb(var(--c-dark-bg)); }

/* Anuphan has no italic face; the browser would only slant it. */
html.theme-wave .italic { font-style: normal; }

/* Button fills written bg-accent use the bright gold: accent is the dark
   gold meant for text in light mode. Text on any gold fill is dark. */
html.theme-wave .bg-accent { background-color: rgb(var(--c-ochre)); }
html.theme-wave .bg-accent,
html.theme-wave .bg-ochre { --c-paper: 29 20 4; }

/* The two-pixel header rules become hairlines. */
html.theme-wave .border-b-2 { border-bottom-width: 1px; border-bottom-color: rgb(var(--c-rule)); }
html.theme-wave .dark\:border-paper { border-color: rgb(var(--c-rule)); }

/* ── Tab bar ────────────────────────────────────────────────────────────── */
.wv-tabbar { background: rgb(var(--c-card)); border-top: 1px solid rgb(var(--c-rule)); }
.wv-tab-on { color: rgb(var(--c-accent)); font-weight: 700; }
.wv-tab-pill { display: grid; place-items: center; border-radius: 12px; padding: 1px 14px; }
.wv-tab-on .wv-tab-pill { background: var(--w-golds); }
```

- [ ] **Step 9: import ฟอนต์และ CSS ใน `src/main.jsx`**

แทน `import './index.css';` ด้วย:

```js
import './index.css';
// Wave's fonts, bundled so they work offline (spec 2.5). Classic never uses
// these families, so the browser never downloads the files there.
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/anuphan/700.css';
import '@fontsource/ibm-plex-sans-thai-looped/400.css';
import '@fontsource/ibm-plex-sans-thai-looped/500.css';
import './styles/wave.css';
```

- [ ] **Step 10: ติดคลาสตั้งแต่เฟรมแรกใน `index.html`**

เพิ่มใน `<head>` ก่อน `<link rel="preconnect"` แรก:

```html
    <!-- Wave must have its colours from the first frame, before React loads.
         Same rules as lib/theme.js: no saved theme means Wave, and Wave's
         "auto" mode follows the device. -->
    <script>
      (function () {
        var s = {};
        try { s = JSON.parse(localStorage.getItem('lawcode-eng-settings') || '{}') || {}; } catch (e) {}
        if (s.theme === 'classic') return;
        var mode = s.waveMode === 'light' || s.waveMode === 'dark' ? s.waveMode : 'auto';
        var sys = false;
        try { sys = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
        document.documentElement.classList.add('theme-wave');
        if (mode === 'dark' || (mode === 'auto' && sys)) document.documentElement.classList.add('dark');
      })();
    </script>
```

- [ ] **Step 11: ต่อคลาสและ status bar ใน `src/App.jsx`**

เปลี่ยน import ของ React เป็น `import { useEffect, useState } from 'react';` (ถ้ายังไม่มี `useState`) แล้วเพิ่ม:

```js
import { htmlClasses, statusBarColors, systemPrefersDark } from './lib/theme';
```

ใน `ThemeWrapper` ต่อจาก `const { isPro: proAccessIsPro } = useProAccess();` เพิ่ม:

```js
  // Wave's "auto" mode follows the device, live.
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
```

แทน effect นี้:

```js
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.isDarkMode);
  }, [settings.isDarkMode]);
```

ด้วย:

```js
  useEffect(() => {
    const { wave, dark } = htmlClasses(settings, systemDark);
    document.documentElement.classList.toggle('theme-wave', wave);
    document.documentElement.classList.toggle('dark', dark);
  }, [settings.theme, settings.waveMode, settings.isDarkMode, systemDark]); // eslint-disable-line react-hooks/exhaustive-deps
```

และแทน effect ของ status bar:

```js
  useEffect(() => {
    if (!isNative()) return;
    const bg = settings.isDarkMode ? '#0f0e0c' : '#ece4d4';
    StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
    StatusBar.setStyle({ style: settings.isDarkMode ? Style.Dark : Style.Light }).catch(() => {});
  }, [settings.isDarkMode]);
```

ด้วย:

```js
  useEffect(() => {
    if (!isNative()) return;
    const { color, dark } = statusBarColors(settings, systemDark);
    StatusBar.setBackgroundColor({ color }).catch(() => {});
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  }, [settings.theme, settings.waveMode, settings.isDarkMode, systemDark]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 12: สี splash ใน `capacitor.config.ts`**

ใน `SplashScreen` เปลี่ยน `backgroundColor: '#ece4d4'` เป็น `backgroundColor: '#131211'` แล้วเพิ่ม comment เหนือ `SplashScreen`:

```ts
    // Dark so Wave's dark mode never flashes bright on launch (spec 2.6);
    // Wave light and Classic see this for a moment before the app paints.
```

`StatusBar` ใน config ไม่ต้องแก้ เพราะ `App.jsx` ตั้งสีจริงทันทีที่เปิดแอป

- [ ] **Step 13: แถบล่างของ Wave ใน `src/components/TabBar.jsx`**

เพิ่ม import:

```js
import { useApp } from '../context/AppContext';
import { resolveTheme } from '../lib/theme';
```

ในฟังก์ชัน `TabBar` เปลี่ยน:

```js
  const playerShowing = playing || paused || quotaBlocked;
```

เป็น:

```js
  // Wave keeps the same five tabs (spec 2.8): no inverted fill, the active
  // icon sits in a pale-gold capsule.
  const { settings } = useApp();
  const wave = resolveTheme(settings) === 'wave';
  // On Wave's Home the hero is the player, so the bar is hidden there unless
  // it is showing the quota prompt (see TtsPlayer).
  const playerShowing = wave && pathname === '/'
    ? quotaBlocked
    : playing || paused || quotaBlocked;
```

เปลี่ยน `<div className="border-t-2 border-rule bg-paper dark:bg-dark-bg dark:border-ink-soft flex-shrink-0">` เป็น:

```jsx
      <div className={wave ? 'wv-tabbar flex-shrink-0' : 'border-t-2 border-rule bg-paper dark:bg-dark-bg dark:border-ink-soft flex-shrink-0'}>
```

เปลี่ยน `className` ของปุ่ม:

```jsx
              className={[
                // tap-btn (not tap-row): the active tab is bg-ink in light mode,
                // where a background flash would be invisible against it.
                'tap-btn flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors',
                !wave && i < TABS.length - 1 ? 'border-r border-rule-soft dark:border-ink-soft' : '',
                wave
                  ? (active ? 'wv-tab-on' : 'text-ink-soft dark:text-rule-soft')
                  : active
                    ? 'bg-ink dark:bg-paper text-paper dark:text-ink'
                    : 'bg-transparent text-ink dark:text-paper',
              ].join(' ')}
```

เปลี่ยน `<span className={active ? '' : 'opacity-70'}>{tab.icon}</span>` เป็น:

```jsx
              <span className={wave ? 'wv-tab-pill' : active ? '' : 'opacity-70'}>{tab.icon}</span>
```

และ `style` ของ `<span>` ชื่อแท็บ:

```jsx
                style={{ fontStyle: active && !wave ? 'italic' : 'normal', fontWeight: active ? 600 : 400 }}
```

- [ ] **Step 14: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/theme.test.js src/data/lawMeta.wave.test.js src/styles/themeTokens.test.js`
Expected: PASS ทั้งหมด

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 15: ตรวจด้วยตา (ผู้ควบคุมงานทำ)**

ล้าง localStorage แล้วรีโหลด:
- **โหมดสว่างของเครื่อง:** พื้นโทนงาช้าง ตัวอักษรเข้ม ฟอนต์ Anuphan แท็บที่เลือกเป็นแคปซูลทองอ่อน
- **โหมดมืดของเครื่อง** (`resize_window` `colorScheme: 'dark'`): พื้น `#131211` ตัวอักษรสว่าง ไม่มีแถบสีกระดาษ
- หน้าแรกกับหน้าเลือกฟังยังเป็น layout ของ Classic ในสีใหม่ จนกว่าจะถึง Task 9 และ Task 11
- ตั้ง `theme: 'classic'` แล้วรีโหลด ต้องได้ Classic เหมือนภาพใน Task 1

- [ ] **Step 16: Commit**

```bash
git add src/lib/theme.js src/lib/theme.test.js src/data/lawMeta.js src/data/lawMeta.wave.test.js src/styles/wave.css src/styles/themeTokens.test.js src/main.jsx index.html src/App.jsx capacitor.config.ts src/components/TabBar.jsx package.json package-lock.json
git commit -m "feat(theme): Wave theme base — tokens for light and dark, fonts, tab bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: หน้าตั้งค่า — ธีม โหมดสี ลดการเคลื่อนไหว

**Files:**
- Create: `src/components/wave/ThemePicker.jsx`
- Copy: `store-assets/hero/processed/themis-base.jpg` → `src/assets/wave/themis-base.jpg` (ใช้เป็นภาพตัวอย่างของ Wave และใช้ต่อใน Task 8)
- Modify: `src/screens/SettingsScreen.jsx`, `src/styles/wave.css`

**Interfaces:**
- Consumes: `resolveTheme`, `resolveWaveMode`, `resolveReduceMotion` (Task 2); `Group`, `Row`, `toggle` ที่มีอยู่แล้วใน `SettingsScreen.jsx`
- Produces: `<ThemePicker value onChange />`

- [ ] **Step 1: คัดลอกภาพเทพี**

`store-assets/` อยู่ใน `.gitignore` จึงต้องคัดลอกภาพเข้า `src/assets/wave/` (ภาพหูฟังและภาพสวมหูฟังคัดลอกใน Task 8)

```bash
mkdir -p src/assets/wave
cp store-assets/hero/processed/themis-base.jpg src/assets/wave/
```

- [ ] **Step 2: สร้าง `src/components/wave/ThemePicker.jsx`**

```jsx
// Settings › ธีม: two preview cards, Classic and Wave. Switching takes effect
// at once — App.jsx re-renders the routes from settings.theme.
import themisBase from '../../assets/wave/themis-base.jpg';

const OPTIONS = [
  { id: 'classic', label: 'Classic' },
  { id: 'wave', label: 'Wave' },
];

export default function ThemePicker({ value, onChange }) {
  return (
    <div className="my-3">
      <div className="font-display text-[17px] font-medium mb-2">ธีม</div>
      <div className="flex gap-3">
        {OPTIONS.map(o => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              className={`tap-btn flex-1 rounded-xl p-2 text-center ${on ? 'border-2 border-accent' : 'border border-rule-soft dark:border-ink-soft'}`}
            >
              <div className={`theme-preview theme-preview-${o.id}`} aria-hidden="true">
                {o.id === 'wave' && <img src={themisBase} alt="" />}
              </div>
              <div className="font-ui text-[12px] mt-1.5">{o.label}{on ? ' ✓' : ''}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: สไตล์ภาพตัวอย่างใน `src/styles/wave.css`**

ต่อท้ายไฟล์:

```css
/* ── Settings ───────────────────────────────────────────────────────────── */
/* The theme previews are drawn in both themes, so they are not scoped. */
.theme-preview { height: 82px; border-radius: 9px; position: relative; overflow: hidden; }
.theme-preview-classic { background: #ece4d4; }
.theme-preview-classic::before {
  content: 'ประมวลกฎหมาย'; position: absolute; left: 8px; top: 8px;
  font: 500 12px 'Trirong', Georgia, serif; color: #10110f;
}
.theme-preview-classic::after {
  content: ''; position: absolute; left: 8px; right: 8px; top: 32px; height: 1px;
  background: #1d1c19; box-shadow: 0 14px 0 #1d1c19, 0 28px 0 #1d1c19;
}
.theme-preview-wave { background: radial-gradient(120% 90% at 22% 0%, #2B2519 0%, #15130F 48%, #0C0B09 100%); }
.theme-preview-wave img { position: absolute; left: 8px; top: 8px; width: 66px; height: 66px; border-radius: 14px; object-fit: cover; }
.theme-preview-wave::after {
  content: ''; position: absolute; left: 84px; right: 8px; bottom: 12px; height: 18px;
  background: repeating-linear-gradient(90deg, #E2B04E 0 4px, transparent 4px 7px);
  -webkit-mask: linear-gradient(0deg, #000 40%, rgba(0, 0, 0, 0.5)); mask: linear-gradient(0deg, #000 40%, rgba(0, 0, 0, 0.5));
}
.wv-seg { display: inline-flex; padding: 3px; border-radius: 12px; background: rgb(var(--c-paper-dk)); gap: 2px; }
.wv-seg button { padding: 6px 12px; border-radius: 9px; font: 600 12.5px var(--f-ui); color: rgb(var(--c-ink-soft)); }
html.dark .wv-seg button { color: rgb(var(--c-rule-soft)); }
.wv-seg button[aria-pressed='true'] { background: rgb(var(--c-card)); color: rgb(var(--c-accent)); box-shadow: var(--w-shadow); }
```

- [ ] **Step 4: ต่อเข้า `src/screens/SettingsScreen.jsx`**

เพิ่ม import:

```js
import ThemePicker from '../components/wave/ThemePicker';
import { resolveTheme, resolveWaveMode, resolveReduceMotion } from '../lib/theme';
```

ใน `SettingsScreen` ต่อจากบรรทัดที่ดึง `settings` / `setSettings` จาก `useApp()` เพิ่ม:

```js
  const wave = resolveTheme(settings) === 'wave';
  const waveMode = resolveWaveMode(settings);
```

ใน `<div className="px-5">` ก่อน comment `{/* Pro subscription card — monthly / quarterly / yearly plans */}` แทรก:

```jsx
          <ThemePicker
            value={resolveTheme(settings)}
            onChange={(theme) => setSettings(s => ({ ...s, theme }))}
          />

          {wave && (
            <Group title="Wave">
              <div className="flex items-center justify-between py-2.5 pl-4" style={{ borderTop: '1px dotted var(--rule-hair)' }}>
                <div className="font-serif text-[14px] text-ink dark:text-paper">โหมดสี</div>
                <div className="wv-seg" role="group" aria-label="โหมดสี">
                  {[['auto', 'ตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={waveMode === id}
                      onClick={() => setSettings(s => ({ ...s, waveMode: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Row
                label="ลดการเคลื่อนไหว"
                toggle={resolveReduceMotion(settings)}
                onToggle={() => setSettings(s => ({ ...s, reduceMotion: !resolveReduceMotion(s) }))}
              />
            </Group>
          )}
```

เปลี่ยนแถวโหมดมืด:

```jsx
            <Row label="โหมดมืด" toggle={settings.isDarkMode} onToggle={() => toggle('isDarkMode')} />
```

เป็น:

```jsx
            {/* Wave has its own three-way mode above; this switch is Classic's. */}
            {!wave && (
              <Row label="โหมดมืด" toggle={settings.isDarkMode} onToggle={() => toggle('isDarkMode')} />
            )}
```

- [ ] **Step 5: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 6: ตรวจด้วยตา (ผู้ควบคุมงานทำ)**

หน้าตั้งค่า:
- การ์ด Classic / Wave อยู่บนสุด แตะสลับแล้วทั้งแอปเปลี่ยนทันที
- ตอนใช้ Wave มีกลุ่ม "Wave" ที่มีโหมดสีสามตัวเลือก (เปลี่ยนแล้วสีเปลี่ยนทันที) และสวิตช์ลดการเคลื่อนไหว ส่วนแถวโหมดมืดซ่อนอยู่
- ตอนใช้ Classic แถวโหมดมืดกลับมา และกลุ่ม Wave หายไป

- [ ] **Step 7: Commit**

```bash
git add src/components/wave/ThemePicker.jsx src/assets/wave/themis-base.jpg src/screens/SettingsScreen.jsx src/styles/wave.css
git commit -m "feat(settings): theme picker, Wave colour mode and reduce motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: toast มีปุ่ม action

**Files:**
- Modify: `src/lib/toast.js`, `src/components/ToastHost.jsx`
- Test: `src/lib/toast.test.js`

**Interfaces:**
- Produces: `showToast(message, options?)` โดย `options = { action: { label: string, onPress: () => void } }` และ listener ได้ `(message, options)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/toast.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { showToast, subscribeToast } from './toast.js';

describe('toast', () => {
  it('a plain call still delivers just the message', () => {
    const got = [];
    const off = subscribeToast((...args) => got.push(args));
    showToast('สวัสดี');
    off();
    expect(got).toEqual([['สวัสดี', undefined]]);
  });

  it('passes an action through', () => {
    const got = [];
    const off = subscribeToast((m, o) => got.push(o?.action?.label));
    showToast('เพิ่มแล้ว', { action: { label: 'เลิกทำ', onPress: () => {} } });
    off();
    expect(got).toEqual(['เลิกทำ']);
  });

  it('ignores an empty message', () => {
    let calls = 0;
    const off = subscribeToast(() => { calls++; });
    showToast('');
    off();
    expect(calls).toBe(0);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/toast.test.js`
Expected: FAIL ที่เทสต์แรก (ได้ `[['สวัสดี']]`) และเทสต์ที่สอง (ได้ `[undefined]`)

- [ ] **Step 3: แก้ `showToast` ใน `src/lib/toast.js`**

```js
/**
 * Show a message. Safe to call from anywhere, including outside React.
 * `options.action` ({ label, onPress }) adds one button, e.g. undo.
 */
export function showToast(message, options) {
  if (!message) return;
  for (const fn of listeners) fn(message, options);
}
```

- [ ] **Step 4: แสดงปุ่มใน `src/components/ToastHost.jsx`**

แทนทั้งฟังก์ชัน `ToastHost` คง import และค่าคงที่เดิมไว้ แล้วเพิ่ม `ACTION_MS`:

```jsx
const ACTION_MS = 4000; // long enough to reach for "เลิกทำ"

export default function ToastHost() {
  const { playing, paused } = useTts();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const off = subscribeToast((msg, options) => {
      setToast({ msg, action: options?.action ?? null });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), options?.action ? ACTION_MS : VISIBLE_MS);
    });
    return () => { off(); clearTimeout(timer); };
  }, []);

  if (!toast) return null;

  // Measured from .phone-shell, which already starts above the gesture bar —
  // see the note on bottom offsets in TtsPlayer.
  const bottom = playing || paused ? ABOVE_PLAYER : ABOVE_TAB_BAR;

  return (
    <div
      className="fixed left-0 right-0 z-50 px-6 flex justify-center pointer-events-none"
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-2.5 max-w-full flex items-center gap-3">
        <div className="font-ui text-[12px] font-medium text-center">{toast.msg}</div>
        {toast.action && (
          <button
            className="pointer-events-auto tap-btn font-ui text-[12px] font-bold text-ochre flex-shrink-0"
            onClick={() => { toast.action.onPress(); setToast(null); }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/toast.test.js` แล้ว `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add src/lib/toast.js src/lib/toast.test.js src/components/ToastHost.jsx
git commit -m "feat(toast): optional action button, e.g. undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: คิวฟังต่อ (`lib/resumeQueue.js` + TtsContext)

**Files:**
- Create: `src/lib/resumeQueue.js`, `src/lib/resumeQueue.test.js`
- Modify: `src/context/TtsContext.jsx`

**Interfaces:**
- Consumes:
  - `buildItemsFromRefs(books, refs)` จาก `src/lib/sectionText.js`
  - item ของ tts มีรูป `{ sectionId, bookId, number, title, chunks, … }`
  - `tts.currentItemIndex()` คืน index ของ item ที่กำลังเริ่ม ณ ตอนที่ `onItemStart` ถูกเรียก (ทั้งใน JS loop และใน `enterNativeItem`)
  - `shortLabel` (Task 2)
- Produces (`resumeQueue.js`):
  - `defaultLabel(items)`
  - `startQueue(items, startIndex, label?)`, `markItem(index)`, `markDone()`, `clearResume()`
  - `getResume() → { label, refs, index, done, updatedAt } | null`
  - `resolveResume(record, books) → { label, refs, index } | null`
- Produces (`useTts()`):
  - `playSections(items, startIndex = 0, { label }?)`
  - `playResume() → boolean`
  - `resumeQueue`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/resumeQueue.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  defaultLabel, startQueue, markItem, markDone, getResume, clearResume, resolveResume,
} = await import('./resumeQueue.js');

const items = Array.from({ length: 10 }, (_, i) => ({ sectionId: `criminal-${i + 1}`, bookId: 'criminal', number: String(i + 1) }));
const book = (ids) => [{ id: 'criminal', sections: ids.map(id => ({ id })) }];
const allIds = items.map(i => i.sectionId);

describe('resume queue', () => {
  beforeEach(() => store.clear());

  it('resumes at the section that was cut off, not at the start', () => {
    startQueue(items, 0, 'สอบเนติ สมัย 78');
    markItem(0);
    markItem(1); // stopped somewhere inside section 2
    const r = resolveResume(getResume(), book(allIds));
    expect(r).toEqual({ label: 'สอบเนติ สมัย 78', refs: items.map(i => ({ bookId: 'criminal', sectionId: i.sectionId })), index: 1 });
  });

  it('a finished queue has nothing to resume', () => {
    startQueue(items, 0, 'x');
    markItem(9);
    markDone();
    expect(getResume().done).toBe(true);
    expect(resolveResume(getResume(), book(allIds))).toBeNull();
  });

  it('starting a new queue replaces the old one', () => {
    startQueue(items, 0, 'old');
    markItem(5);
    startQueue(items.slice(0, 3), 2, 'new');
    expect(getResume()).toMatchObject({ label: 'new', index: 2, done: false });
    expect(getResume().refs).toHaveLength(3);
  });

  it('shifts the index when an earlier section is gone from the corpus', () => {
    startQueue(items, 0, 'x');
    markItem(4);
    const r = resolveResume(getResume(), book(allIds.filter(id => id !== 'criminal-2' && id !== 'criminal-3')));
    expect(r.refs).toHaveLength(8);
    expect(r.index).toBe(2);
    expect(r.refs[r.index].sectionId).toBe('criminal-5');
  });

  it('nothing left after filtering resolves to null', () => {
    startQueue(items, 0, 'x');
    expect(resolveResume(getResume(), book([]))).toBeNull();
  });

  it('ignores an index outside the queue', () => {
    startQueue(items, 0, 'x');
    markItem(42);
    markItem(-1);
    expect(getResume().index).toBe(0);
  });

  it('labels a queue with the first section when no label is given', () => {
    expect(defaultLabel(items)).toBe('อาญา ม.1');
    startQueue(items, 0);
    expect(getResume().label).toBe('อาญา ม.1');
  });

  it('clearResume and corrupt storage both give null', () => {
    startQueue(items, 0, 'x');
    clearResume();
    expect(getResume()).toBeNull();
    store.set('lawcode-th-resume', '{not json');
    expect(getResume()).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/resumeQueue.test.js`
Expected: FAIL "Failed to resolve import ./resumeQueue.js"

- [ ] **Step 3: เขียน `src/lib/resumeQueue.js`**

```js
// The queue Wave's hero resumes (spec 4): the whole list that was playing and
// where it stopped. A section counts as heard once the next one starts, so
// resuming replays the cut-off section from its start and goes on from there
// — 1–10 stopped inside section 2 resumes 2, 3 … 10.
import { LAW_BOOKS_META } from '../data/lawMeta';

const KEY = 'lawcode-th-resume';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; }
  catch { return null; }
}

function write(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function defaultLabel(items) {
  const first = items?.[0];
  if (!first) return '';
  const meta = LAW_BOOKS_META.find(m => m.id === first.bookId);
  return `${meta?.shortLabel ?? meta?.shortName ?? ''} ม.${first.number}`.trim();
}

export function startQueue(items, startIndex = 0, label) {
  const refs = (items || [])
    .filter(i => i?.sectionId && i?.bookId)
    .map(i => ({ bookId: i.bookId, sectionId: i.sectionId }));
  if (!refs.length) return;
  write({
    label: label || defaultLabel(items),
    refs,
    index: Math.max(0, Math.min(startIndex, refs.length - 1)),
    done: false,
    updatedAt: Date.now(),
  });
}

export function markItem(index) {
  const r = read();
  if (!r || !Array.isArray(r.refs) || !(index >= 0) || index >= r.refs.length) return;
  write({ ...r, index, done: false, updatedAt: Date.now() });
}

export function markDone() {
  const r = read();
  if (r) write({ ...r, done: true, updatedAt: Date.now() });
}

export function getResume() {
  const r = read();
  return r && Array.isArray(r.refs) && r.refs.length ? r : null;
}

export function clearResume() {
  write(null);
}

// Drop sections the loaded corpus no longer has, moving the index back by
// each one dropped before it. Null when finished or nothing is left.
export function resolveResume(record, books) {
  if (!record || record.done) return null;
  const has = (ref) => books.some(b => b.id === ref.bookId && b.sections?.some(s => s.id === ref.sectionId));
  const refs = [];
  let index = record.index;
  record.refs.forEach((ref, i) => {
    if (has(ref)) refs.push(ref);
    else if (i < record.index) index--;
  });
  if (!refs.length) return null;
  return { label: record.label, refs, index: Math.min(Math.max(index, 0), refs.length - 1) };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/resumeQueue.test.js`
Expected: PASS 8 tests

- [ ] **Step 5: ต่อเข้า `src/context/TtsContext.jsx`**

เพิ่ม import:

```js
import { startQueue, markItem, markDone, getResume, clearResume, resolveResume } from '../lib/resumeQueue';
import { buildItemsFromRefs } from '../lib/sectionText';
```

เปลี่ยน `const { settings, setSettings } = useApp();` เป็น:

```js
  const { settings, setSettings, books, loadingData } = useApp();
```

ใน `tts.setHooks({...})` เปลี่ยน `onItemStart` และ `onFinish` เป็น:

```js
      onItemStart: (item) => {
        // Before the quota check: a section refused for quota is still where
        // the queue stopped, so resuming starts there.
        markItem(tts.currentItemIndex());
        if (!isProRef.current) {
          if (!consumeQuota()) { setQuotaBlocked(true); return false; }
        }
        recordListen(item);
        return true;
      },
```

```js
      onFinish: () => { markDone(); forceRender(); },
```

แทนฟังก์ชัน `playSections` ด้วย:

```js
  // `label` names the queue on Wave's hero ("สอบเนติ สมัย 78"). The queue is
  // saved before playItems because native announces its first section from
  // inside it, and markItem needs the new queue already there.
  const playSections = useCallback((items, startIndex = 0, { label } = {}) => {
    setQuotaBlocked(false);
    if (!items || !items.length) return;
    if (!isProRef.current && getRemaining() <= 0) {
      setQuotaBlocked(true);
      return;
    }
    startQueue(items, startIndex, label);
    tts.playItems(items, startIndex);
  }, []);

  // The hero's "ฟังต่อ". False when there is nothing to resume, so the caller
  // can fall back. A queue whose sections are all gone is cleared — but only
  // once the corpus has loaded.
  const playResume = useCallback(() => {
    if (loadingData) return false;
    const raw = getResume();
    const r = resolveResume(raw, books);
    if (!r) {
      if (raw && !raw.done) clearResume();
      return false;
    }
    const items = buildItemsFromRefs(books, r.refs);
    if (!items.length) { clearResume(); return false; }
    playSections(items, r.index, { label: r.label });
    return true;
  }, [books, loadingData, playSections]);
```

ใน `const value = {` เพิ่มใต้ `playSections,`:

```js
    playResume,
    resumeQueue: getResume(),
```

- [ ] **Step 6: รันเทสต์ทั้งหมดและ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 7: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

ใน dev server:
- เล่นโฟลเดอร์ที่มีหลายมาตรา ปล่อยให้ขึ้นมาตราที่ 2 แล้วกดหยุด ดู `localStorage['lawcode-th-resume']` ต้องเป็น `index: 1, done: false`
- เล่นคิวมาตราเดียวจนจบ ต้องได้ `done: true`

- [ ] **Step 8: Commit**

```bash
git add src/lib/resumeQueue.js src/lib/resumeQueue.test.js src/context/TtsContext.jsx
git commit -m "feat(tts): remember the playing queue so it can be resumed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: คณิตของคลื่น (`lib/wave.js`)

**Files:**
- Create: `src/lib/wave.js`, `src/lib/wave.test.js`

**Interfaces:**
- Produces:
  - `waveBars(sections: { id, text }[], heard: Set<sectionId>, nBars) → { from, to, height, heard }[]` โดย `to` ไม่รวมตัวเอง, `height` อยู่ใน 0.16–1, `heard` อยู่ใน 0–1
  - `barOpacity(heard) → number` (0 เมื่อยังไม่ฟัง, ไม่เช่นนั้น `0.35 + 0.65·heard`)
  - `queueBars(lengths: number[], index, done, nBars = 40) → { height, state: 'done' | 'now' | '' }[]`
  - `numberInRange(number, { from, to }) → boolean`
  - `pathToSection(toc, number) → node[]`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/wave.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { waveBars, barOpacity, queueBars, numberInRange, pathToSection } from './wave.js';

const secs = (n, len = (i) => 100 + i) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: 'x'.repeat(len(i)) }));

describe('waveBars', () => {
  it('makes min(nBars, sections) bars covering every section exactly once', () => {
    for (const [n, bars] of [[448, 40], [16, 28], [40, 40], [41, 40]]) {
      const out = waveBars(secs(n), new Set(), bars);
      expect(out).toHaveLength(Math.min(n, bars));
      expect(out[0].from).toBe(0);
      expect(out.at(-1).to).toBe(n);
      for (let k = 1; k < out.length; k++) expect(out[k].from).toBe(out[k - 1].to);
      for (const b of out) expect(b.to).toBeGreaterThan(b.from);
    }
  });

  it('heights run 0.16–1, the longest stretch at 1', () => {
    const out = waveBars(secs(10, (i) => (i === 7 ? 900 : 100)), new Set(), 10);
    expect(Math.max(...out.map(b => b.height))).toBe(1);
    expect(out[7].height).toBe(1);
    for (const b of out) {
      expect(b.height).toBeGreaterThanOrEqual(0.16);
      expect(b.height).toBeLessThanOrEqual(1);
    }
  });

  it('reports the share heard in each bar', () => {
    const out = waveBars(secs(8), new Set(['s0', 's1', 's2']), 4);
    expect(out.map(b => b.heard)).toEqual([1, 0.5, 0, 0]);
  });

  it('opacity is zero until something is heard', () => {
    expect(barOpacity(0)).toBe(0);
    expect(barOpacity(1)).toBeCloseTo(1);
    expect(barOpacity(0.5)).toBeCloseTo(0.675);
  });
});

describe('queueBars', () => {
  it('one bar per section, marking done and now', () => {
    const out = queueBars([100, 400, 100], 1, false);
    expect(out.map(b => b.state)).toEqual(['done', 'now', '']);
    expect(out[1].height).toBe(1);
  });

  it('a finished queue is all done', () => {
    expect(queueBars([1, 2, 3], 2, true).map(b => b.state)).toEqual(['done', 'done', 'done']);
  });

  it('groups a long queue into 40 bars', () => {
    const out = queueBars(Array(120).fill(50), 61, false);
    expect(out).toHaveLength(40);
    expect(out.filter(b => b.state === 'now')).toHaveLength(1);
    expect(out[20].state).toBe('now');
    expect(out[19].state).toBe('done');
  });
});

describe('table of contents', () => {
  const toc = [
    { range: { from: '1', to: '106' }, children: [] },
    { range: { from: '107', to: '366/4' }, children: [
      { range: { from: '107', to: '135' }, children: [] },
      { range: { from: '288', to: '294' }, children: [] },
    ] },
  ];

  it('compares section numbers with slash forms', () => {
    expect(numberInRange('29/1', { from: '29', to: '30' })).toBe(true);
    expect(numberInRange('366/5', { from: '107', to: '366/4' })).toBe(false);
    expect(numberInRange('366/2', { from: '107', to: '366/4' })).toBe(true);
  });

  it('walks to the deepest node holding a section', () => {
    expect(pathToSection(toc, '289')).toEqual([toc[1], toc[1].children[1]]);
    expect(pathToSection(toc, '50')).toEqual([toc[0]]);
    expect(pathToSection(toc, '999')).toEqual([]);
    expect(pathToSection(undefined, '1')).toEqual([]);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/wave.test.js`
Expected: FAIL "Failed to resolve import ./wave.js"

- [ ] **Step 3: เขียน `src/lib/wave.js`**

```js
// The waveforms of the Wave theme (spec 3.1, 3.4), as pure functions.
//
// A law's wave splits its sections, in order, into equal stretches. A bar is
// as tall as its stretch is long to listen to — the text length stands in
// for audio time — and coloured by how much of it has been heard.

export function waveBars(sections, heard, nBars) {
  const N = sections.length;
  const n = Math.min(nBars, N);
  if (!n) return [];
  const raw = [];
  for (let k = 0; k < n; k++) {
    const from = Math.floor((k * N) / n);
    const to = Math.floor(((k + 1) * N) / n);
    let len = 0;
    let got = 0;
    for (let i = from; i < to; i++) {
      len += (sections[i].text || '').length;
      if (heard.has(sections[i].id)) got++;
    }
    raw.push({ from, to, len, heard: got / (to - from) });
  }
  const max = Math.max(...raw.map(b => b.len)) || 1;
  return raw.map(b => ({ from: b.from, to: b.to, height: 0.16 + 0.84 * Math.sqrt(b.len / max), heard: b.heard }));
}

export function barOpacity(heard) {
  return heard > 0 ? 0.35 + 0.65 * heard : 0;
}

// The hero's queue wave: one bar per section, or 40 equal groups when the
// queue is longer. A group is done when the queue is past all of it.
export function queueBars(lengths, index, done, nBars = 40) {
  const N = lengths.length;
  const n = Math.min(nBars, N);
  if (!n) return [];
  const raw = [];
  for (let k = 0; k < n; k++) {
    const from = Math.floor((k * N) / n);
    const to = Math.floor(((k + 1) * N) / n);
    let len = 0;
    for (let i = from; i < to; i++) len += lengths[i] || 0;
    const state = done || to <= index ? 'done' : index >= from && index < to ? 'now' : '';
    raw.push({ len, state });
  }
  const max = Math.max(...raw.map(b => b.len)) || 1;
  return raw.map(b => ({ height: 0.28 + 0.72 * Math.sqrt(b.len / max), state: b.state }));
}

// Same comparison as sectionsInRange in toc.js: "29/1" is section 29, sub 1.
const key = (n) => {
  const [main, sub] = String(n).split('/');
  return [parseFloat(main) || 0, parseFloat(sub) || 0];
};

export function numberInRange(number, range) {
  if (!range) return false;
  const [m, s] = key(number);
  const [fm, fs] = key(range.from);
  const [tm, ts] = key(range.to);
  if (m < fm || m > tm) return false;
  if (m === fm && s < fs) return false;
  if (m === tm && s > ts) return false;
  return true;
}

// From the top of a law's table of contents down to the deepest node whose
// range holds the section — where a tapped bar opens in Select.
export function pathToSection(toc, number) {
  const path = [];
  let level = toc || [];
  while (level.length) {
    const node = level.find(n => numberInRange(number, n.range));
    if (!node) break;
    path.push(node);
    level = node.children || [];
  }
  return path;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/wave.test.js`
Expected: PASS 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/wave.js src/lib/wave.test.js
git commit -m "feat(wave): waveform maths for laws and the play queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: แยก logic หน้าเลือกฟังเป็น hook (Classic ไม่เปลี่ยน)

**Files:**
- Create: `src/lib/selection.js`, `src/lib/selection.test.js`
- Create: `src/hooks/useTocNavigation.js`, `src/hooks/useSectionSelection.js`, `src/hooks/useFolderPlayback.js`
- Modify: `src/lib/toc.js`, `src/screens/SelectScreen.jsx`

**Interfaces:**
- Consumes: `playSections(items, start, { label })` (Task 5)
- Produces:
  - `selection.js`: `keyOf(bookId, sectionId)`, `toggleOne(prev, bookId, section)`, `toggleMany(prev, bookId, sections)`, `selectionState(selected, bookId, sections) → { all, some, count, total }`
  - `toc.js`: `tocNodeKey(node, idx)`
  - `useTocNavigation({ activeBook, filter }) → { toc, tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections }` (`toc` คือสารบัญระดับบนสุดของฉบับที่เลือก)
  - `useSectionSelection({ activeBook, visibleSections }) → { selected, setSelected, selectedList, toggleSelect, selectAllInNode, nodeSelectionState, toggleSelectAll, allSelected, someSelected }`
  - `useFolderPlayback({ books, folders, selectedList }) → { isPlayingSource, playRefs, playSelected, playLeaf, playGroup }` โดย `playRefs(source, label, refs, emptyMessage)`

- [ ] **Step 1: เขียนเทสต์ของ `selection.js`**

สร้าง `src/lib/selection.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { keyOf, toggleOne, toggleMany, selectionState } from './selection.js';

const s = (n) => ({ id: `criminal-${n}`, number: String(n), title: `มาตรา ${n}` });

describe('section selection', () => {
  it('keys by book and section', () => {
    expect(keyOf('criminal', 'criminal-1')).toBe('criminal::criminal-1');
  });

  it('toggles one section on and off without touching the input', () => {
    const empty = {};
    const on = toggleOne(empty, 'criminal', s(288));
    expect(empty).toEqual({});
    expect(on['criminal::criminal-288']).toEqual({ sectionId: 'criminal-288', bookId: 'criminal', number: '288', title: 'มาตรา 288' });
    expect(toggleOne(on, 'criminal', s(288))).toEqual({});
  });

  it('selects all when any is missing, clears all when all are on', () => {
    const secs = [s(1), s(2), s(3)];
    const some = toggleOne({}, 'criminal', s(2));
    const all = toggleMany(some, 'criminal', secs);
    expect(Object.keys(all)).toHaveLength(3);
    expect(toggleMany(all, 'criminal', secs)).toEqual({});
  });

  it('keeps selections from other books', () => {
    const other = toggleOne({}, 'civil', { id: 'civil-1', number: '1', title: '' });
    const both = toggleMany(other, 'criminal', [s(1)]);
    expect(Object.keys(both)).toEqual(['civil::civil-1', 'criminal::criminal-1']);
  });

  it('reports the state of a set', () => {
    const secs = [s(1), s(2)];
    expect(selectionState({}, 'criminal', [])).toEqual({ all: false, some: false, count: 0, total: 0 });
    expect(selectionState({}, 'criminal', secs)).toEqual({ all: false, some: false, count: 0, total: 2 });
    const one = toggleOne({}, 'criminal', s(1));
    expect(selectionState(one, 'criminal', secs)).toEqual({ all: false, some: true, count: 1, total: 2 });
    expect(selectionState(toggleMany(one, 'criminal', secs), 'criminal', secs)).toEqual({ all: true, some: false, count: 2, total: 2 });
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/selection.test.js`
Expected: FAIL "Failed to resolve import ./selection.js"

- [ ] **Step 3: เขียน `src/lib/selection.js`**

```js
// Ticking sections on the Select screen, without React, so Classic and Wave
// share one tested definition. `selected` maps keyOf(book, section) to the
// entry folders and playback take.
export const keyOf = (bookId, sectionId) => `${bookId}::${sectionId}`;

const entryOf = (bookId, s) => ({ sectionId: s.id, bookId, number: s.number, title: s.title });

export function toggleOne(prev, bookId, section) {
  const k = keyOf(bookId, section.id);
  const next = { ...prev };
  if (next[k]) delete next[k];
  else next[k] = entryOf(bookId, section);
  return next;
}

// All on → all off; otherwise all on.
export function toggleMany(prev, bookId, sections) {
  const next = { ...prev };
  const allOn = sections.length > 0 && sections.every(s => next[keyOf(bookId, s.id)]);
  for (const s of sections) {
    const k = keyOf(bookId, s.id);
    if (allOn) delete next[k];
    else next[k] = entryOf(bookId, s);
  }
  return next;
}

export function selectionState(selected, bookId, sections) {
  if (!sections.length) return { all: false, some: false, count: 0, total: 0 };
  const on = sections.filter(s => selected[keyOf(bookId, s.id)]).length;
  return { all: on === sections.length, some: on > 0 && on < sections.length, count: on, total: sections.length };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/selection.test.js`
Expected: PASS 5 tests

- [ ] **Step 5: ย้าย `tocNodeKey` ไป `src/lib/toc.js`**

ต่อท้าย `src/lib/toc.js`:

```js
// Identity for a table-of-contents node. Built from what the node *is* rather
// than where it sits, so React tears the row down when the list changes level
// instead of recycling it under a new label. The index is only a last-resort
// tiebreak for two siblings that are genuinely indistinguishable.
export const tocNodeKey = (node, idx) =>
  `${node.word ?? ''}|${node.num ?? ''}|${node.name ?? ''}|${node.range?.from ?? ''}-${node.range?.to ?? ''}|${idx}`;
```

- [ ] **Step 6: สร้าง `src/hooks/useTocNavigation.js`**

```js
// Table-of-contents state for the Select screen: the loaded TOC per book, the
// path drilled into, and the sections a leaf or a search shows. Moved out of
// SelectScreen unchanged so WaveSelect can share it.
import { useEffect, useMemo, useState } from 'react';
import { loadToc, sectionsInRange } from '../lib/toc';

export function useTocNavigation({ activeBook, filter }) {
  const [tocByBook, setTocByBook] = useState({});
  const [tocPath, setTocPath] = useState([]); // array of node refs from root

  // `tocLoaded` is tracked separately from the data because loadToc resolves
  // to [] on failure, which is otherwise indistinguishable from "not fetched
  // yet" — the empty state used to show "กำลังโหลดสารบาญ…" forever when the
  // fetch had actually failed.
  const [tocLoaded, setTocLoaded] = useState({});

  const fetchToc = (bookId) => {
    loadToc(bookId).then(toc => {
      setTocByBook(t => ({ ...t, [bookId]: toc }));
      setTocLoaded(l => ({ ...l, [bookId]: true }));
    });
  };

  useEffect(() => {
    if (!activeBook) return;
    if (tocByBook[activeBook.id]) return;
    fetchToc(activeBook.id);
  }, [activeBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // loadToc only caches successful fetches, so this genuinely re-requests.
  const retryToc = () => {
    if (!activeBook) return;
    setTocLoaded(l => ({ ...l, [activeBook.id]: false }));
    fetchToc(activeBook.id);
  };

  useEffect(() => { setTocPath([]); }, [activeBook?.id]);

  const toc = tocByBook[activeBook?.id] || [];
  const currentNodes = tocPath.length ? tocPath[tocPath.length - 1].children : toc;
  const atLeaf = tocPath.length > 0 && !tocPath[tocPath.length - 1].children?.length;

  // Sections shown at a leaf TOC node, or matching a search.
  const visibleSections = useMemo(() => {
    if (!activeBook) return [];
    const f = filter.trim();
    if (f) {
      const low = f.toLowerCase();
      return activeBook.sections.filter(
        s => String(s.number).startsWith(f) || s.title?.toLowerCase().includes(low),
      );
    }
    if (atLeaf) return sectionsInRange(activeBook, tocPath[tocPath.length - 1].range);
    return [];
  }, [activeBook, filter, tocPath, atLeaf]);

  // Every section under the node drilled into (for select-all-in-node).
  const nodeAllSections = useMemo(() => {
    if (!activeBook || !tocPath.length) return null;
    return sectionsInRange(activeBook, tocPath[tocPath.length - 1].range);
  }, [activeBook, tocPath]);

  return { toc, tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections };
}
```

- [ ] **Step 7: สร้าง `src/hooks/useSectionSelection.js`**

```js
// Ticked sections on the Select screen. A selection survives switching books.
import { useState } from 'react';
import { keyOf, toggleOne, toggleMany, selectionState } from '../lib/selection';
import { sectionsInRange } from '../lib/toc';

export function useSectionSelection({ activeBook, visibleSections }) {
  const [selected, setSelected] = useState({});
  const selectedList = Object.values(selected);
  const bookId = activeBook?.id;

  const visibleKeys = visibleSections.map(s => keyOf(bookId, s.id));
  const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => selected[k]);
  const someSelected = visibleKeys.some(k => selected[k]) && !allSelected;

  const toggleSelect = (s) => setSelected(prev => toggleOne(prev, bookId, s));
  const toggleSelectAll = () => setSelected(prev => toggleMany(prev, bookId, visibleSections));
  const selectAllInNode = (node) => {
    const secs = sectionsInRange(activeBook, node.range);
    setSelected(prev => toggleMany(prev, bookId, secs));
  };
  const nodeSelectionState = (node) => selectionState(selected, bookId, sectionsInRange(activeBook, node.range));

  return {
    selected, setSelected, selectedList, toggleSelect, selectAllInNode, nodeSelectionState,
    toggleSelectAll, allSelected, someSelected,
  };
}
```

- [ ] **Step 8: สร้าง `src/hooks/useFolderPlayback.js`**

```js
// Play buttons for folders and selections. A button whose own source is
// already playing stops it instead of starting it again — without that the
// only way to stop was the player bar, and pressing the button you just
// pressed looked like the app had hung. Which button is "the one playing" is
// tracked here: two folders can hold the same sections, and the engine knows
// what it reads but not who asked.
import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';
import { isSpeaking as ttsIsSpeaking } from '../lib/tts';
import { buildItemsFromRefs } from '../lib/sectionText';
import { sortSectionsByNumber } from '../lib/folders';
import { showToast } from '../lib/toast';

export function useFolderPlayback({ books, folders, selectedList = [] }) {
  const { playSections, playing, stop } = useTts();
  const [playingSource, setPlayingSource] = useState(null);

  const isPlayingSource = (source) => playing && playingSource === source;

  // The icon reads the rendered `playing`, but the decision must not: a press
  // before React re-renders would see a stale value and start the same thing
  // over. isSpeaking() is read from the engine at the moment of the tap.
  const isPlayingSourceNow = (source) => ttsIsSpeaking() && playingSource === source;

  // Playback also ends on its own, or from the player bar.
  useEffect(() => { if (!playing) setPlayingSource(null); }, [playing]);

  // `label` names the queue on Wave's hero (spec 4.1).
  const playRefs = (source, label, refs, emptyMessage) => {
    if (isPlayingSourceNow(source)) {
      stop();
      setPlayingSource(null);
      return;
    }
    const items = buildItemsFromRefs(books, refs);
    if (!items.length) { showToast(emptyMessage); return; }
    playSections(items, 0, { label });
    setPlayingSource(source);
  };

  const playSelected = () => playRefs(
    'selected', `มาตราที่เลือก ${selectedList.length} มาตรา`, selectedList, 'ยังไม่ได้เลือกมาตรา',
  );

  const leafLabel = (leaf) => {
    const parent = leaf.parentId && folders.find(f => f.id === leaf.parentId);
    return parent ? `${parent.name} · ${leaf.name}` : leaf.name;
  };

  // Ascending section-number order, not the order they were added.
  const playLeaf = (leaf) => playRefs(
    `leaf:${leaf.id}`, leafLabel(leaf), sortSectionsByNumber(leaf.sections), `โฟลเดอร์ "${leaf.name}" ยังไม่มีมาตรา`,
  );

  // sortSectionsByNumber groups by book (canonical order) then by number.
  const playGroup = (groupId) => {
    const group = folders.find(f => f.id === groupId);
    const children = folders.filter(f => f.parentId === groupId);
    playRefs(`group:${groupId}`, group?.name ?? 'กลุ่ม', sortSectionsByNumber(children.flatMap(c => c.sections)), 'กลุ่มนี้ยังไม่มีมาตรา');
  };

  return { isPlayingSource, playRefs, playSelected, playLeaf, playGroup };
}
```

- [ ] **Step 9: ให้ `src/screens/SelectScreen.jsx` ใช้ hook**

1. ลบ `const keyOf = …` และ `const tocNodeKey = …` (พร้อม comment ของมัน) ที่หัวไฟล์ แล้วเพิ่ม import:

```js
import { keyOf } from '../lib/selection';
import { tocNodeKey } from '../lib/toc';
import { useTocNavigation } from '../hooks/useTocNavigation';
import { useSectionSelection } from '../hooks/useSectionSelection';
import { useFolderPlayback } from '../hooks/useFolderPlayback';
```

2. ในฟังก์ชัน `SelectScreen` ลบ:
   - `const { playSections, playing, stop } = useTts();`
   - `const [playingSource, setPlayingSource] = useState(null);`
   - `const [selected, setSelected] = useState({});`
   - ตั้งแต่ `// v15 #2: TOC navigation stack on the left panel` จนถึงบรรทัดก่อน `const refreshFolders = () => setFolders(getFolders());`
   - ตั้งแต่บรรทัดถัดจาก `const refreshFolders = …` (`const selectedList = …`) จนถึงบรรทัดก่อน `const addToTarget = () => {`

3. วางแทนก้อนสุดท้ายที่ลบ (ต่อจาก `const refreshFolders = …`):

```js
  const {
    tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections,
  } = useTocNavigation({ activeBook, filter });
  const {
    selected, setSelected, selectedList, toggleSelect, selectAllInNode, nodeSelectionState,
    toggleSelectAll, allSelected, someSelected,
  } = useSectionSelection({ activeBook, visibleSections });
  const { isPlayingSource, playSelected, playLeaf, playGroup } = useFolderPlayback({ books, folders, selectedList });
```

4. ลบ import ที่ไม่ใช้แล้ว ตรวจด้วย:

```bash
for w in useMemo useEffect useTts ttsIsSpeaking loadToc sectionsInRange buildItemsFromRefs showToast; do printf "%s: " $w; grep -c "\b$w\b" src/screens/SelectScreen.jsx; done
```

ชื่อที่นับได้ 1 (มีแค่ในบรรทัด import) ให้ลบออกจาก import

- [ ] **Step 10: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 11: ตรวจ Classic (ผู้ควบคุมงานทำ)**

ตั้งธีม Classic แล้วเปิด `/select` ทุกข้อต้องทำงาน และหน้าตาต้องเหมือนภาพใน Task 1:
- เลือกฉบับ แล้วเข้าสารบัญสองชั้น
- ติ๊กมาตรา และกด "เลือกทั้งหมวด"
- ค้นด้วยเลขมาตรา
- ติ๊กมาตราข้ามฉบับ แล้วดูว่า BookPicker นับจำนวนที่เลือกถูก
- กด "ฟังเลย" แล้วกดซ้ำต้องหยุด
- เล่นโฟลเดอร์และกลุ่ม
- "+ เพิ่มใน" ลงโฟลเดอร์ที่เลือก

- [ ] **Step 12: Commit**

```bash
git add src/lib/selection.js src/lib/selection.test.js src/lib/toc.js src/hooks/useTocNavigation.js src/hooks/useSectionSelection.js src/hooks/useFolderPlayback.js src/screens/SelectScreen.jsx
git commit -m "refactor(select): selection, TOC and playback logic into shared hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ส่วนบนของหน้าแรก — เทพีเป็นปุ่มเล่น

**Files:**
- Copy: `store-assets/hero/processed/themis-on.jpg`, `store-assets/hero/processed/headphones.png` → `src/assets/wave/`
- Create: `src/components/wave/ThemisButton.jsx`, `src/components/wave/WaveHero.jsx`
- Modify: `src/styles/wave.css`

**Interfaces:**
- Consumes:
  - `useTts()` ได้ `playing`, `paused`, `pause`, `resume`, `items`, `itemIndex`, `currentItem`, `current` (`{ chunkIndex }`) ที่มีอยู่แล้ว และ `playSections`, `playResume`, `resumeQueue` (Task 5)
  - `queueBars` (Task 6), `resolveReduceMotion` (Task 2), `buildItemsFromRefs`, `cleanTitle` จาก `src/lib/sectionText.js`
- Produces:
  - `<ThemisButton playing still disabled label onPress />`
  - `<WaveHero />` (ไม่มี props อ่านทุกอย่างจาก context)

- [ ] **Step 1: คัดลอกภาพ**

```bash
cp store-assets/hero/processed/themis-on.jpg store-assets/hero/processed/headphones.png src/assets/wave/
```

- [ ] **Step 2: สร้าง `src/components/wave/ThemisButton.jsx`**

```jsx
// Lady Justice from the app icon is Wave's play button (spec 3.2). Paused,
// the headphones hang from the hook in her raised hand. Playing, they fly up
// in an arc and settle on her head — the cut-out pair hands over to the photo
// of her wearing them — then gold sound rings spread from her ears.
//
// The element stays mounted while playback starts and stops, so toggling the
// `on` class is what runs the CSS transitions in wave.css.
import themisBase from '../../assets/wave/themis-base.jpg';
import themisOn from '../../assets/wave/themis-on.jpg';
import headphones from '../../assets/wave/headphones.png';

const Play = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const Pause = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);

export default function ThemisButton({ playing, still, disabled, label, onPress }) {
  return (
    <button
      type="button"
      className={`wv-themis${still ? ' is-still' : ''}`}
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
    >
      <span className={`wv-themis-img${playing ? ' on' : ''}`}>
        <img className="wv-base" src={themisBase} alt="" draggable="false" />
        <img className="wv-on" src={themisOn} alt="" draggable="false" />
        {!still && (
          <span className="wv-fly" aria-hidden="true">
            <span className="wv-fx"><span className="wv-fy"><span className="wv-fs">
              <img src={headphones} alt="" draggable="false" />
            </span></span></span>
          </span>
        )}
        {!still && (
          <svg className="wv-waves" viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="#E9BE64" strokeWidth="2.2" strokeLinecap="round">
            <path d="M136 48 Q145 60 136 72" /><path d="M143 41 Q156 60 143 79" />
            <path d="M55 48 Q46 60 55 72" /><path d="M48 41 Q35 60 48 79" />
          </svg>
        )}
      </span>
      <span className="wv-badge" aria-hidden="true">{playing ? <Pause /> : <Play />}</span>
    </button>
  );
}
```

- [ ] **Step 3: สร้าง `src/components/wave/WaveHero.jsx`**

```jsx
// Wave Home's dark stage (spec 3.1): greeting and brand, Lady Justice as the
// play button, what is playing or waiting to be resumed, and a wave with one
// bar per section of the queue. On this screen it replaces the player bar.
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import ThemisButton from './ThemisButton';
import { buildItemsFromRefs, cleanTitle } from '../../lib/sectionText';
import { queueBars } from '../../lib/wave';
import { resolveReduceMotion } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? '';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}

export default function WaveHero() {
  const navigate = useNavigate();
  const { books, history, loadingData, settings } = useApp();
  const {
    playing, paused, pause, resume, next, prev, items, itemIndex, currentItem, current,
    playSections, playResume, resumeQueue,
  } = useTts();
  const still = resolveReduceMotion(settings);

  const sectionOf = (ref) => books.find(b => b.id === ref.bookId)?.sections?.find(s => s.id === ref.sectionId);
  const describe = (ref) => {
    const s = sectionOf(ref);
    return s ? `${labelOf(ref.bookId)} ม.${s.number} ${cleanTitle(s.title)}`.trim() : '';
  };

  // spec 3.1, the hero's states
  const active = playing && !paused;
  let mode;
  let queue = []; // refs
  let index = 0;
  if (playing || paused) {
    mode = active ? 'playing' : 'paused';
    queue = items.map(i => ({ bookId: i.bookId, sectionId: i.sectionId }));
    index = Math.max(0, itemIndex);
  } else if (resumeQueue) {
    mode = resumeQueue.done ? 'done' : 'resume';
    queue = resumeQueue.refs;
    index = resumeQueue.index;
  } else if (history[0]) {
    mode = 'last';
  } else {
    mode = 'empty';
  }

  const lastRead = history[0];
  const playLastRead = () => {
    const got = buildItemsFromRefs(books, [{ sectionId: lastRead.sectionId, bookId: lastRead.bookId }]);
    if (got.length) playSections(got, 0);
    else showToast('เปิดมาตรานี้ไม่ได้');
  };

  const n = queue.length;
  const pos = n ? `${Math.min(index + 1, n)}/${n}` : '';
  const view = {
    playing: { kicker: `กำลังฟัง · ${pos}`, aria: 'หยุดชั่วคราว', press: pause },
    paused: { kicker: `ฟังต่อ · ${pos}`, aria: 'ฟังต่อ', press: resume },
    resume: { kicker: `ฟังต่อ · ${pos}`, aria: 'ฟังต่อ', press: () => { if (!playResume() && lastRead) playLastRead(); } },
    done: {
      kicker: `ฟังจบแล้ว · ${n}/${n}`,
      aria: 'ฟังคิวนี้อีกครั้ง',
      press: () => {
        const got = buildItemsFromRefs(books, resumeQueue.refs);
        if (got.length) playSections(got, 0, { label: resumeQueue.label });
      },
    },
    last: {
      kicker: lastRead ? `ฟัง · ${labelOf(lastRead.bookId)} ม.${lastRead.number}` : '',
      aria: 'ฟังมาตราที่อ่านล่าสุด',
      press: playLastRead,
    },
    empty: { kicker: 'เริ่มฟัง', aria: 'เลือกมาตราที่จะฟัง', press: () => navigate('/select') },
  }[mode];

  const title = mode === 'last' || mode === 'empty'
    ? (mode === 'last' ? cleanTitle(lastRead.title) || `มาตรา ${lastRead.number}` : 'เลือกกฎหมายที่จะฟัง')
    : resumeQueue?.label ?? '';
  const sub = loadingData
    ? 'กำลังโหลด…'
    : (playing || paused) && currentItem
      ? describe({ bookId: currentItem.bookId, sectionId: currentItem.sectionId })
      : n ? describe(queue[Math.min(index, n - 1)]) : '';

  const lengths = queue.map(r => (sectionOf(r)?.text || '').length);
  const bars = queueBars(lengths, index, mode === 'done');
  // How far into the current section, from the chunk being spoken.
  const chunkCount = currentItem?.chunks?.length || 1;
  const nowFill = active || paused ? Math.min(1, Math.max(0, current.chunkIndex) / chunkCount) : 0;
  const left = mode === 'done' ? 0 : n - index;

  return (
    <section className={`wv-hero${active ? ' on' : ''}`} aria-label="ฟังต่อ">
      <div className="wv-hero-top">
        <div>
          <div className="wv-hello">{greeting()}</div>
          <div className="wv-brand">Juris <b>Voice</b></div>
        </div>
        <button type="button" className="wv-hero-icon tap-btn" onClick={() => navigate('/search')} aria-label="ค้นหา">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      </div>

      <div className="wv-hero-main">
        <ThemisButton playing={active} still={still} disabled={loadingData} label={view.aria} onPress={view.press} />
        <div className="wv-hero-info">
          <div className="wv-kicker">{view.kicker}</div>
          <div className="wv-qname">{title}</div>
          <div className="wv-qsub">{sub}</div>
          {n > 0 && (
            <div className="wv-hero-ctl">
              {(playing || paused) && (
                <>
                  <button type="button" className="tap-btn" onClick={prev} aria-label="มาตราก่อนหน้า">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
                  </button>
                  <button type="button" className="tap-btn" onClick={next} aria-label="มาตราถัดไป">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
                  </button>
                </>
              )}
              <span>{left ? `เหลืออีก ${left} มาตรา` : 'จบคิวแล้ว'}</span>
            </div>
          )}
        </div>
      </div>

      {n > 0 && (
        <>
          <div className="wv-qwave" aria-hidden="true">
            {bars.map((b, k) => (
              <b key={k} className={b.state ? `is-${b.state}` : ''} style={{ height: `${(b.height * 100).toFixed(0)}%` }}>
                {b.state === 'now' && <i style={{ width: `${(nowFill * 100).toFixed(0)}%` }} />}
              </b>
            ))}
          </div>
          <div className="wv-qfoot">
            <span>{describe(queue[0]).split(' ').slice(0, 2).join(' ')}</span>
            <span>คิวที่ฟังค้างไว้</span>
            <span>{describe(queue[n - 1]).split(' ').slice(0, 2).join(' ')}</span>
          </div>
        </>
      )}
    </section>
  );
}
```

`next` และ `prev` คือ `tts.next` / `tts.prev` ที่ `TtsContext` ส่งออกอยู่แล้ว ตัวเดียวกับที่ `TtsPlayer` ใช้

- [ ] **Step 4: สไตล์ใน `src/styles/wave.css`**

ต่อท้ายไฟล์:

```css
/* ── Hero: a dark stage in both modes, like the icon's black ground ────── */
.wv-hero { margin: 6px 12px 0; border-radius: 30px; padding: 14px 16px 16px; position: relative; overflow: hidden; isolation: isolate;
  color: #F3EEE4; font-family: var(--f-ui);
  background: radial-gradient(120% 90% at 22% 0%, #2B2519 0%, #15130F 48%, #0C0B09 100%);
  box-shadow: 0 18px 40px rgba(20, 14, 4, 0.28), inset 0 0 0 1px rgba(233, 190, 100, 0.14); }
.wv-hero::before { content: ''; position: absolute; left: -12%; top: -30%; width: 80%; height: 120%; z-index: -1; opacity: 0.55; transition: opacity 0.6s;
  background: radial-gradient(closest-side, rgba(233, 190, 100, 0.24), transparent 70%); }
.wv-hero.on::before { opacity: 1; animation: wv-glow 3s ease-in-out infinite alternate; }
@keyframes wv-glow { to { transform: translate(6%, 4%) scale(1.08); } }
.wv-hero-top { display: flex; align-items: center; justify-content: space-between; }
.wv-hello { font-size: 11px; color: rgba(243, 238, 228, 0.6); }
.wv-brand { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
.wv-brand b { color: #E9BE64; }
.wv-hero-icon { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: rgba(243, 238, 228, 0.85);
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(233, 190, 100, 0.2); }
.wv-hero-main { display: flex; align-items: center; gap: 14px; margin-top: 10px; padding-bottom: 12px; }
.wv-hero-info { flex: 1; min-width: 0; }
.wv-kicker { font-size: 10px; letter-spacing: 0.12em; color: #E9BE64; font-weight: 700; }
.wv-qname { font-size: 16px; font-weight: 600; line-height: 1.35; margin-top: 2px; }
.wv-qsub { font-size: 11.5px; color: rgba(243, 238, 228, 0.62); margin-top: 2px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wv-hero-ctl { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.wv-hero-ctl button { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, 0.08); color: #F3EEE4; }
.wv-hero-ctl span { font-size: 10.5px; color: rgba(243, 238, 228, 0.55); }
.wv-qwave { display: flex; align-items: flex-end; gap: 4px; height: 36px; margin-top: 14px; }
.wv-qwave b { flex: 1; border-radius: 3px; background: rgba(243, 238, 228, 0.15); position: relative; overflow: hidden; transform-origin: bottom; }
.wv-qwave b.is-done { background: #E2B04E; }
.wv-qwave b.is-now i { position: absolute; left: 0; top: 0; bottom: 0; background: #E2B04E; transition: width 0.4s linear; }
.wv-hero.on .wv-qwave b.is-now { animation: wv-eq 0.45s ease-in-out infinite alternate; }
@keyframes wv-eq { from { transform: scaleY(0.72); } to { transform: scaleY(1.06); } }
.wv-qfoot { display: flex; justify-content: space-between; font-size: 10px; color: rgba(243, 238, 228, 0.5); margin-top: 6px; }

/* ── Lady Justice, the play button (spec 3.2) ─────────────────────────── */
.wv-themis { position: relative; width: 148px; height: 148px; flex: none; border-radius: 32px; padding: 0; border: 0; background: none; }
.wv-themis:disabled { opacity: 0.6; }
.wv-themis::after { content: ''; position: absolute; inset: -5px; border-radius: 36px; border: 1.5px solid transparent; pointer-events: none; }
.wv-hero.on .wv-themis::after { border-color: rgba(233, 190, 100, 0.6); animation: wv-ring 1.8s ease-out infinite; }
@keyframes wv-ring { from { transform: scale(0.97); opacity: 1; } to { transform: scale(1.1); opacity: 0; } }
.wv-themis-img { display: block; width: 100%; height: 100%; border-radius: 32px; overflow: hidden; position: relative; isolation: isolate;
  box-shadow: 0 0 0 1px rgba(233, 190, 100, 0.28), 0 12px 32px rgba(0, 0, 0, 0.55); }
.wv-themis-img > img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.wv-base { transition: filter 0.9s; filter: brightness(0.94); }
.wv-themis-img.on .wv-base { filter: brightness(1.04); }
/* the photo of her wearing them takes over once the flying pair arrives */
.wv-on { opacity: 0; transition: opacity 0.25s ease-out; }
.wv-themis-img.on .wv-on { opacity: 1; transition: opacity 0.35s ease-in 0.72s; }
/* The pair hangs from the hook (box top at 64% of the frame), then flies to
   her head: X and Y ease differently so the path arcs, and it widens to fit.
   Percentages are of the pair's own box. */
.wv-fly { position: absolute; left: 66.9%; top: 64%; width: 19.5%; z-index: 2; pointer-events: none; }
.wv-fly span { display: block; }
.wv-fx { transition: transform 0.9s cubic-bezier(0.55, 0, 0.35, 1) 0.1s; }
.wv-fy { transition: transform 0.9s cubic-bezier(0.1, 0.8, 0.3, 1) 0.1s; }
.wv-fs { transform: rotate(7deg); transform-origin: 50% 0; transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, opacity 0.12s; }
.wv-fs img { width: 100%; display: block; filter: drop-shadow(0 0 2px rgba(233, 190, 100, 0.8)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5)); }
.wv-themis-img.on .wv-fx { transform: translateX(-147.5%); transition: transform 0.9s cubic-bezier(0.55, 0, 0.35, 1); }
.wv-themis-img.on .wv-fy { transform: translateY(-256%); transition: transform 0.9s cubic-bezier(0.1, 0.8, 0.3, 1); }
.wv-themis-img.on .wv-fs { transform: scale(1.6, 1.2); opacity: 0; transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s linear 0.85s; }
.wv-waves { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; opacity: 0; transition: opacity 0.3s; }
.wv-themis-img.on .wv-waves { opacity: 1; transition: opacity 0.4s 1.05s; }
.wv-waves path { animation: wv-wave 1.4s ease-out infinite; }
.wv-waves path:nth-child(even) { animation-delay: 0.4s; }
@keyframes wv-wave { from { opacity: 1; } to { opacity: 0; } }
/* Centred on the bottom edge, clear of the headphones hanging at the right. */
.wv-badge { position: absolute; left: 50%; bottom: -16px; margin-left: -20px; width: 40px; height: 40px; border-radius: 50%; z-index: 4;
  background: #E2B04E; color: #1D1404; display: grid; place-items: center;
  box-shadow: 0 6px 16px rgba(226, 176, 78, 0.5), 0 0 0 4px #15130F; transition: transform 0.2s; }
.wv-themis:active .wv-badge { transform: scale(0.9); }
/* Reduce motion: no flight, the two photos simply swap. */
.wv-themis.is-still .wv-on, .wv-themis.is-still .wv-base { transition: none; }
.wv-hero:has(.wv-themis.is-still)::before, .wv-hero:has(.wv-themis.is-still) .wv-themis::after,
.wv-hero:has(.wv-themis.is-still) .wv-qwave b { animation: none; }
```

- [ ] **Step 5: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด (component ยังไม่ถูก render จนถึง Task 9)

- [ ] **Step 6: Commit**

```bash
git add src/assets/wave/themis-on.jpg src/assets/wave/headphones.png src/components/wave/ThemisButton.jsx src/components/wave/WaveHero.jsx src/styles/wave.css
git commit -m "feat(wave): hero with Lady Justice as the play button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: หน้าแรก Wave

**Files:**
- Create: `src/components/wave/WaveBars.jsx`, `src/components/wave/FolderRow.jsx`, `src/components/wave/WaveLibrary.jsx`, `src/screens/WaveHome.jsx`
- Modify: `src/App.jsx`, `src/components/TtsPlayer.jsx`, `src/styles/wave.css`

**Interfaces:**
- Consumes:
  - `WaveHero` (Task 8), `waveBars`, `barOpacity` (Task 6), `useFolderPlayback` (Task 7)
  - `getFolders()` จาก `src/lib/folders.js`, `getAllStats()` จาก `src/lib/stats.js` (`{ [sectionId]: {...} }`)
- Produces:
  - `<WaveBars book heard nBars height onBar />` (`onBar(firstSectionIndex)`)
  - `<FolderRow />`, `<WaveLibrary />`, `WaveHome`
  - `ThemedScreen` ใน `App.jsx`
  - การนำทางจากแท่งคลื่นไป Select ใช้ `navigate('/select', { state: { bookId, sectionNumber } })`

- [ ] **Step 1: สร้าง `src/components/wave/WaveBars.jsx`**

```jsx
// One law's waveform: equal stretches of its sections, as tall as they are
// long to listen to, filled in its colour as they are heard (spec 3.4).
import { useMemo } from 'react';
import { waveBars, barOpacity } from '../../lib/wave';

// `flashFrom`: the first section index of a bar to outline in gold once,
// after it was tapped (spec 5.1).
export default function WaveBars({ book, heard, nBars, height, onBar, dim = false, flashFrom = null }) {
  const bars = useMemo(
    () => (book.sections?.length ? waveBars(book.sections, heard, nBars) : []),
    [book.sections, heard, nBars],
  );
  if (!bars.length) {
    // Still loading: even bars, so the row keeps its height.
    return <div className="wv-bars" style={{ height }} aria-hidden="true">{Array.from({ length: nBars }, (_, k) => <span key={k} className="wv-bar"><i style={{ height: '40%' }} /></span>)}</div>;
  }
  return (
    <div className={`wv-bars${dim ? ' is-dim' : ''}`} style={{ height }}>
      {bars.map((b, k) => {
        const first = book.sections[b.from], last = book.sections[b.to - 1];
        return (
          <button
            key={k}
            type="button"
            className={`wv-bar${b.from === flashFrom ? ' is-flash' : ''}`}
            onClick={() => onBar(b.from)}
            aria-label={`${book.shortLabel} มาตรา ${first.number} ถึง ${last.number} ฟังแล้ว ${Math.round(b.heard * 100)}%`}
          >
            <i style={{ height: `${(b.height * 100).toFixed(1)}%`, '--c': book.waveColor, '--o': barOpacity(b.heard).toFixed(2) }} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `src/components/wave/FolderRow.jsx`**

```jsx
// "โฟลเดอร์ของฉัน" on Wave Home (spec 3.3): up to six top-level folders that
// hold sections, each with ▶ to play all of it. Hidden when all are empty.
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useFolderPlayback } from '../../hooks/useFolderPlayback';
import { getFolders } from '../../lib/folders';

const countOf = (f, folders) => (f.type === 'group'
  ? folders.filter(c => c.parentId === f.id).reduce((s, c) => s + c.sections.length, 0)
  : f.sections.length);

const TINTS = ['#E0773A', '#C24A3A', '#3D6FB6', '#2E9C8E', '#7B55B8', '#7F8F3A'];

export default function FolderRow() {
  const navigate = useNavigate();
  const { books } = useApp();
  const folders = getFolders();
  const { playLeaf, playGroup, isPlayingSource } = useFolderPlayback({ books, folders });
  const list = folders.filter(f => !f.parentId && countOf(f, folders) > 0).slice(0, 6);
  if (!list.length) return null;

  return (
    <>
      <div className="wv-sech">
        <h3>โฟลเดอร์ของฉัน</h3>
        <button type="button" onClick={() => navigate('/select', { state: { view: 'folders' } })}>ดูทั้งหมด</button>
      </div>
      <div className="wv-hscroll">
        {list.map((f, i) => {
          const tint = TINTS[i % TINTS.length];
          const source = f.type === 'group' ? `group:${f.id}` : `leaf:${f.id}`;
          return (
            <div key={f.id} className="wv-fcard">
              <span className="wv-fico" style={{ background: `${tint}22`, color: tint }} aria-hidden="true">
                {f.readOnly ? '?' : f.type === 'group' ? '◆' : f.name.slice(0, 1)}
              </span>
              <span className="wv-fname">{f.name}</span>
              <span className="wv-frow">
                <span className="wv-fcount">{countOf(f, folders).toLocaleString()} มาตรา</span>
                <button
                  type="button"
                  className="wv-fplay tap-btn"
                  onClick={() => (f.type === 'group' ? playGroup(f.id) : playLeaf(f))}
                  aria-label={`${isPlayingSource(source) ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'} ${f.name}`}
                >
                  {isPlayingSource(source) ? '■' : '▶'}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 3: สร้าง `src/components/wave/WaveLibrary.jsx`**

```jsx
// "ห้องสมุดเสียง" (spec 3.4): every law as a waveform. The four codes get tall
// rows, the Constitution and the acts thin ones. The header opens the law;
// a bar opens Select at the chapter its first section is in.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import WaveBars from './WaveBars';
import { getAllStats } from '../../lib/stats';
import { showToast } from '../../lib/toast';
import { CODE_BOOK_IDS } from '../../data/lawMeta';

export default function WaveLibrary() {
  const navigate = useNavigate();
  const { books } = useApp();
  const { playing, currentItem } = useTts();
  // A section counts as heard once it has started (stats.js), so this is
  // re-read whenever a section starts or playback stops.
  const heard = useMemo(() => new Set(Object.keys(getAllStats())), [playing, currentItem?.sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const codes = books.filter(b => CODE_BOOK_IDS.includes(b.id));
  const acts = books.filter(b => !CODE_BOOK_IDS.includes(b.id));

  const pct = (b) => {
    const n = b.sections?.length || 0;
    return n ? Math.round((b.sections.filter(s => heard.has(s.id)).length / n) * 100) : 0;
  };
  const openBook = (b) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate(`/code/${b.id}`);
  };
  const openAt = (b, index) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate('/select', { state: { bookId: b.id, sectionNumber: b.sections[index].number } });
  };

  const row = (b, thin) => (
    <div key={b.id} className={`wv-wrow${thin ? ' is-thin' : ''}`}>
      <button type="button" className="wv-whead tap-btn" onClick={() => openBook(b)}>
        <i className="wv-dot" style={{ background: b.waveColor }} />
        <span className="wv-wtitle">{thin ? (b.displayName ?? b.fullName) : b.fullName}</span>
        <span className="wv-wpct">{pct(b)}%</span>
      </button>
      <WaveBars book={b} heard={heard} nBars={thin ? 28 : 40} height={thin ? 18 : 32} onBar={(i) => openAt(b, i)} dim={!b.available} />
    </div>
  );

  return (
    <>
      <div className="wv-sech"><h3>ห้องสมุดเสียง</h3><span>แตะแท่งคลื่นเพื่อไปที่หมวดนั้น</span></div>
      <div className="wv-legend">
        <span><i style={{ background: 'var(--w-track)' }} />ยังไม่ฟัง</span>
        <span><i style={{ background: 'rgb(var(--c-ochre))' }} />ฟังแล้ว (สีประจำฉบับ)</span>
        <span>ความสูง = ความยาวเสียง</span>
      </div>
      {codes.map(b => row(b, false))}
      <div className="wv-sech is-sub"><h3>รัฐธรรมนูญและพระราชบัญญัติ</h3><span>{acts.length} ฉบับ</span></div>
      {acts.map(b => row(b, true))}
    </>
  );
}
```

- [ ] **Step 4: สร้าง `src/screens/WaveHome.jsx`**

```jsx
// Wave theme's Home (spec 3): the dark stage with Lady Justice, the user's
// folders, then every law as a waveform.
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';
import VoiceNewsCard from '../components/VoiceNewsCard';
import WaveHero from '../components/wave/WaveHero';
import FolderRow from '../components/wave/FolderRow';
import WaveLibrary from '../components/wave/WaveLibrary';

export default function WaveHome() {
  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui overflow-hidden">
      <AdBanner />
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        <WaveHero />
        <VoiceNewsCard />
        <FolderRow />
        <WaveLibrary />
      </div>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 5: สไตล์ใน `src/styles/wave.css`**

ต่อท้ายไฟล์:

```css
/* ── Home sections ──────────────────────────────────────────────────────── */
.wv-sech { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 20px 18px 8px; }
.wv-sech h3 { margin: 0; font: 700 15px var(--f-display); }
.wv-sech span, .wv-sech button { font: 400 11px var(--f-ui); color: rgb(var(--c-ink-soft)); }
html.dark .wv-sech span { color: rgb(var(--c-rule-soft)); }
.wv-sech button { color: rgb(var(--c-accent)); font-weight: 600; }
.wv-sech.is-sub { padding-top: 12px; }
.wv-sech.is-sub h3 { font-size: 13.5px; }
.wv-hscroll { display: flex; gap: 10px; overflow-x: auto; padding: 2px 16px 6px; scrollbar-width: none; }
.wv-hscroll::-webkit-scrollbar { display: none; }
.wv-fcard { flex: none; width: 132px; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px;
  background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-fico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
.wv-fname { font: 600 13px/1.3 var(--f-ui); min-height: 34px; }
.wv-frow { display: flex; align-items: center; justify-content: space-between; }
.wv-fcount { font-size: 10.5px; color: rgb(var(--c-ink-soft)); }
html.dark .wv-fcount { color: rgb(var(--c-rule-soft)); }
.wv-fplay { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 10px;
  background: var(--w-golds); color: rgb(var(--c-accent)); }
.wv-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0 18px 10px; font-size: 10.5px; color: rgb(var(--c-ink-soft)); }
html.dark .wv-legend { color: rgb(var(--c-rule-soft)); }
.wv-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; margin-right: 5px; }
.wv-wrow { margin: 0 16px 10px; padding: 11px 13px 10px; border-radius: 18px; background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-wrow.is-thin { padding: 9px 13px 8px; margin-bottom: 8px; border-radius: 15px; }
.wv-whead { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; }
.wv-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.wv-wtitle { flex: 1; min-width: 0; font: 600 13px var(--f-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wv-wrow.is-thin .wv-wtitle { font-size: 12px; }
.wv-wpct { font-size: 11px; color: rgb(var(--c-ink-soft)); font-variant-numeric: tabular-nums; }
html.dark .wv-wpct { color: rgb(var(--c-rule-soft)); }
.wv-bars { display: flex; align-items: flex-end; gap: 2px; margin-top: 7px; }
.wv-wrow.is-thin .wv-bars { margin-top: 5px; }
.wv-bars.is-dim { opacity: 0.4; }
.wv-bar { flex: 1; min-width: 0; height: 100%; display: flex; align-items: flex-end; padding: 0; border: 0; background: none; }
.wv-bar i { display: block; width: 100%; border-radius: 2px; background: var(--w-track); position: relative; overflow: hidden; }
.wv-bar i::after { content: ''; position: absolute; inset: 0; background: var(--c); opacity: var(--o, 0); }
.wv-bar:focus-visible i { outline: 1.5px solid rgb(var(--c-accent)); outline-offset: 1px; }
.wv-bar.is-flash i { animation: wv-flash 1s ease-out; }
@keyframes wv-flash { from { box-shadow: 0 0 0 4px rgb(var(--c-ochre)); } to { box-shadow: 0 0 0 0 transparent; } }
```

- [ ] **Step 6: ซ่อน `TtsPlayer` บนหน้าแรกของ Wave**

ใน `src/components/TtsPlayer.jsx` เพิ่ม import:

```js
import { useApp } from '../context/AppContext';
import { resolveTheme } from '../lib/theme';
```

ต่อจากบรรทัด `const { pathname } = useLocation();` เพิ่ม:

```js
  const { settings } = useApp();
  // On Wave's Home the hero is the player (spec 3.1); the quota prompt still
  // shows, since the hero cannot.
  const hideOnWaveHome = resolveTheme(settings) === 'wave' && pathname === '/';
```

แล้วก่อนบล็อก comment `// Quota-exceeded prompt takes over the bar` (ต่อจาก `const handleReward = …` ซึ่งเป็นจุดที่ hook ทั้งหมดถูกเรียกครบแล้ว) เพิ่ม:

```js
  if (hideOnWaveHome && !quotaBlocked) return null;
```

- [ ] **Step 7: เลือกหน้าแรกตามธีมใน `src/App.jsx`**

เพิ่ม import:

```js
import WaveHome from './screens/WaveHome';
import { resolveTheme } from './lib/theme';
```

(รวม `resolveTheme` เข้ากับบรรทัด import ของ `./lib/theme` ที่มีอยู่แล้วจาก Task 2)

เพิ่มเหนือ `function AppRoutes()`:

```jsx
// Home and Select have their own Wave screens (spec 2.7); every other route
// is shared and follows the theme through the CSS tokens.
function ThemedScreen({ classic: Classic, wave: Wave }) {
  const { settings } = useApp();
  return resolveTheme(settings) === 'wave' ? <Wave /> : <Classic />;
}
```

เปลี่ยน `<Route path="/" element={<HomeScreen />} />` เป็น:

```jsx
            <Route path="/" element={<ThemedScreen classic={HomeScreen} wave={WaveHome} />} />
```

- [ ] **Step 8: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 9: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

เปิด `/` ที่ขนาด mobile ทั้งโหมดสว่างและมืด แล้วเทียบกับต้นแบบ:
- **hero:** เป็นการ์ดสีเข้มทั้งสองโหมด
- **เทพี:**
  - ตอนหยุด หูฟังแขวนบนตะขอ
  - แตะแล้วหูฟังลอยโค้งขึ้นไปสวมหัว คลื่นทองขึ้นที่หู แท่งปัจจุบันเต้น
  - แตะอีกครั้งหูฟังลอยกลับ
  - เปลี่ยนมาตราระหว่างเล่นต้องไม่ทำให้แอนิเมชันเล่นซ้ำ
- **สถานะของ hero:** ตรงตามตาราง spec 3.1 ลองทั้งตอนไม่มีประวัติ, มีประวัติ, มีคิวค้าง, กำลังเล่น, หยุดชั่วคราว และคิวจบ
- **แถบเล่นเสียงด้านล่าง:** ไม่ขึ้นบนหน้าแรก แต่ขึ้นเมื่อไปหน้าอื่น
- **แถวโฟลเดอร์:** ปุ่ม ▶ เล่นทั้งโฟลเดอร์ แล้ว hero แสดงชื่อโฟลเดอร์
- **ห้องสมุด:**
  - แตะชื่อฉบับเปิด `/code/:id`
  - แตะแท่งไป `/select` (ยังเป็นหน้า Classic จนถึง Task 11 ข้อมูล state ที่ส่งไปจะถูกใช้ใน Task 11)
- **ลดการเคลื่อนไหว:** เปิดแล้วภาพสลับทันที ไม่มีการลอย
- console ไม่มี error
- สลับเป็น Classic แล้วหน้าแรกเป็นแบบเดิม

- [ ] **Step 10: Commit**

```bash
git add src/components/wave/WaveBars.jsx src/components/wave/FolderRow.jsx src/components/wave/WaveLibrary.jsx src/screens/WaveHome.jsx src/App.jsx src/components/TtsPlayer.jsx src/styles/wave.css
git commit -m "feat(wave): Home — hero, folders and the waveform library

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Popup โฟลเดอร์ (`lib/folderPicker.js` + `FolderPickerSheet`)

**Files:**
- Create: `src/lib/folderPicker.js`, `src/lib/folderPicker.test.js`, `src/components/wave/FolderPickerSheet.jsx`
- Modify: `src/styles/wave.css`

**Interfaces:**
- Consumes: `getFolders`, `addSectionsToFolder`, `addSectionsToGroup`, `removeSectionFromFolder`, `createFolder` จาก `src/lib/folders.js`; `BottomSheet` (`({ height, onClose, children })` โดย `children` เป็นฟังก์ชันรับ `{ dragHandlers }` ได้)
- Produces:
  - `getRecentIds() → string[]`, `pushRecent(ids)`
  - `pickerLists(folders = getFolders()) → { recent, groups, mine }`
  - `alreadyIn(folder, sections, folders = getFolders()) → section[]`
  - `sectionCount(folder, folders = getFolders()) → number`
  - `addToFolders(folderIds, sections) → { folderIds: string[], added: { folderId, sectionId }[] }`
  - `undoAdd(added)`
  - `<FolderPickerSheet sections isPro onNeedPro onClose onAdded />` โดย `onAdded(result)` ได้ค่าจาก `addToFolders`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/folderPicker.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sync/dirty', () => ({ markDirty: () => {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getFolders, createFolder, addSectionsToFolder, deleteFolder } = await import('./folders.js');
const {
  getRecentIds, pushRecent, pickerLists, alreadyIn, sectionCount, addToFolders, undoAdd,
} = await import('./folderPicker.js');

const sec = (n, bookId = 'criminal') => ({ sectionId: `${bookId}-${n}`, bookId, number: String(n), title: `มาตรา ${n}` });
const idsIn = (id) => getFolders().find(f => f.id === id).sections.map(s => s.sectionId);

describe('folder picker', () => {
  beforeEach(() => store.clear());

  it('adds to several folders at once and reports only what was new', () => {
    const a = createFolder('สอบเนติ');
    const b = createFolder('ก่อนนอน');
    addSectionsToFolder(a.id, [sec(288)]);
    const res = addToFolders([a.id, b.id], [sec(288), sec(289)]);
    expect(idsIn(a.id)).toEqual(['criminal-288', 'criminal-289']);
    expect(idsIn(b.id)).toEqual(['criminal-288', 'criminal-289']);
    expect(res.folderIds).toEqual([a.id, b.id]);
    expect(res.added).toEqual([
      { folderId: a.id, sectionId: 'criminal-289' },
      { folderId: b.id, sectionId: 'criminal-288' },
      { folderId: b.id, sectionId: 'criminal-289' },
    ]);
  });

  it('undo removes only what that add put in', () => {
    const a = createFolder('สอบเนติ');
    addSectionsToFolder(a.id, [sec(288)]);
    const res = addToFolders([a.id], [sec(288), sec(289)]);
    undoAdd(res.added);
    expect(idsIn(a.id)).toEqual(['criminal-288']);
  });

  it('a stats group routes each section into its book\'s leaf', () => {
    const res = addToFolders(['grp-nethi'], [sec(288), sec(420, 'civil')]);
    expect(idsIn('grp-nethi-criminal')).toEqual(['criminal-288']);
    expect(idsIn('grp-nethi-civil')).toEqual(['civil-420']);
    expect(res.added).toHaveLength(2);
    expect(sectionCount(getFolders().find(f => f.id === 'grp-nethi'))).toBe(2);
  });

  it('skips a folder deleted in the meantime', () => {
    const a = createFolder('หายไป');
    deleteFolder(a.id);
    expect(addToFolders([a.id], [sec(1)])).toEqual({ folderIds: [], added: [] });
  });

  it('knows which chosen sections a folder already has', () => {
    const a = createFolder('x');
    addSectionsToFolder(a.id, [sec(288)]);
    const f = getFolders().find(x => x.id === a.id);
    expect(alreadyIn(f, [sec(288), sec(289)]).map(s => s.number)).toEqual(['288']);
  });

  it('recent keeps three, newest first, without repeats', () => {
    pushRecent(['a']);
    pushRecent(['b', 'c']);
    pushRecent(['d']);
    pushRecent(['b']);
    expect(getRecentIds()).toEqual(['b', 'd', 'c']);
  });

  it('lists only folders that can take sections, recent first and not repeated', () => {
    const mine = createFolder('ของฉัน');
    const gone = createFolder('ลบแล้ว');
    pushRecent([gone.id, 'grp-judge']);
    deleteFolder(gone.id);
    const { recent, groups, mine: own } = pickerLists();
    expect(recent.map(f => f.id)).toEqual(['grp-judge']);
    expect(groups.map(f => f.id)).toEqual(['grp-nethi', 'grp-attorney']);
    expect(own.map(f => f.id)).toEqual([mine.id]);
    expect([...recent, ...groups, ...own].map(f => f.id)).not.toContain('grp-forgotten');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/folderPicker.test.js`
Expected: FAIL "Failed to resolve import ./folderPicker.js"

- [ ] **Step 3: เขียน `src/lib/folderPicker.js`**

```js
// The "เพิ่มใน…" sheet on Wave's Select screen (spec 5.2): add the ticked
// sections to several folders at once, undo exactly that, and remember the
// folders used last. Recent ids live in their own key so the synced folder
// list — which older app versions also read — keeps its schema.
import { getFolders, addSectionsToFolder, addSectionsToGroup, removeSectionFromFolder } from './folders';

const RECENT_KEY = 'lawcode-th-folder-recent';
const RECENT_MAX = 3;
const STATS_GROUPS = ['grp-nethi', 'grp-attorney', 'grp-judge'];

export function getRecentIds() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function pushRecent(ids) {
  const next = [...ids, ...getRecentIds().filter(id => !ids.includes(id))].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
}

// Folders that can take sections by hand: the three stats groups and the
// user's own top-level folders. "จำไม่ได้" and other read-only ones are filled
// by the app and never offered.
export function pickerLists(folders = getFolders()) {
  const usable = (f) => f && !f.readOnly && !f.parentId
    && (f.type === 'group' ? STATS_GROUPS.includes(f.id) : true);
  const byId = new Map(folders.map(f => [f.id, f]));
  const recent = getRecentIds().map(id => byId.get(id)).filter(usable);
  const inRecent = new Set(recent.map(f => f.id));
  const rest = folders.filter(f => usable(f) && !inRecent.has(f.id));
  return {
    recent,
    groups: rest.filter(f => f.type === 'group'),
    mine: rest.filter(f => f.type !== 'group'),
  };
}

const sectionsOf = (folder, folders) => (folder.type === 'group'
  ? folders.filter(f => f.parentId === folder.id).flatMap(f => f.sections)
  : folder.sections);

export function alreadyIn(folder, sections, folders = getFolders()) {
  const ids = new Set(sectionsOf(folder, folders).map(s => s.sectionId));
  return sections.filter(s => ids.has(s.sectionId));
}

export function sectionCount(folder, folders = getFolders()) {
  return sectionsOf(folder, folders).length;
}

function snapshot() {
  return new Map(getFolders().map(f => [f.id, new Set((f.sections || []).map(s => s.sectionId))]));
}

// What was added is found by comparing before and after, so a group's
// per-book leaves — including one made on demand — are covered too.
export function addToFolders(folderIds, sections) {
  const before = snapshot();
  const folders = getFolders();
  const done = [];
  for (const id of folderIds) {
    const f = folders.find(x => x.id === id);
    if (!f || f.readOnly) continue;
    if (f.type === 'group') addSectionsToGroup(id, sections);
    else addSectionsToFolder(id, sections);
    done.push(id);
  }
  const added = [];
  for (const f of getFolders()) {
    const had = before.get(f.id) || new Set();
    for (const s of f.sections || []) {
      if (!had.has(s.sectionId)) added.push({ folderId: f.id, sectionId: s.sectionId });
    }
  }
  if (done.length) pushRecent(done);
  return { folderIds: done, added };
}

export function undoAdd(added) {
  for (const a of added) removeSectionFromFolder(a.folderId, a.sectionId);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/folderPicker.test.js`
Expected: PASS 7 tests

ถ้าเทสต์ "lists only folders…" ได้ลำดับ `groups` ต่างจากที่คาด ให้ดูลำดับจริงจาก `getFolders()` (permanent groups เรียงตาม `PERM_GROUPS`) แล้วแก้ค่าที่คาดในเทสต์ อย่าแก้ `folders.js`

- [ ] **Step 5: สร้าง `src/components/wave/FolderPickerSheet.jsx`**

```jsx
// "เพิ่ม N มาตราใน…" — slides up from the bottom after "＋ เพิ่ม" (spec 5.2).
// Several folders can be ticked; the button adds to all of them at once.
import { useMemo, useState } from 'react';
import BottomSheet from '../BottomSheet';
import { createFolder, getFolders } from '../../lib/folders';
import { addToFolders, alreadyIn, pickerLists, sectionCount } from '../../lib/folderPicker';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? bookId;

export default function FolderPickerSheet({ sections, isPro, onNeedPro, onClose, onAdded }) {
  const [folders, setFolders] = useState(() => getFolders());
  const [checked, setChecked] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const lists = useMemo(() => pickerLists(folders), [folders]);
  const books = [...new Set(sections.map(s => s.bookId))].map(labelOf).join(', ');

  const toggle = (id) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const f = createFolder(name);
    setFolders(getFolders());
    setChecked(prev => new Set(prev).add(f.id));
    setCreating(false);
    setNewName('');
  };

  const confirm = () => {
    onAdded(addToFolders([...checked], sections));
    onClose();
  };

  const row = (f) => {
    const on = checked.has(f.id);
    const have = alreadyIn(f, sections, folders);
    const sub = f.type === 'group' ? `จะลงใน › ${books}` : `${sectionCount(f, folders)} มาตรา`;
    const note = have.length ? ` · มี ม.${have[0].number}${have.length > 1 ? ` และอีก ${have.length - 1}` : ''} อยู่แล้ว` : '';
    return (
      <button key={f.id} onClick={() => toggle(f.id)} role="checkbox" aria-checked={on}
        className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left">
        <span className="wv-folder-icon" aria-hidden="true">{f.type === 'group' ? '◆' : f.name.slice(0, 1)}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-ui text-[14px] font-semibold truncate">{f.name}</span>
          <span className="block font-ui text-[11px] text-ink-soft dark:text-rule-soft truncate">{sub}{note}</span>
        </span>
        <span className={`wv-check${on ? ' is-on' : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>
      </button>
    );
  };

  const section = (title, list) => list.length > 0 && (
    <div key={title}>
      <div className="px-5 pt-3 pb-1 font-ui text-[11px] font-semibold tracking-[0.06em] text-ink-soft dark:text-rule-soft">{title}</div>
      {list.map(row)}
    </div>
  );

  return (
    <BottomSheet height="82%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-2 flex items-baseline select-none flex-shrink-0" {...dragHandlers}>
            <span className="font-display text-[17px] font-bold">เพิ่ม {sections.length} มาตราใน…</span>
            <span className="ml-auto font-ui text-[11px] text-ink-soft dark:text-rule-soft">เลือกได้หลายโฟลเดอร์</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {section('ใช้ล่าสุด', lists.recent)}
            {section('สถิติ · แยกลงตามฉบับให้เอง', lists.groups)}
            {section('โฟลเดอร์ของฉัน', lists.mine)}
            {creating ? (
              <div className="flex items-center gap-2 px-5 py-2.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') create(); }}
                  placeholder="ชื่อโฟลเดอร์ใหม่"
                  className="wv-input flex-1"
                />
                <button onClick={create} className="tap-btn font-ui text-accent text-[13px] font-bold px-2">สร้าง</button>
              </div>
            ) : (
              <button
                onClick={() => (isPro ? setCreating(true) : onNeedPro())}
                className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left text-accent"
              >
                <span className="wv-folder-icon is-new" aria-hidden="true">＋</span>
                <span className="font-ui text-[14px] font-semibold">โฟลเดอร์ใหม่…</span>
                {!isPro && <span className="wv-pro">PRO</span>}
              </button>
            )}
          </div>
          <div className="px-4 pt-2 pb-3 flex-shrink-0">
            <button
              onClick={confirm}
              disabled={!checked.size}
              className="tap-btn w-full h-12 rounded-full bg-ochre text-[#1D1404] font-ui text-[14px] font-bold disabled:opacity-40"
            >
              {checked.size ? `เพิ่มใน ${checked.size} โฟลเดอร์` : 'เลือกโฟลเดอร์'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 6: สไตล์ใน `src/styles/wave.css`**

ต่อท้ายไฟล์:

```css
/* ── Folders, checks and inputs ─────────────────────────────────────────── */
.wv-folder-icon { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0;
  font: 700 14px var(--f-ui); background: var(--w-golds); color: rgb(var(--c-accent)); }
.wv-folder-icon.is-new { background: transparent; border: 1.5px dashed rgb(var(--c-ochre)); }
.wv-check { width: 21px; height: 21px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center;
  font: 700 11px var(--f-ui); color: transparent; border: 1.5px solid rgb(var(--c-ink-soft)); opacity: 0.7; }
html.dark .wv-check { border-color: rgb(var(--c-rule-soft)); }
.wv-check.is-on, .wv-check.is-some { background: rgb(var(--c-ochre)); border-color: rgb(var(--c-ochre)); color: #1D1404; opacity: 1; }
.wv-pro { font: 700 9px var(--f-ui); padding: 2px 6px; border-radius: 6px; background: rgb(var(--c-ochre)); color: #1D1404; }
.wv-input { height: 40px; border-radius: 20px; padding: 0 14px; font: 400 13.5px var(--f-ui); color: rgb(var(--c-ink));
  background: rgb(var(--c-card)); border: 1px solid rgb(var(--c-rule)); outline: none; }
html.dark .wv-input { color: rgb(var(--c-paper)); }
.wv-input:focus { border-color: rgb(var(--c-ochre)); }
```

- [ ] **Step 7: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 8: Commit**

```bash
git add src/lib/folderPicker.js src/lib/folderPicker.test.js src/components/wave/FolderPickerSheet.jsx src/styles/wave.css
git commit -m "feat(wave): folder picker sheet — several folders, undo, recent first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: หน้าเลือกฟัง Wave

**Files:**
- Create: `src/components/wave/FoldersView.jsx`, `src/screens/WaveSelect.jsx`
- Modify: `src/App.jsx`, `src/styles/wave.css`

**Interfaces:**
- Consumes:
  - hook ทั้งสามจาก Task 7, `keyOf` จาก `src/lib/selection.js`
  - `tocNodeKey` / `nodeShortLabel` / `sectionsInRange` จาก `src/lib/toc.js`
  - `pathToSection` (Task 6), `WaveBars` (Task 9)
  - `FolderPickerSheet` และ `undoAdd` (Task 10), `showToast(msg, { action })` (Task 4)
  - `FolderEditModal({ folder, onClose, onChanged })`, `ProGateModal({ title, body, onClose })`, `SignInGateModal({ state, feature, onClose })`, `gateContentFor(state, 'folder')`, `ThemedScreen` (Task 9)
  - `location.state` จากหน้าแรก: `{ bookId, sectionNumber }` หรือ `{ view: 'folders' }`
- Produces: `WaveSelect` (default export), `<FoldersView folders play onEdit />`

- [ ] **Step 1: สร้าง `src/components/wave/FoldersView.jsx`**

```jsx
// "โฟลเดอร์ของฉัน" on Wave's Select screen (spec 5.3): every folder as a card
// with ▶ to play all of it; stats groups open into per-book chips.
import { LAW_BOOKS_META } from '../../data/lawMeta';

const metaOf = (id) => LAW_BOOKS_META.find(m => m.id === id);

function PlayButton({ source, play, onPress, disabled }) {
  const on = play.isPlayingSource(source);
  return (
    <button onClick={onPress} disabled={disabled} className="tap-btn wv-circle" aria-label={on ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'}>
      {on ? '■' : '▶'}
    </button>
  );
}

export default function FoldersView({ folders, play, onEdit }) {
  const top = folders.filter(f => !f.parentId);
  const childrenOf = (id) => folders.filter(f => f.parentId === id);
  const hasOwn = top.some(f => f.type !== 'group');

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {top.map(f => {
        if (f.type === 'group') {
          const kids = childrenOf(f.id).filter(c => c.sections.length);
          const total = kids.reduce((sum, c) => sum + c.sections.length, 0);
          return (
            <div key={f.id} className="wv-card mx-4 mt-2.5 p-3.5">
              <div className="flex items-center gap-3">
                <span className="wv-folder-icon" aria-hidden="true">{f.readOnly ? '?' : '◆'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-ui text-[14px] font-semibold truncate">{f.name}</div>
                  <div className="font-ui text-[11.5px] text-ink-soft dark:text-rule-soft">{f.readOnly ? 'อัตโนมัติ · ' : ''}{kids.length} ฉบับ · {total} มาตรา</div>
                </div>
                <PlayButton source={`group:${f.id}`} play={play} onPress={() => play.playGroup(f.id)} disabled={!total} />
              </div>
              {kids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {kids.map(c => (
                    <button key={c.id} onClick={() => play.playLeaf(c)} className="tap-btn wv-kid">
                      <i style={{ background: metaOf(c.bookId)?.waveColor }} />
                      {metaOf(c.bookId)?.shortLabel ?? c.name} {c.sections.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={f.id} className="wv-card mx-4 mt-2.5 p-3.5 flex items-center gap-3">
            <button onClick={() => onEdit(f)} className="tap-row flex-1 min-w-0 flex items-center gap-3 text-left">
              <span className="wv-folder-icon" aria-hidden="true">{f.name.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block font-ui text-[14px] font-semibold truncate">{f.name}</span>
                <span className="block font-ui text-[11.5px] text-ink-soft dark:text-rule-soft">{f.sections.length} มาตรา</span>
              </span>
            </button>
            <PlayButton source={`leaf:${f.id}`} play={play} onPress={() => play.playLeaf(f)} disabled={!f.sections.length} />
          </div>
        );
      })}
      {!hasOwn && (
        <p className="font-ui text-[12.5px] text-ink-soft dark:text-rule-soft mt-4 px-6 text-center">
          ยังไม่มีโฟลเดอร์ของตัวเอง ติ๊กมาตราแล้วกด "＋ เพิ่ม" เพื่อสร้าง
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `src/screens/WaveSelect.jsx`**

```jsx
// Wave theme's Select screen (spec 5): book chips, the chosen law's waveform
// (a bar jumps to its chapter), table-of-contents cards to zoom through, then
// tick sections and "＋ เพิ่ม" opens the folder sheet. Logic is shared with
// Classic's SelectScreen through hooks.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import TabBar from '../components/TabBar';
import FolderEditModal from '../components/FolderEditModal';
import ProGateModal from '../components/ProGateModal';
import SignInGateModal from '../components/SignInGateModal';
import WaveBars from '../components/wave/WaveBars';
import FolderPickerSheet from '../components/wave/FolderPickerSheet';
import FoldersView from '../components/wave/FoldersView';
import { useTocNavigation } from '../hooks/useTocNavigation';
import { useSectionSelection } from '../hooks/useSectionSelection';
import { useFolderPlayback } from '../hooks/useFolderPlayback';
import { getFolders } from '../lib/folders';
import { undoAdd } from '../lib/folderPicker';
import { getAllMemory } from '../lib/memory';
import { getAllStats } from '../lib/stats';
import { keyOf } from '../lib/selection';
import { nodeShortLabel, sectionsInRange, tocNodeKey } from '../lib/toc';
import { pathToSection } from '../lib/wave';
import { cleanTitle } from '../lib/sectionText';
import { showToast } from '../lib/toast';

// Remembered = green, forgotten = orange — the same as Classic.
function memColor(mem) {
  if (mem === 'remembered') return '#2d8c4a';
  if (mem === 'forgotten') return '#e8821e';
  return undefined;
}

function Check({ state }) {
  return (
    <span className={`wv-check${state === 'all' ? ' is-on' : state === 'some' ? ' is-some' : ''}`} aria-hidden="true">
      {state === 'all' ? '✓' : state === 'some' ? '–' : ''}
    </span>
  );
}

export default function WaveSelect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { books, loadingData } = useApp();
  const { isPro, state: proAccessState } = useProAccess();

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(() => location.state?.bookId ?? null);
  const activeBook = available.find(b => b.id === activeBookId) || available[0];

  const [filter, setFilter] = useState('');
  const [folders, setFolders] = useState(() => getFolders());
  const [view, setView] = useState(() => (location.state?.view === 'folders' ? 'folders' : 'browse'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proHint, setProHint] = useState(false);
  const [editFolder, setEditFolder] = useState(null);
  const [memory] = useState(() => getAllMemory());
  const [heard] = useState(() => new Set(Object.keys(getAllStats())));
  const refreshFolders = () => setFolders(getFolders());

  const toc = useTocNavigation({ activeBook, filter });
  const sel = useSectionSelection({ activeBook, visibleSections: toc.visibleSections });
  const play = useFolderPlayback({ books, folders, selectedList: sel.selectedList });

  // A bar tapped on Home (or here) opens at its chapter once the TOC is in.
  const [jump, setJump] = useState(() => location.state?.sectionNumber ?? null);
  const [flashFrom, setFlashFrom] = useState(null);
  useEffect(() => {
    if (jump == null || !activeBook || !toc.tocLoaded[activeBook.id]) return;
    const path = pathToSection(toc.toc, jump);
    toc.setTocPath(path);
    const last = path[path.length - 1];
    showToast(`ไปที่ ${activeBook.shortLabel}${last ? ` · ${nodeShortLabel(last)}` : ''} (ม.${jump})`);
    setJump(null);
    // Drop the one-off state so Back and re-renders do not jump again.
    navigate('.', { replace: true, state: null });
  }, [jump, activeBook?.id, toc.tocLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back one level by swiping in from the left edge.
  const edge = useRef(null);
  const chipRow = useRef(null);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeBook?.id]);

  if (loadingData || !activeBook) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui">
        <div className="flex-1 grid place-items-center text-[14px] text-ink-soft dark:text-rule-soft">กำลังโหลด…</div>
        <TabBar />
      </div>
    );
  }

  const pickBook = (id) => { setActiveBookId(id); setFilter(''); setFlashFrom(null); };
  const node = toc.tocPath[toc.tocPath.length - 1];
  const searching = !!filter.trim();
  const bookName = activeBook.displayName ?? activeBook.fullName;
  const pctHeard = Math.round((activeBook.sections.filter(s => heard.has(s.id)).length / activeBook.sections.length) * 100);
  const scopeSections = node ? sectionsInRange(activeBook, node.range) : activeBook.sections;
  const scopeSource = node ? `node:${activeBook.id}:${tocNodeKey(node, 0)}` : `book:${activeBook.id}`;
  const playScope = () => play.playRefs(
    scopeSource,
    node ? `${activeBook.shortLabel} ${nodeShortLabel(node)}` : bookName,
    scopeSections.map(s => ({ bookId: activeBook.id, sectionId: s.id })),
    node ? 'หมวดนี้ยังไม่มีมาตรา' : 'ฉบับนี้ยังไม่มีมาตรา',
  );

  const onAdded = (res) => {
    const n = sel.selectedList.length;
    sel.setSelected({});
    refreshFolders();
    if (!res.folderIds.length) { showToast('ไม่พบโฟลเดอร์ที่เลือก'); return; }
    if (!res.added.length) { showToast('ทุกมาตรามีอยู่ในโฟลเดอร์ที่เลือกแล้ว'); return; }
    showToast(`เพิ่ม ${n} มาตราใน ${res.folderIds.length} โฟลเดอร์แล้ว`, {
      action: { label: 'เลิกทำ', onPress: () => { undoAdd(res.added); refreshFolders(); } },
    });
  };

  const sectionRows = toc.visibleSections.map((s, idx) => {
    const on = !!sel.selected[keyOf(activeBook.id, s.id)];
    return (
      <button key={`${s.id}_${idx}`} onClick={() => sel.toggleSelect(s)}
        className="tap-row wv-srow w-full text-left flex items-center gap-3 px-[18px] py-[11px]">
        <Check state={on ? 'all' : 'none'} />
        <span className="wv-num">{s.number}</span>
        <span className={`flex-1 min-w-0 text-[13.5px] ${s.excerpt ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={{ color: memColor(memory[s.id]) }}>
          {cleanTitle(s.title) || '—'}
        </span>
        {heard.has(s.id) && <i className="wv-heard" style={{ background: activeBook.waveColor }} title="ฟังแล้ว" />}
      </button>
    );
  });

  let body;
  if (searching) {
    body = toc.visibleSections.length ? (
      <>
        <button onClick={sel.toggleSelectAll} className="tap-row wv-allrow w-full flex items-center gap-3 px-[18px] py-2.5">
          <Check state={sel.allSelected ? 'all' : sel.someSelected ? 'some' : 'none'} />
          <span className="text-[13px] font-semibold">{sel.allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</span>
          <span className="ml-auto text-[11.5px] text-ink-soft dark:text-rule-soft">{toc.visibleSections.length} รายการ</span>
        </button>
        {sectionRows}
      </>
    ) : (
      <div className="px-4 py-7 text-center text-[13px] text-ink-soft dark:text-rule-soft">ไม่พบมาตราที่ตรงกับ "{filter.trim()}"</div>
    );
  } else if (toc.atLeaf) {
    const st = sel.nodeSelectionState(node);
    body = (
      <>
        <div className="wv-allrow flex items-center gap-3 px-[18px] py-2.5">
          <button onClick={() => sel.selectAllInNode(node)} className="tap-row flex-1 flex items-center gap-3 text-left">
            <Check state={st.all ? 'all' : st.some ? 'some' : 'none'} />
            <span className="text-[13px] font-semibold">{st.all ? 'ยกเลิกทั้งหมวด' : 'เลือกทั้งหมวด'}</span>
            <span className="ml-auto text-[11.5px] text-ink-soft dark:text-rule-soft">{st.count}/{st.total}</span>
          </button>
          <button onClick={playScope} className="tap-btn wv-circle" aria-label="ฟังทั้งหมวด">
            {play.isPlayingSource(scopeSource) ? '■' : '▶'}
          </button>
        </div>
        {sectionRows}
      </>
    );
  } else if (!toc.currentNodes.length) {
    body = (
      <div className="px-4 py-7 text-center">
        {!toc.tocLoaded[activeBook.id] ? (
          <div className="text-[13px] text-ink-soft dark:text-rule-soft">กำลังโหลดสารบาญ…</div>
        ) : (
          <>
            <div className="text-[13px] text-ink-soft dark:text-rule-soft">โหลดสารบาญไม่สำเร็จ</div>
            <button onClick={toc.retryToc} className="tap-btn mt-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-accent text-accent">ลองใหม่</button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-[9px] px-4 pt-1.5 pb-3">
        {toc.currentNodes.map((n, idx) => (
          <button
            key={tocNodeKey(n, idx)}
            onClick={() => toc.setTocPath(p => [...p, n])}
            disabled={!n.children?.length && !n.range}
            className="tap-btn wv-tile text-left"
          >
            <b>{nodeShortLabel(n)}</b>
            {n.num && <span>{n.name}</span>}
            {n.range && <small>ม.{n.range.from}–{n.range.to}</small>}
          </button>
        ))}
        <button onClick={playScope} className="tap-btn wv-tile is-play text-left">
          <span className="wv-circle" aria-hidden="true">{play.isPlayingSource(scopeSource) ? '■' : '▶'}</span>
          <span>
            <b>{node ? 'ฟังทั้งหมวด' : 'ฟังทั้งฉบับ'}</b>
            <small>{scopeSections.length.toLocaleString()} มาตรา</small>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui overflow-hidden"
      onTouchStart={e => { const x = e.touches[0].clientX; edge.current = x < 24 ? x : null; }}
      onTouchEnd={e => {
        const start = edge.current;
        edge.current = null;
        if (start == null || view !== 'browse' || !toc.tocPath.length || searching) return;
        if (e.changedTouches[0].clientX - start > 60) toc.setTocPath(p => p.slice(0, -1));
      }}
    >
      <div className="flex items-center justify-between px-[18px] pt-3 pb-2 flex-shrink-0">
        <div className="font-display text-[22px] font-bold">{view === 'folders' ? 'โฟลเดอร์ของฉัน' : 'เลือกฟัง'}</div>
        <button
          data-tour="select-folders"
          onClick={() => setView(v => (v === 'folders' ? 'browse' : 'folders'))}
          className="tap-btn wv-iconbtn"
          aria-label={view === 'folders' ? 'กลับไปเลือกมาตรา' : 'โฟลเดอร์ของฉัน'}
        >
          {view === 'folders' ? '✕' : '📁'}
        </button>
      </div>

      {view === 'folders' ? (
        <FoldersView folders={folders} play={play} onEdit={setEditFolder} />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={chipRow} className="wv-chips flex-shrink-0">
            {available.map(b => (
              <button key={b.id} className="tap-btn wv-chip" aria-pressed={b.id === activeBook.id} onClick={() => pickBook(b.id)}>
                <i style={{ background: b.waveColor }} />{b.shortLabel}
              </button>
            ))}
          </div>
          <div className="wv-panel flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <b className="flex-1 min-w-0 truncate text-[14px]">{bookName}</b>
              <span className="text-[11px] text-ink-soft dark:text-rule-soft">ฟังแล้ว {pctHeard}%</span>
            </div>
            <WaveBars
              book={activeBook}
              heard={heard}
              nBars={40}
              height={54}
              onBar={(i) => { setFilter(''); setFlashFrom(i); setJump(activeBook.sections[i].number); }}
              flashFrom={flashFrom}
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-ink-soft dark:text-rule-soft tabular-nums">
              <span>ม.{activeBook.sections[0].number}</span>
              <span>แตะแท่งเพื่อไปที่หมวด</span>
              <span>ม.{activeBook.sections.at(-1).number}</span>
            </div>
          </div>
          {toc.tocPath.length > 0 && !searching && (
            <button onClick={() => toc.setTocPath(p => p.slice(0, -1))} className="tap-row flex items-center gap-1.5 px-[18px] pt-3 pb-0.5 text-left flex-shrink-0">
              <span className="text-accent text-[20px] leading-none" aria-hidden="true">‹</span>
              <span className="text-[12px] text-ink-soft dark:text-rule-soft truncate">{toc.tocPath.map(nodeShortLabel).join(' › ')}</span>
            </button>
          )}
          <label className="wv-search flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="ค้นเลขมาตรา หรือคำในฉบับนี้" type="search" />
          </label>
          <div data-tour="select-list" className="flex-1 overflow-y-auto pb-3">{body}</div>
          {sel.selectedList.length > 0 && (
            <div data-tour="select-bar" className="wv-selbar flex-shrink-0">
              <span>เลือก {sel.selectedList.length}</span>
              <button onClick={() => sel.setSelected({})} className="tap-btn wv-selbar-clear">ล้าง</button>
              <span className="flex-1" />
              <button onClick={() => setPickerOpen(true)} className="tap-btn wv-selbar-btn">＋ เพิ่ม</button>
              <button onClick={play.playSelected} className="tap-btn wv-selbar-btn is-primary">
                {play.isPlayingSource('selected') ? '■ หยุด' : '▶ ฟัง'}
              </button>
            </div>
          )}
        </div>
      )}

      <TabBar />

      {pickerOpen && (
        <FolderPickerSheet
          sections={sel.selectedList}
          isPro={isPro}
          onNeedPro={() => setProHint(true)}
          onClose={() => setPickerOpen(false)}
          onAdded={onAdded}
        />
      )}
      {editFolder && (
        <FolderEditModal
          folder={editFolder}
          onClose={() => setEditFolder(null)}
          onChanged={() => {
            refreshFolders();
            setEditFolder(getFolders().find(x => x.id === editFolder.id) || null);
          }}
        />
      )}
      {proHint && gateContentFor(proAccessState, 'folder')?.kind === 'buy' && (
        <ProGateModal
          title="สร้างโฟลเดอร์ — ฟีเจอร์ Pro"
          body="สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด"
          onClose={() => setProHint(false)}
        />
      )}
      {proHint && gateContentFor(proAccessState, 'folder')?.kind !== 'buy' && (
        <SignInGateModal state={proAccessState} feature="folder" onClose={() => setProHint(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: สไตล์ใน `src/styles/wave.css`**

ต่อท้ายไฟล์:

```css
/* ── Select ─────────────────────────────────────────────────────────────── */
.wv-iconbtn { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-chips { display: flex; gap: 7px; overflow-x: auto; padding: 2px 16px 10px; scrollbar-width: none; }
.wv-chips::-webkit-scrollbar { display: none; }
.wv-chip { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 9px; border-radius: 16px; white-space: nowrap;
  font: 600 12.5px var(--f-ui); background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-chip i { width: 9px; height: 9px; border-radius: 50%; display: block; }
.wv-chip[aria-pressed='true'] { background: rgb(var(--c-ink)); color: rgb(var(--c-paper)); }
html.dark .wv-chip[aria-pressed='true'] { background: rgb(var(--c-paper)); color: rgb(var(--c-ink)); }
.wv-panel { margin: 0 16px; padding: 13px 14px 11px; border-radius: 20px; background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-panel .wv-bars { gap: 3px; margin-top: 9px; }
.wv-search { margin: 10px 16px 6px; display: flex; align-items: center; gap: 8px; height: 40px; border-radius: 20px; padding: 0 14px;
  background: rgb(var(--c-card)); box-shadow: var(--w-shadow); color: rgb(var(--c-ink-soft)); }
.wv-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 400 13.5px var(--f-ui); color: inherit; }
html.dark .wv-search { color: rgb(var(--c-rule-soft)); }
html.dark .wv-search input { color: rgb(var(--c-paper)); }
.wv-tile { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 11px 12px; border-radius: 16px; background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-tile b { font: 700 13.5px var(--f-ui); }
.wv-tile span { font-size: 11.5px; line-height: 1.4; color: rgb(var(--c-ink-soft)); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wv-tile small { font-size: 10.5px; margin-top: auto; color: rgb(var(--c-ink-soft)); font-variant-numeric: tabular-nums; }
html.dark .wv-tile span, html.dark .wv-tile small { color: rgb(var(--c-rule-soft)); }
.wv-tile:disabled { opacity: 0.5; }
.wv-tile.is-play { flex-direction: row; align-items: center; gap: 10px; background: var(--w-golds); box-shadow: none; }
.wv-tile.is-play span { display: block; color: inherit; -webkit-line-clamp: unset; }
.wv-tile.is-play small { display: block; }
.wv-circle { width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 11px;
  background: rgb(var(--c-ochre)); color: #1D1404; }
.wv-circle:disabled { opacity: 0.35; }
.wv-srow { border-bottom: 1px solid rgb(var(--c-rule)); }
.wv-num { color: rgb(var(--c-accent)); font: 700 13.5px var(--f-ui); min-width: 40px; font-variant-numeric: tabular-nums; flex: none; }
.wv-heard { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.wv-allrow { background: var(--w-golds); border-bottom: 1px solid rgb(var(--c-rule)); }
.wv-selbar { margin: 0 12px 8px; height: 52px; border-radius: 26px; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 18px;
  font: 600 13px var(--f-ui); background: rgb(var(--c-ink)); color: rgb(var(--c-paper)); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28); }
html.dark .wv-selbar { background: rgb(var(--c-paper)); color: rgb(var(--c-ink)); }
.wv-selbar-clear { font-size: 12px; font-weight: 500; text-decoration: underline; opacity: 0.7; }
.wv-selbar-btn { padding: 9px 14px; border-radius: 20px; font-size: 12.5px; font-weight: 700; background: rgba(127, 127, 127, 0.18); white-space: nowrap; }
.wv-selbar-btn.is-primary { background: rgb(var(--c-ochre)); color: #1D1404; }
.wv-card { border-radius: 18px; background: rgb(var(--c-card)); box-shadow: var(--w-shadow); }
.wv-kid { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px 6px 8px; border-radius: 14px; font: 500 11.5px var(--f-ui);
  background: rgb(var(--c-paper)); border: 1px solid rgb(var(--c-rule)); }
html.dark .wv-kid { background: rgb(var(--c-dark-bg)); }
.wv-kid i { width: 8px; height: 8px; border-radius: 50%; display: block; }
```

- [ ] **Step 4: ต่อ route ใน `src/App.jsx`**

เพิ่ม import:

```js
import WaveSelect from './screens/WaveSelect';
```

เปลี่ยน `<Route path="/select" element={<SelectScreen />} />` เป็น:

```jsx
            <Route path="/select" element={<ThemedScreen classic={SelectScreen} wave={WaveSelect} />} />
```

- [ ] **Step 5: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 6: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

ใช้ธีม Wave ที่ขนาด mobile ตรวจทั้งสองโหมด:
- **จากหน้าแรก:** แตะแท่งคลื่นของอาญา → ต้องเปิดหน้าเลือกฟังที่อาญา ไล่ลงไปถึงหมวดของมาตรานั้น และมี toast "ไปที่ อาญา · หมวด …"
- **ชิปและคลื่น:** ชิปเปลี่ยนฉบับได้ และแตะแท่งในคลื่นของหน้านี้ก็ไปหมวดได้
- **สารบัญ:** ซูมการ์ดลงไปถึงระดับมาตรา แล้วย้อนกลับด้วยปุ่ม ‹ และด้วยการปัดจากขอบซ้าย
- **ติ๊ก:** ติ๊กมาตราข้ามสองฉบับ แถบลอยต้องนับรวมถูก
- **popup โฟลเดอร์:** "＋ เพิ่ม" แล้วติ๊กสองโฟลเดอร์ (หนึ่งในนั้นเป็นกลุ่มสถิติ) แล้วยืนยัน
  - toast ขึ้นพร้อม "เลิกทำ" กดแล้วมาตราที่เพิ่งเพิ่มหายไป แต่มาตราที่มีอยู่ก่อนยังอยู่
  - เปิดแผ่นอีกครั้ง โฟลเดอร์ที่เพิ่งใช้ต้องอยู่ใน "ใช้ล่าสุด"
- **Pro:** ผู้ใช้ที่ไม่ใช่ Pro กด "โฟลเดอร์ใหม่…" ต้องได้หน้าชวน Pro
- **โฟลเดอร์:** ปุ่ม 📁 และลิงก์ "ดูทั้งหมด" ในหน้าแรกเปิดมุมมองโฟลเดอร์ กด ▶ เล่นทั้งโฟลเดอร์ได้ กลับไปหน้าแรกแล้ว hero ต้องแสดงชื่อโฟลเดอร์
- console ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/components/wave/FoldersView.jsx src/screens/WaveSelect.jsx src/App.jsx src/styles/wave.css
git commit -m "feat(wave): Select — book chips, waveform jump, TOC cards, folder sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: เก็บงานหน้าที่ใช้ร่วมกันใน Wave และตรวจทั้งระบบ

**Files:**
- Modify: `src/styles/wave.css` (และ component ที่ตรวจเจอปัญหา ถ้าจำเป็น)

**Interfaces:**
- Consumes: ทุกอย่างก่อนหน้า

- [ ] **Step 1: ไล่ตรวจด้วยตาใน Wave ทั้งสองโหมด (ผู้ควบคุมงานทำ)**

ตรวจหน้าและส่วนต่อไปนี้:
- **หน้า:** `/code/criminal`, หน้าอ่านมาตรา (ตัวบทต้องเป็นฟอนต์ IBM Plex Sans Thai Looped), `/search`, `/stats`, `/bookmarks`, `/settings`
- **modal และ sheet:** แผ่นคิวเล่นเสียง, `FolderEditModal`, `ProGateModal`, `ConfirmDialog`, `UpdateModal`, `HighlightPopup`, `NoteDrawer`
- **อื่น ๆ:** `TtsPlayer` บนหน้าอื่นที่ไม่ใช่หน้าแรก, toast, และ `AppTour`

เกณฑ์ (spec 7.2):
- ไม่มีตัวอักษรกลืนกับพื้น
- ไม่มีพื้นหรือขอบสีกระดาษหรือสีแดงชาดหลงเหลือ
- ปุ่มสีทองมีตัวอักษรสีเข้ม

- [ ] **Step 2: แก้จุดที่เจอใน `src/styles/wave.css`**

ทุกการแก้ต้องอยู่ใต้ `html.theme-wave` (หรือ `html.theme-wave.dark`) เพื่อไม่ให้ Classic เปลี่ยน แก้ด้วย selector ที่แคบที่สุดที่ครอบจุดนั้นได้ ตัวอย่างเช่น ถ้า `TtsPlayer` ใช้ `bg-ink` เป็นพื้นแถบในโหมดสว่างแล้วดูหนักเกินไป:

```css
html.theme-wave:not(.dark) .bg-ink:not([class*='dark:bg-']) { background-color: rgb(var(--c-ink-2)); }
```

ถ้าจุดไหนแก้ด้วย CSS อย่างเดียวไม่ได้ ให้เช็ก `resolveTheme(settings) === 'wave'` ใน component นั้นแบบเดียวกับ `TabBar` ใน Task 2 และจดทุกจุดที่แก้ลงข้อความ commit

- [ ] **Step 3: ทัวร์แนะนำแอป**

เปิดทัวร์ใน Wave:
- ขั้นที่ชี้ `select-list`, `select-bar`, `select-folders` ต้องมีกรอบชี้ ยกเว้น `select-bar` ที่จะไม่มีกรอบถ้ายังไม่ได้ติ๊ก ซึ่งเป็นแบบเดียวกับ Classic
- ขั้น `folder-forgotten` จะไม่มีกรอบใน Wave แต่การ์ดยังแสดง ให้จดไว้ในรายงาน ไม่ต้องแก้ในรอบนี้

- [ ] **Step 4: เทสต์และ build ทั้งหมด**

Run: `npm test`
Expected: PASS ทั้งหมด รวมเทสต์ใหม่ `themeTokens`, `theme`, `lawMeta.wave`, `toast`, `resumeQueue`, `wave`, `selection`, `folderPicker`

Run: `npm run build`
Expected: build สำเร็จ ใน `dist/assets` มีไฟล์ฟอนต์ `anuphan-*.woff2`, `ibm-plex-sans-thai-looped-*.woff2` และภาพ `themis-base-*.jpg`, `themis-on-*.jpg`, `headphones-*.png`

- [ ] **Step 5: ตรวจ Classic รอบสุดท้าย (ผู้ควบคุมงานทำ)**

สลับเป็น Classic แล้วถ่ายภาพ 8 หน้า × 2 โหมด เทียบกับภาพใน Task 1 ต้องเหมือนกัน

- [ ] **Step 6: ออฟไลน์และลดการเคลื่อนไหว (ผู้ควบคุมงานทำ)**

- `npm run preview` แล้วตั้ง network เป็น offline ใน devtools และรีโหลด ฟอนต์ Wave ต้องยังถูก
- ผู้ใช้ที่ยังไม่เคยตั้งค่า "ลดการเคลื่อนไหว": ตั้ง `prefers-reduced-motion: reduce` ใน devtools แล้ว hero ต้องไม่มีการลอย วงแหวน หรืออีควอไลเซอร์

- [ ] **Step 7: Commit**

```bash
git add src/styles/wave.css
git commit -m "fix(wave): recolour shared screens' leftover surfaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(ถ้า Step 2 แก้ component ด้วย ให้ `git add` ไฟล์นั้นเพิ่ม)

- [ ] **Step 8: สิ่งที่ต้องให้ผู้ใช้ตรวจบนเครื่องจริง**

แจ้งผู้ใช้เป็นรายการ (ผู้ควบคุมงานทำแทนไม่ได้):
- แอนิเมชันเทพีและอีควอไลเซอร์ลื่นบน Android รุ่นช้า
- hero ไม่ล้นจอบน iPhone/iPad ทุกขนาดตัวอักษร
- **โหมด "ตามเครื่อง"** เปลี่ยนตามเครื่องจริงบน Android และ iOS เพราะ WebView บางรุ่นไม่ส่ง `prefers-color-scheme` ถ้าไม่เปลี่ยน แจ้งกลับมา จะต้องอ่านโหมดจาก native แทน
- เปิดแอปจากปิดสนิท ไม่มีจอสว่างวาบในโหมดมืด
- ฟังโฟลเดอร์ ออกจากแอปเกิน 80 วินาที แล้วกลับมา hero ต้องบอกตำแหน่งล่าสุด (spec 8)
