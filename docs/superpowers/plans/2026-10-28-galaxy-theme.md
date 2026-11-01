# ธีม Galaxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มธีม Galaxy (ระบบสุริยะ 3D ของกฎหมายบนหน้าแรก, หน้าเลือกฟังแบบซูมการ์ดพร้อม popup โฟลเดอร์, ปุ่มฟังต่อทั้งคิว) เป็นค่าเริ่มต้น และคงหน้าตาเดิมไว้ในชื่อ Classic

**Architecture:** สีและฟอนต์ใน Tailwind เปลี่ยนเป็นตัวแปร CSS (`--c-*`, `--f-*`) Classic ตั้งค่าเดิม ส่วน Galaxy ทับค่าใน `html.theme-galaxy` และติดคลาส `dark` ไว้ด้วยเสมอ หน้าที่ใช้ร่วมกันจึงเปลี่ยนธีมได้โดยไม่แตะ layout หน้าแรกและหน้าเลือกฟังมี component แยกสำหรับ Galaxy (`GalaxyHome`, `GalaxySelect`) ซึ่ง `App.jsx` เลือกตาม `settings.theme` คณิตของวงโคจร (`lib/orbit.js`) คิวฟังต่อ (`lib/resumeQueue.js`) และการใส่โฟลเดอร์ (`lib/folderPicker.js`) เป็นโมดูลล้วน มีเทสต์

**Tech Stack:** React 18.3, Vite, Tailwind 3.4, Vitest 2.1 (environment node), Capacitor 8, `@fontsource/ibm-plex-sans-thai@5.3.0`

**Spec:** `docs/superpowers/specs/2026-10-28-galaxy-theme-design.md`

## Global Constraints

- ไม่มีค่า `settings.theme` → Galaxy, `'classic'` → Classic (spec 2.1)
- Classic ต้องหน้าตาเหมือนเดิมทุกพิกเซล ทั้งโหมดสว่างและมืด (spec 2.2, 7.2)
- Galaxy ติดคลาส `dark` เสมอ ไม่แก้ค่า `isDarkMode` (spec 2.3)
- ค่ากล้องตายตัว: tilt 25°, roll −17°, depth 88 (`D = 900 − depth × 6`), รอบละ 180 วินาที, ทั้งระบบหมุนพร้อมกัน (spec 3.2)
- ทุกดาวมีป้ายชื่อตลอดเวลา ชื่อย่อ: แพ่ง · อาญา · วิแพ่ง · วิอาญา · รัฐธรรมนูญ · พระธรรมนูญ · แรงงาน · ศาลแขวง · ศาลปกครอง · ล้มละลาย · ลิขสิทธิ์ · ผู้บริโภค · ศาลเยาวชน (spec 3.4)
- frame loop ของระบบสุริยะเปลี่ยนแค่ `transform`, `opacity`, `z-index` (spec 3.7)
- แถบล่าง: หน้าแรก · เลือกฟัง · สถิติ · บุ๊กมาร์ก · ตั้งค่า เหมือน Classic (spec 2.7)
- คีย์ localStorage ใหม่: `lawcode-th-resume`, `lawcode-th-folder-recent` ส่วน `theme`, `orbitHidden`, `reduceMotion` อยู่ใน `lawcode-eng-settings` ไม่มีอะไร sync ขึ้น cloud
- การสร้างโฟลเดอร์ยังเป็นฟีเจอร์ Pro
- ทุก commit อยู่บน branch `feat/galaxy-theme` และลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- รันเทสต์ทั้งหมดด้วย `npm test` (vitest run) เทสต์เดี่ยวด้วย `npx vitest run <path>`

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `tailwind.config.js` | แก้ | สีและฟอนต์อ่านจากตัวแปร CSS |
| `src/index.css` | แก้ | ค่า token ของ Classic ใน `:root` |
| `src/styles/galaxy.css` | ใหม่ | token ของ Galaxy และสไตล์ทุกอย่างของ Galaxy (ขอบเขต `html.theme-galaxy` หรือคลาส `gx-*`) |
| `src/styles/themeTokens.test.js` | ใหม่ | เทสต์ว่า token ครบทั้งสองธีม และไม่มีสี Classic ฝังในหน้าที่ใช้ร่วมกัน |
| `src/lib/theme.js` (+ test) | ใหม่ | อ่านค่าธีม, คลาสบน `<html>`, สี status bar, ดาวที่โคจร, ลดการเคลื่อนไหว |
| `src/data/lawMeta.js` (+ `lawMeta.orbit.test.js`) | แก้ | `orbitName`, `orbitColor` ต่อฉบับ |
| `src/lib/orbit.js` (+ test) | ใหม่ | คณิตระบบสุริยะ: projection, แบ่งวง, วางป้าย |
| `src/lib/toast.js` (+ test), `src/components/ToastHost.jsx` | แก้ | toast มีปุ่ม action ได้ |
| `src/lib/resumeQueue.js` (+ test) | ใหม่ | บันทึกและกู้คิวฟังต่อ |
| `src/context/TtsContext.jsx` | แก้ | บันทึกคิว, `playResume`, `playSections(items, start, { label })` |
| `src/lib/selection.js` (+ test) | ใหม่ | logic การติ๊กมาตราแบบไม่มี React |
| `src/hooks/useTocNavigation.js`, `useSectionSelection.js`, `useFolderPlayback.js` | ใหม่ | logic ที่ Classic และ Galaxy ใช้ร่วมกันในหน้าเลือกฟัง |
| `src/lib/toc.js` | แก้ | รับ `tocNodeKey` ย้ายมาจาก SelectScreen |
| `src/lib/folderPicker.js` (+ test) | ใหม่ | ใส่หลายโฟลเดอร์, เลิกทำ, โฟลเดอร์ที่ใช้ล่าสุด |
| `src/components/galaxy/*` | ใหม่ | `GalaxySky`, `SolarSystem`, `ThemePicker`, `OrbitPickerSheet`, `BookOrbitHeader`, `FolderPickerSheet`, `FoldersView` |
| `src/screens/GalaxyHome.jsx`, `GalaxySelect.jsx` | ใหม่ | หน้าแรกและหน้าเลือกฟังของ Galaxy |
| `src/screens/SelectScreen.jsx` | แก้ | ใช้ hook ร่วม หน้าตาและการทำงานไม่เปลี่ยน |
| `src/App.jsx`, `src/main.jsx`, `index.html`, `capacitor.config.ts`, `src/components/TabBar.jsx`, `src/screens/SettingsScreen.jsx` | แก้ | ต่อธีมเข้ากับแอป |

---

### Task 1: สีและฟอนต์เป็น token (Classic ไม่เปลี่ยน)

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Modify: `src/components/AppTour.jsx`, `src/components/TtsPlayer.jsx`, `src/screens/BookScreen.jsx`, `src/screens/ReaderScreen.jsx`, `src/screens/SearchScreen.jsx`, `src/screens/SettingsScreen.jsx`, `src/screens/StatsScreen.jsx`
- Test: `src/styles/themeTokens.test.js`

`HomeScreen.jsx` และ `SelectScreen.jsx` ไม่ต้องแปลงสี เพราะ Galaxy ใช้หน้าของตัวเองแทนสองหน้านี้ `App.jsx` ยังใช้ hex เพราะเป็นค่าที่ส่งให้ native status bar

**Interfaces:**
- Produces: ตัวแปร CSS `--c-paper`, `--c-paper-dk`, `--c-card`, `--c-ink`, `--c-ink-soft`, `--c-rule`, `--c-rule-soft`, `--c-accent`, `--c-ochre`, `--c-ink-2`, `--c-dark-bg`, `--c-dark-card` (ค่าเป็นเลข RGB สามตัวคั่นช่องว่าง ใช้เป็น `rgb(var(--c-accent))` หรือ `rgb(var(--c-accent) / 0.1)`), และ `--f-display`, `--f-serif`, `--f-ui`

- [ ] **Step 1: ถ่ายภาพ Classic ก่อนแก้ (ผู้ควบคุมงานทำ)**

เปิด dev server ด้วย `preview_start` ชื่อ `dev` (port 5173) แล้วถ่ายภาพหน้า `/`, `/#/select`, `/#/code/criminal`, `/#/code/criminal/section/<id แรกของอาญา>`, `/#/search`, `/#/stats`, `/#/bookmarks`, `/#/settings` ที่ขนาด mobile ทั้งโหมดสว่างและโหมดมืด (สลับที่ ตั้งค่า › โหมดมืด) เก็บไว้ใน scratchpad ใช้เทียบใน Step 9

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/styles/themeTokens.test.js`:

```js
// The two themes share every screen except Home and Select, so their colours
// live in CSS variables. These tests keep the variable sets complete and stop
// a Classic colour from being written straight into a shared screen again.
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

  it('Classic keeps its exact colours', () => {
    const root = block(read('src/index.css'), ':root');
    for (const [name, rgb] of Object.entries(CLASSIC)) {
      expect(root).toContain(`--c-${name}: ${rgb};`);
    }
    expect(root).toContain("--f-display: 'Trirong', Georgia, serif;");
    expect(root).toContain("--f-ui: 'Sarabun', system-ui, sans-serif;");
  });

  it('shared screens hold no hard-coded Classic colour', () => {
    for (const f of SHARED) {
      expect(read(f), f).not.toMatch(/#a93225|#ece4d4|#bdb19a|rgba\(169, ?50, ?37/i);
    }
  });
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/styles/themeTokens.test.js`
Expected: FAIL ทั้งสามเทสต์ (`TOKENS` เป็น `undefined` ทั้งหมด, ไม่มี `--c-paper` ใน `:root`, เจอ `#a93225` ใน `TtsPlayer.jsx`)

- [ ] **Step 4: เปลี่ยน `tailwind.config.js`**

แทน `colors` และ `fontFamily` ใน `theme.extend` ทั้งก้อนด้วย:

```js
      // Every colour is a CSS variable holding "R G B", so one class list
      // serves both themes: :root in index.css sets Classic, and
      // html.theme-galaxy in styles/galaxy.css overrides it. <alpha-value>
      // keeps modifiers such as bg-paper-dk/30 working.
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
      },
```

- [ ] **Step 5: ตั้งค่า token ของ Classic ใน `src/index.css`**

ใน `@layer base` ที่บล็อก `:root {` เพิ่มเป็นบรรทัดแรกของบล็อก (ก่อน comment เรื่อง press-feedback):

```css
    /* Theme tokens — Classic. Each holds "R G B" for Tailwind's
       rgb(var(--c-x) / <alpha-value>); styles/galaxy.css overrides them. */
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
```

แล้วเปลี่ยนสีพื้นที่เขียนตายตัวในไฟล์เดียวกันให้อ่าน token:

```bash
sed -i 's/background: #ece4d4;/background: rgb(var(--c-paper));/g; s/background: #d8cdb4;/background: rgb(var(--c-paper-dk));/g; s/background: #0f0e0c;/background: rgb(var(--c-dark-bg));/g' src/index.css
grep -n "#ece4d4\|#d8cdb4\|#0f0e0c" src/index.css
```

Expected: grep เหลือเฉพาะบรรทัดใน comment (ถ้ามี) ไม่มีบรรทัด `background:` เหลือ

- [ ] **Step 6: แปลงสีในหน้าที่ใช้ร่วมกัน**

```bash
FILES="src/components/AppTour.jsx src/components/TtsPlayer.jsx src/screens/BookScreen.jsx src/screens/ReaderScreen.jsx src/screens/SearchScreen.jsx src/screens/SettingsScreen.jsx src/screens/StatsScreen.jsx"
sed -i "s/'#a93225'/'rgb(var(--c-accent))'/g; s/'#ece4d4'/'rgb(var(--c-paper))'/g; s/'#bdb19a'/'rgb(var(--c-rule-soft))'/g" $FILES
grep -n "#a93225\|#ece4d4\|#bdb19a\|rgba(169" $FILES
```

grep จะเหลือ 3 จุดที่ต้องแก้ด้วยมือ:
- `src/components/TtsPlayer.jsx` (ราวบรรทัด 401): `'rgba(169,50,37,0.10)'` → `'rgb(var(--c-accent) / 0.10)'`
- `src/components/TtsPlayer.jsx` (ราวบรรทัด 413): `<svg width="16" height="16" viewBox="0 0 24 24" fill="#a93225">` → `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-accent">` (attribute ของ SVG อ่าน `var()` ไม่ได้)
- `src/screens/SearchScreen.jsx` (ราวบรรทัด 154): `'2px solid #a93225'` → `'2px solid rgb(var(--c-accent))'`

ถ้า grep เจอจุดอื่นนอกเหนือจากนี้ ใช้หลักเดียวกัน: ค่าใน `style` เขียนเป็น `rgb(var(--c-…))` ส่วน attribute ของ SVG เปลี่ยนเป็น `currentColor` คู่กับคลาส `text-…`

- [ ] **Step 7: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/styles/themeTokens.test.js`
Expected: PASS 3 tests

- [ ] **Step 8: รันเทสต์ทั้งหมดและ build**

Run: `npm test` แล้ว `npm run build`
Expected: เทสต์ผ่านทั้งหมด build สำเร็จ

- [ ] **Step 9: เทียบภาพ Classic (ผู้ควบคุมงานทำ)**

ถ่ายภาพ 8 หน้า × 2 โหมดเหมือน Step 1 แล้วเทียบกับภาพเดิม ต้องเหมือนกัน ถ้าต่างตรงไหน หา class หรือ style ที่ยังอ้างค่าเก่า แล้วแก้ก่อน commit

- [ ] **Step 10: Commit**

```bash
git add tailwind.config.js src/index.css src/styles/themeTokens.test.js src/components/AppTour.jsx src/components/TtsPlayer.jsx src/screens/BookScreen.jsx src/screens/ReaderScreen.jsx src/screens/SearchScreen.jsx src/screens/SettingsScreen.jsx src/screens/StatsScreen.jsx
git commit -m "refactor(theme): colours and fonts as CSS variables, Classic unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ฐานของธีม Galaxy

**Files:**
- Create: `src/lib/theme.js`, `src/lib/theme.test.js`
- Create: `src/styles/galaxy.css`
- Create: `src/data/lawMeta.orbit.test.js`
- Modify: `src/data/lawMeta.js`, `src/styles/themeTokens.test.js`, `src/main.jsx`, `index.html`, `src/App.jsx`, `capacitor.config.ts`, `src/components/TabBar.jsx`, `package.json` (จาก npm install)

**Interfaces:**
- Consumes: ตัวแปร `--c-*`, `--f-*` จาก Task 1
- Produces (`src/lib/theme.js`):
  - `resolveTheme(settings) → 'classic' | 'galaxy'`
  - `htmlClasses(settings) → { galaxy: boolean, dark: boolean }`
  - `statusBarColors(settings) → { color: string, dark: boolean }`
  - `orbitBooks(settings, metas = LAW_BOOKS_META) → meta[]` (ฉบับที่โคจร เรียงตาม `metas` ไม่ว่างเสมอ)
  - `toggleOrbit(hidden: string[], id: string, metas = LAW_BOOKS_META) → string[]`
  - `hiddenForPreset('codes' | 'all', metas = LAW_BOOKS_META) → string[]`
  - `resolveReduceMotion(settings) → boolean`
- Produces (`lawMeta.js`): ทุก meta มี `orbitName: string`, `orbitColor: '#rrggbb'`
- Produces (CSS): คลาส `html.theme-galaxy`, `.gx-tabbar`

- [ ] **Step 1: เขียนเทสต์ของ `theme.js`**

สร้าง `src/lib/theme.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  resolveTheme, htmlClasses, statusBarColors, orbitBooks, toggleOrbit, hiddenForPreset, resolveReduceMotion,
} from './theme.js';

const metas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('theme', () => {
  it('defaults to Galaxy, keeps a saved Classic', () => {
    expect(resolveTheme({})).toBe('galaxy');
    expect(resolveTheme(undefined)).toBe('galaxy');
    expect(resolveTheme({ theme: 'classic' })).toBe('classic');
    expect(resolveTheme({ theme: 'nonsense' })).toBe('galaxy');
  });

  it('Galaxy is always dark; Classic follows isDarkMode', () => {
    expect(htmlClasses({})).toEqual({ galaxy: true, dark: true });
    expect(htmlClasses({ isDarkMode: false })).toEqual({ galaxy: true, dark: true });
    expect(htmlClasses({ theme: 'classic', isDarkMode: false })).toEqual({ galaxy: false, dark: false });
    expect(htmlClasses({ theme: 'classic', isDarkMode: true })).toEqual({ galaxy: false, dark: true });
  });

  it('status bar colours', () => {
    expect(statusBarColors({})).toEqual({ color: '#0a0e22', dark: true });
    expect(statusBarColors({ theme: 'classic', isDarkMode: true })).toEqual({ color: '#0f0e0c', dark: true });
    expect(statusBarColors({ theme: 'classic', isDarkMode: false })).toEqual({ color: '#ece4d4', dark: false });
  });

  it('orbit shows everything not hidden, skips unknown ids, never empty', () => {
    expect(orbitBooks({}, metas).map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(orbitBooks({ orbitHidden: ['b', 'gone'] }, metas).map(m => m.id)).toEqual(['a', 'c']);
    expect(orbitBooks({ orbitHidden: ['a', 'b', 'c'] }, metas).map(m => m.id)).toEqual(['a']);
    expect(orbitBooks({ orbitHidden: 'junk' }, metas).map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('toggleOrbit refuses to hide the last one', () => {
    expect(toggleOrbit([], 'a', metas)).toEqual(['a']);
    expect(toggleOrbit(['a'], 'a', metas)).toEqual([]);
    expect(toggleOrbit(['a', 'b'], 'c', metas)).toEqual(['a', 'b']);
  });

  it('presets', () => {
    expect(hiddenForPreset('all', metas)).toEqual([]);
    const real = hiddenForPreset('codes');
    expect(real).not.toContain('civil');
    expect(real).not.toContain('constitution');
    expect(real).toContain('labour_protection');
  });

  it('reduce motion: explicit setting wins, else the device', () => {
    expect(resolveReduceMotion({ reduceMotion: true })).toBe(true);
    expect(resolveReduceMotion({ reduceMotion: false })).toBe(false);
    expect(resolveReduceMotion({})).toBe(false); // no window.matchMedia under node
  });
});
```

- [ ] **Step 2: เขียนเทสต์ของ `lawMeta`**

สร้าง `src/data/lawMeta.orbit.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { LAW_BOOKS_META } from './lawMeta.js';

describe('orbit names and colours', () => {
  it('uses the names the user chose, in book order', () => {
    expect(LAW_BOOKS_META.map(m => m.orbitName)).toEqual([
      'แพ่ง', 'อาญา', 'วิแพ่ง', 'วิอาญา', 'รัฐธรรมนูญ', 'พระธรรมนูญ', 'แรงงาน',
      'ศาลแขวง', 'ศาลปกครอง', 'ล้มละลาย', 'ลิขสิทธิ์', 'ผู้บริโภค', 'ศาลเยาวชน',
    ]);
  });

  it('gives every book its own colour', () => {
    const colours = LAW_BOOKS_META.map(m => m.orbitColor);
    expect(colours.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
```

- [ ] **Step 3: เพิ่มเทสต์ token ของ Galaxy**

ใน `src/styles/themeTokens.test.js` เพิ่มใน `describe` เดิม:

```js
  it('Galaxy overrides every token and every font', () => {
    const g = block(read('src/styles/galaxy.css'), 'html.theme-galaxy');
    for (const name of Object.keys(CLASSIC)) {
      expect(g).toMatch(new RegExp(`--c-${name}: \\d+ \\d+ \\d+;`));
    }
    for (const f of ['display', 'serif', 'ui']) {
      expect(g).toContain(`--f-${f}: 'IBM Plex Sans Thai', system-ui, sans-serif;`);
    }
  });
```

- [ ] **Step 4: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/theme.test.js src/data/lawMeta.orbit.test.js src/styles/themeTokens.test.js`
Expected: FAIL (ไม่มี `./theme.js`, `orbitName` เป็น `undefined`, ไม่มี `galaxy.css`)

- [ ] **Step 5: เขียน `src/lib/theme.js`**

```js
// Which theme is on, and what follows from it. Classic is today's look; Galaxy
// is the space theme and the default for everyone, existing users included
// (spec 2.1). Settings live in AppContext's `lawcode-eng-settings`.
import { LAW_BOOKS_META } from '../data/lawMeta';

export function resolveTheme(settings) {
  return settings?.theme === 'classic' ? 'classic' : 'galaxy';
}

// Galaxy always carries `dark` as well, so every screen's dark: classes apply
// and galaxy.css only has to recolour them (spec 2.3). isDarkMode is left as
// it was, so going back to Classic restores the user's own mode.
export function htmlClasses(settings) {
  const galaxy = resolveTheme(settings) === 'galaxy';
  return { galaxy, dark: galaxy || !!settings?.isDarkMode };
}

export function statusBarColors(settings) {
  if (resolveTheme(settings) === 'galaxy') return { color: '#0a0e22', dark: true };
  return settings?.isDarkMode
    ? { color: '#0f0e0c', dark: true }
    : { color: '#ece4d4', dark: false };
}

// The orbit stores what is hidden, not what is shown, so a book added to the
// app later joins the orbit by itself (spec 3.6).
const hiddenOf = (settings) => (Array.isArray(settings?.orbitHidden) ? settings.orbitHidden : []);

export function orbitBooks(settings, metas = LAW_BOOKS_META) {
  const hidden = new Set(hiddenOf(settings));
  const shown = metas.filter(m => !hidden.has(m.id));
  return shown.length ? shown : metas.slice(0, 1);
}

export function toggleOrbit(hidden, id, metas = LAW_BOOKS_META) {
  const set = new Set(hidden);
  if (set.has(id)) {
    set.delete(id);
    return [...set];
  }
  if (metas.filter(m => !set.has(m.id)).length <= 1) return hidden;
  set.add(id);
  return [...set];
}

const PRESET_CODES = ['civil', 'criminal', 'civil_proc', 'criminal_proc', 'constitution'];

export function hiddenForPreset(preset, metas = LAW_BOOKS_META) {
  if (preset === 'all') return [];
  return metas.filter(m => !PRESET_CODES.includes(m.id)).map(m => m.id);
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

- [ ] **Step 6: เพิ่ม `orbitName` และ `orbitColor` ใน `src/data/lawMeta.js`**

ในแต่ละ entry ของ `LAW_BOOKS_META` เพิ่มสองบรรทัดต่อจากบรรทัด `shortName:` ของ entry นั้น:

| `id` | เพิ่ม |
|---|---|
| `civil` | `orbitName: 'แพ่ง',` `orbitColor: '#3d7fd0',` |
| `criminal` | `orbitName: 'อาญา',` `orbitColor: '#d24a3a',` |
| `civil_proc` | `orbitName: 'วิแพ่ง',` `orbitColor: '#3a9a64',` |
| `criminal_proc` | `orbitName: 'วิอาญา',` `orbitColor: '#8a5ac8',` |
| `constitution` | `orbitName: 'รัฐธรรมนูญ',` `orbitColor: '#d8a24a',` |
| `court_org` | `orbitName: 'พระธรรมนูญ',` `orbitColor: '#5a8fc0',` |
| `labour_protection` | `orbitName: 'แรงงาน',` `orbitColor: '#3fb0a0',` |
| `district_court` | `orbitName: 'ศาลแขวง',` `orbitColor: '#c0648a',` |
| `admin_court` | `orbitName: 'ศาลปกครอง',` `orbitColor: '#9aa848',` |
| `bankruptcy` | `orbitName: 'ล้มละลาย',` `orbitColor: '#b07a50',` |
| `copyright` | `orbitName: 'ลิขสิทธิ์',` `orbitColor: '#5ab0d8',` |
| `consumer_proc` | `orbitName: 'ผู้บริโภค',` `orbitColor: '#e08a5a',` |
| `juvenile_court` | `orbitName: 'ศาลเยาวชน',` `orbitColor: '#c08ad8',` |

ตัวอย่าง entry แรกหลังแก้:

```js
  {
    id: 'civil',
    shortName: 'แพ่งและพาณิชย์',
    // Galaxy theme: the planet's name on Home's solar system, and its colour.
    orbitName: 'แพ่ง',
    orbitColor: '#3d7fd0',
    abbr: 'พ.พ.',
```

(comment ใส่แค่ entry แรก)

- [ ] **Step 7: ติดตั้งฟอนต์**

```bash
npm install @fontsource/ibm-plex-sans-thai@5.3.0
```

- [ ] **Step 8: สร้าง `src/styles/galaxy.css`**

```css
/* Galaxy theme. Imported after index.css (see main.jsx), so a rule here beats
   an index.css rule of equal specificity. Everything is scoped to
   html.theme-galaxy or to gx-* classes that only Galaxy screens render, so
   Classic never matches anything in this file. */

/* ── Tokens ─────────────────────────────────────────────────────────────── */
/* Galaxy also sets `dark` on <html> (lib/theme.js), so screens use their
   dark: classes and these values recolour them: paper is the main text,
   rule-soft the secondary text, ink-soft the hairlines, dark-bg the page. */
html.theme-galaxy {
  --c-paper: 232 230 246;
  --c-paper-dk: 20 26 54;
  --c-card: 20 26 54;
  --c-ink: 10 14 34;
  --c-ink-soft: 42 49 96;
  --c-rule: 42 49 96;
  --c-rule-soft: 157 163 204;
  --c-accent: 242 168 101;
  --c-ochre: 242 200 140;
  --c-ink-2: 26 32 72;
  --c-dark-bg: 10 14 34;
  --c-dark-card: 20 26 54;
  --f-display: 'IBM Plex Sans Thai', system-ui, sans-serif;
  --f-serif: 'IBM Plex Sans Thai', system-ui, sans-serif;
  --f-ui: 'IBM Plex Sans Thai', system-ui, sans-serif;
  --tap-row-bg: rgba(242, 168, 101, 0.14);
  --rule-hair: rgba(200, 205, 255, 0.14);
  --rule-strong: #3a4278;
  --row-alt: rgba(255, 255, 255, 0.03);
}

html.theme-galaxy body,
html.theme-galaxy #root { background: #04060e; }
html.theme-galaxy .phone-shell { background: rgb(var(--c-dark-bg)); }

/* Trirong's italics were part of what read as old, and Plex has no italic
   face — the browser would only slant it. */
html.theme-galaxy .italic { font-style: normal; }

/* Text on an accent fill is written text-paper, which in Galaxy is the light
   text colour; on the orange it has to be dark. */
html.theme-galaxy .bg-accent { --c-paper: 26 16 32; }

/* The two-pixel header rules are dark:border-paper — a bright line in Galaxy. */
html.theme-galaxy .dark\:border-paper { border-color: rgba(200, 205, 255, 0.16); }

/* ── Tab bar ────────────────────────────────────────────────────────────── */
.gx-tabbar { background: rgba(7, 9, 26, 0.92); border-top: 1px solid rgba(200, 205, 255, 0.1); }
```

- [ ] **Step 9: import ฟอนต์และ CSS ใน `src/main.jsx`**

แทน `import './index.css';` ด้วย:

```js
import './index.css';
// Galaxy's font, bundled so it works offline (spec 2.4). Classic never uses
// the family, so the browser never downloads these files there.
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import './styles/galaxy.css';
```

- [ ] **Step 10: ติดคลาสตั้งแต่เฟรมแรกใน `index.html`**

เพิ่มใน `<head>` ก่อน `<link rel="preconnect"` แรก:

```html
    <!-- Galaxy must be dark from the first frame, before React loads.
         Same rule as lib/theme.js: no saved theme means Galaxy. -->
    <script>
      (function () {
        var galaxy = true;
        try {
          var s = JSON.parse(localStorage.getItem('lawcode-eng-settings') || '{}');
          galaxy = !s || s.theme !== 'classic';
        } catch (e) {}
        if (galaxy) document.documentElement.classList.add('theme-galaxy', 'dark');
      })();
    </script>
```

- [ ] **Step 11: ต่อคลาสและ status bar ใน `src/App.jsx`**

เพิ่ม import:

```js
import { htmlClasses, statusBarColors } from './lib/theme';
```

ใน `ThemeWrapper` แทน effect นี้:

```js
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.isDarkMode);
  }, [settings.isDarkMode]);
```

ด้วย:

```js
  useEffect(() => {
    const { galaxy, dark } = htmlClasses(settings);
    document.documentElement.classList.toggle('theme-galaxy', galaxy);
    document.documentElement.classList.toggle('dark', dark);
  }, [settings.theme, settings.isDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const { color, dark } = statusBarColors(settings);
    StatusBar.setBackgroundColor({ color }).catch(() => {});
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  }, [settings.theme, settings.isDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 12: splash สีเข้มใน `capacitor.config.ts`**

ใน `SplashScreen` เปลี่ยน `backgroundColor: '#ece4d4'` เป็น `backgroundColor: '#04060e'` และใน `StatusBar` เปลี่ยนเป็น `style: 'DARK'`, `backgroundColor: '#04060e'` เพิ่ม comment เหนือ `SplashScreen`:

```ts
    // Galaxy is the default theme and is dark, so the splash is too (spec 2.5).
    // Classic users see this dark screen for a moment before the app paints.
```

ค่านี้มีผลกับแอป native หลัง `npx cap sync` ซึ่ง workflow ของการ build ทำอยู่แล้ว

- [ ] **Step 13: แถบล่างของ Galaxy ใน `src/components/TabBar.jsx`**

เพิ่ม import:

```js
import { useApp } from '../context/AppContext';
import { resolveTheme } from '../lib/theme';
```

ในฟังก์ชัน `TabBar` ต่อจาก `const playerShowing = …;` เพิ่ม:

```js
  // Galaxy keeps the same five tabs (spec 2.7) but drops the inverted fill:
  // the active tab is the accent colour on the dark bar.
  const { settings } = useApp();
  const galaxy = resolveTheme(settings) === 'galaxy';
```

เปลี่ยน `<div className="border-t-2 border-rule bg-paper dark:bg-dark-bg dark:border-ink-soft flex-shrink-0">` เป็น:

```jsx
      <div className={galaxy ? 'gx-tabbar flex-shrink-0' : 'border-t-2 border-rule bg-paper dark:bg-dark-bg dark:border-ink-soft flex-shrink-0'}>
```

เปลี่ยน array ของ `className` ในปุ่มเป็น:

```jsx
              className={[
                // tap-btn (not tap-row): the active tab is bg-ink in light mode,
                // where a background flash would be invisible against it.
                'tap-btn flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors',
                !galaxy && i < TABS.length - 1 ? 'border-r border-rule-soft dark:border-ink-soft' : '',
                galaxy
                  ? (active ? 'text-accent' : 'text-rule-soft')
                  : active
                    ? 'bg-ink dark:bg-paper text-paper dark:text-ink'
                    : 'bg-transparent text-ink dark:text-paper',
              ].join(' ')}
```

และ `style` ของ `<span>` ชื่อแท็บเป็น:

```jsx
                style={{ fontStyle: active && !galaxy ? 'italic' : 'normal', fontWeight: active ? 600 : 400 }}
```

- [ ] **Step 14: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/theme.test.js src/data/lawMeta.orbit.test.js src/styles/themeTokens.test.js`
Expected: PASS ทั้งหมด

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 15: ตรวจด้วยตา (ผู้ควบคุมงานทำ)**

เปิด dev server ล้าง localStorage แล้วรีโหลด: ทุกหน้าต้องเป็นพื้นกรมท่า ตัวอักษรสว่าง ฟอนต์ IBM Plex Sans Thai แท็บที่เลือกเป็นสีส้ม ไม่มีแถบสีขาว (หน้าแรกกับหน้าเลือกฟังยังเป็น layout ของ Classic ในสีใหม่ จนถึง Task 8 และ Task 11) แล้วตั้ง `theme: 'classic'` ใน `lawcode-eng-settings` ผ่าน devtools รีโหลด ต้องได้ Classic เหมือนภาพใน Task 1

- [ ] **Step 16: Commit**

```bash
git add src/lib/theme.js src/lib/theme.test.js src/data/lawMeta.js src/data/lawMeta.orbit.test.js src/styles/galaxy.css src/styles/themeTokens.test.js src/main.jsx index.html src/App.jsx capacitor.config.ts src/components/TabBar.jsx package.json package-lock.json
git commit -m "feat(theme): Galaxy theme base — tokens, font, html classes, tab bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: หน้าตั้งค่า — เลือกธีม ดาวที่โคจร ลดการเคลื่อนไหว

**Files:**
- Create: `src/components/galaxy/ThemePicker.jsx`, `src/components/galaxy/OrbitPickerSheet.jsx`
- Modify: `src/screens/SettingsScreen.jsx`, `src/styles/galaxy.css`

**Interfaces:**
- Consumes: `resolveTheme`, `orbitBooks`, `toggleOrbit`, `hiddenForPreset`, `resolveReduceMotion` (Task 2), `BottomSheet` (มีอยู่แล้ว: `({ height, onClose, children })`, `children` เป็นฟังก์ชันรับ `{ dragHandlers }` ได้)
- Produces: `<ThemePicker value onChange />`, `<OrbitPickerSheet onClose />` (Task 8 ใช้ซ้ำจากปุ่ม ⚙ หน้าแรก)

- [ ] **Step 1: สร้าง `src/components/galaxy/ThemePicker.jsx`**

```jsx
// Settings › ธีม: two preview cards, Classic and Galaxy. Switching takes
// effect at once — App.jsx re-renders the routes from settings.theme.
const OPTIONS = [
  { id: 'classic', label: 'Classic' },
  { id: 'galaxy', label: 'Galaxy' },
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
              <div className={`theme-preview theme-preview-${o.id}`} aria-hidden="true" />
              <div className="font-ui text-[12px] mt-1.5">{o.label}{on ? ' ✓' : ''}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `src/components/galaxy/OrbitPickerSheet.jsx`**

```jsx
// Which laws orbit on the Galaxy home (spec 3.6). Opened from the ⚙ on Home
// and from Settings. Stores the hidden ones, so a new book joins by itself.
import { useApp } from '../../context/AppContext';
import BottomSheet from '../BottomSheet';
import { LAW_BOOKS_META } from '../../data/lawMeta';
import { toggleOrbit, hiddenForPreset } from '../../lib/theme';

export default function OrbitPickerSheet({ onClose }) {
  const { settings, setSettings } = useApp();
  const hidden = Array.isArray(settings.orbitHidden) ? settings.orbitHidden : [];
  const setHidden = (next) => setSettings(s => ({ ...s, orbitHidden: next }));
  const shown = LAW_BOOKS_META.filter(m => !hidden.includes(m.id)).length;
  const chip = 'tap-btn font-ui text-[11px] px-3 py-1.5 rounded-full border border-rule-soft dark:border-ink-soft';

  return (
    <BottomSheet height="78%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-3 select-none flex-shrink-0" {...dragHandlers}>
            <div className="font-display text-[18px] font-semibold">ดาวที่โคจรในหน้าแรก</div>
            <div className="font-ui text-[11px] text-ink-soft dark:text-rule-soft">
              เปิดอย่างน้อย 1 ฉบับ · โคจรอยู่ {shown} จาก {LAW_BOOKS_META.length}
            </div>
            <div className="flex gap-2 mt-2.5">
              <button className={chip} onClick={() => setHidden(hiddenForPreset('codes'))}>ประมวล 4 + รธน.</button>
              <button className={chip} onClick={() => setHidden(hiddenForPreset('all'))}>ทั้งหมด</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pb-4">
            {LAW_BOOKS_META.map(m => {
              const on = !hidden.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setHidden(toggleOrbit(hidden, m.id))}
                  role="switch"
                  aria-checked={on}
                  className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.orbitColor }} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-ui text-[14px] font-medium">{m.orbitName}</span>
                    <span className="block font-ui text-[10.5px] text-ink-soft dark:text-rule-soft truncate">{m.fullName}</span>
                  </span>
                  <span className={`gx-switch${on ? ' is-on' : ''}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 3: เพิ่มสไตล์ใน `src/styles/galaxy.css`**

ต่อท้ายไฟล์:

```css
/* ── Settings ───────────────────────────────────────────────────────────── */
/* Theme previews are drawn in both themes, so they are not scoped. */
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
.theme-preview-galaxy { background: radial-gradient(120% 90% at 50% 0%, #1a2050, #05060f); }
.theme-preview-galaxy::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px;
  border-radius: 50%; background: radial-gradient(circle at 40% 35%, #ffe3c2, #f2a865 50%, #c0602a);
  box-shadow: 0 0 16px rgba(242, 168, 101, 0.6);
}
.theme-preview-galaxy::after {
  content: ''; position: absolute; left: 12%; right: 12%; top: 38%; height: 24%;
  border: 1px solid rgba(200, 210, 255, 0.35); border-radius: 50%; transform: rotate(-17deg);
}

.gx-switch { width: 34px; height: 20px; border-radius: 10px; background: rgba(255, 255, 255, 0.15); position: relative; flex-shrink: 0; transition: background-color 0.15s; }
.gx-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #9da3cc; transition: transform 0.15s; }
.gx-switch.is-on { background: rgb(var(--c-accent)); }
.gx-switch.is-on::after { transform: translateX(14px); background: #fff; }
```

- [ ] **Step 4: ต่อเข้า `src/screens/SettingsScreen.jsx`**

เพิ่ม import:

```js
import ThemePicker from '../components/galaxy/ThemePicker';
import OrbitPickerSheet from '../components/galaxy/OrbitPickerSheet';
import { resolveTheme, orbitBooks, resolveReduceMotion } from '../lib/theme';
import { LAW_BOOKS_META } from '../data/lawMeta';
```

(ถ้ายังไม่ได้ import `useState` จาก `react` ให้เพิ่ม)

ใน `SettingsScreen` ต่อจากบรรทัดที่ดึง `settings` / `setSettings` จาก `useApp()` เพิ่ม:

```js
  const galaxy = resolveTheme(settings) === 'galaxy';
  const [orbitOpen, setOrbitOpen] = useState(false);
```

ใน `<div className="px-5">` ก่อน comment `{/* Pro subscription card — monthly / quarterly / yearly plans */}` แทรก:

```jsx
          <ThemePicker
            value={resolveTheme(settings)}
            onChange={(theme) => setSettings(s => ({ ...s, theme }))}
          />

          {galaxy && (
            <Group title="หน้าแรก (Galaxy)">
              <button
                onClick={() => setOrbitOpen(true)}
                className="tap-row w-full flex items-center justify-between py-2.5 pl-4 text-left"
                style={{ borderTop: '1px dotted var(--rule-hair)' }}
              >
                <div className="font-serif text-[14px] text-ink dark:text-paper">ดาวที่โคจร</div>
                <div className="font-display text-[13px] text-ink-soft dark:text-rule-soft">
                  {orbitBooks(settings).length} จาก {LAW_BOOKS_META.length} ฉบับ ›
                </div>
              </button>
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
            {/* Galaxy is always dark (spec 2.3); the switch is Classic's. */}
            {!galaxy && (
              <Row label="โหมดมืด" toggle={settings.isDarkMode} onToggle={() => toggle('isDarkMode')} />
            )}
```

และก่อน `</div>` ปิดท้ายสุดของ JSX ที่ `return` เพิ่ม:

```jsx
      {orbitOpen && <OrbitPickerSheet onClose={() => setOrbitOpen(false)} />}
```

- [ ] **Step 5: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 6: ตรวจด้วยตา (ผู้ควบคุมงานทำ)**

หน้าตั้งค่า: การ์ด Classic/Galaxy อยู่บนสุด แตะสลับแล้วทั้งแอปเปลี่ยนทันที ตอนใช้ Galaxy ไม่มีแถวโหมดมืด มีกลุ่ม "หน้าแรก (Galaxy)" แตะ "ดาวที่โคจร" แล้วแผ่นเลื่อนขึ้นมา ปิดฉบับสุดท้ายไม่ได้ ปุ่มลัดสองปุ่มทำงาน ตอนใช้ Classic แถวโหมดมืดกลับมาและกลุ่ม Galaxy หายไป

- [ ] **Step 7: Commit**

```bash
git add src/components/galaxy/ThemePicker.jsx src/components/galaxy/OrbitPickerSheet.jsx src/screens/SettingsScreen.jsx src/styles/galaxy.css
git commit -m "feat(settings): theme picker, orbiting laws and reduce motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: คณิตของระบบสุริยะ (`lib/orbit.js`)

**Files:**
- Create: `src/lib/orbit.js`, `src/lib/orbit.test.js`

**Interfaces:**
- Produces:
  - `CAMERA = { tilt: 25, roll: -17, depth: 88, period: 180 }`
  - `HIT_PX = 48`
  - `stageFor(width) → { cx, cy, height, rIn, rOut, rOne, k, camera }`
  - `project(r, theta, { cx, cy, k = 1, camera = CAMERA }) → { x, y, s, zd, near }`
  - `planetScale(s, near) → number`
  - `orbitCount(n) → 1..4`
  - `planetSize(totalSections) → px` (ก่อนคูณ `k`)
  - `layoutOrbits(laws: { id, totalSections }[], stage?) → { orbits: number[] /* radii */, planets: { id, orbit, r, phase, size }[] }`
  - `placeLabels(labels: { id, x, y, rad, w, h, near, slot? }[], { minX, maxX }) → Map<id, { x, y, slot, crowded }>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/orbit.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  CAMERA, stageFor, project, planetScale, orbitCount, planetSize, layoutOrbits, placeLabels,
} from './orbit.js';

const laws = (n) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, totalSections: 100 + i * 50 }));
const stage = stageFor(300);

describe('orbit geometry', () => {
  it('uses the camera the user chose', () => {
    expect(CAMERA).toEqual({ tilt: 25, roll: -17, depth: 88, period: 180 });
  });

  it('splits planets into orbits by count, none empty, all placed', () => {
    const cases = { 1: 1, 3: 1, 4: 2, 7: 2, 8: 3, 10: 3, 11: 4, 13: 4 };
    for (const [n, m] of Object.entries(cases)) {
      expect(orbitCount(Number(n))).toBe(m);
      const { orbits, planets } = layoutOrbits(laws(Number(n)), stage);
      expect(orbits).toHaveLength(m);
      expect(planets).toHaveLength(Number(n));
      for (let k = 0; k < m; k++) expect(planets.some(p => p.orbit === k)).toBe(true);
    }
  });

  it('keeps book order from the inner orbit outwards', () => {
    const { planets } = layoutOrbits(laws(13), stage);
    const orbitOf = planets.map(p => p.orbit);
    expect([...orbitOf].sort((a, b) => a - b)).toEqual(orbitOf);
  });

  it('the centre projects onto the sun', () => {
    const c = project(0, 1.23, stage);
    expect(c.x).toBeCloseTo(stage.cx);
    expect(c.y).toBeCloseTo(stage.cy);
  });

  it('a planet in front is bigger than the same planet behind', () => {
    const front = project(100, Math.PI / 2, stage);
    const back = project(100, (3 * Math.PI) / 2, stage);
    expect(front.near).toBeCloseTo(1);
    expect(back.near).toBeCloseTo(0);
    expect(planetScale(front.s, front.near)).toBeGreaterThan(planetScale(back.s, back.near) * 2);
  });

  it('planet size grows with the number of sections', () => {
    expect(planetSize(1755)).toBe(28);
    expect(planetSize(0)).toBe(13);
    expect(planetSize(400)).toBeGreaterThan(planetSize(30));
  });
});

describe('labels', () => {
  const frame = (angle, prev = new Map()) => {
    const { planets } = layoutOrbits(laws(13), stage);
    const labels = planets.map(p => {
      const q = project(p.r, p.phase + angle, stage);
      const k = planetScale(q.s, q.near);
      const fs = 8.5 + 3 * q.near;
      return { id: p.id, x: q.x, y: q.y, rad: (p.size * k) / 2, w: 44 * (fs / 11), h: fs * 1.45, near: q.near, slot: prev.get(p.id)?.slot };
    });
    return { labels, placed: placeLabels(labels, { minX: 4, maxX: 296 }) };
  };

  it('gives every planet a label', () => {
    const { placed } = frame(0.4);
    expect(placed.size).toBe(13);
  });

  it('labels that are not crowded stay inside and never overlap', () => {
    for (const angle of [0, 0.7, 1.9, 3.3, 5.1]) {
      const { labels, placed } = frame(angle);
      const boxes = labels.map(l => ({ ...placed.get(l.id), w: l.w, h: l.h })).filter(b => !b.crowded);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(4);
        expect(b.x + b.w).toBeLessThanOrEqual(296);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('keeps each label on the side it had last frame', () => {
    const first = frame(1.0);
    const again = frame(1.0, first.placed);
    for (const [id, p] of first.placed) expect(again.placed.get(id).slot).toBe(p.slot);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/orbit.test.js`
Expected: FAIL "Failed to resolve import ./orbit.js"

- [ ] **Step 3: เขียน `src/lib/orbit.js`**

```js
// Geometry for the Galaxy home's solar system — pure math, no DOM, so it can
// be tested. The camera is the one the user tuned in the mockup on 2026-10-28
// (spec 3.2); the stage numbers are for a 300px-wide stage and scale with it.

export const CAMERA = { tilt: 25, roll: -17, depth: 88, period: 180 };
export const HIT_PX = 48;   // tap target, kept the same size front and back

const BASE_WIDTH = 300;
const STAGE = { cx: 150, cy: 138, height: 330, rIn: 60, rOut: 126, rOne: 95 };
const MAX_K = 1.3;          // past this the system only grows taller, not clearer

const rad = (deg) => (deg * Math.PI) / 180;

export function stageFor(width) {
  const k = Math.min(MAX_K, Math.max(0.5, width / BASE_WIDTH));
  return {
    cx: width / 2,
    cy: STAGE.cy * k,
    height: Math.round(STAGE.height * k),
    rIn: STAGE.rIn * k,
    rOut: STAGE.rOut * k,
    rOne: STAGE.rOne * k,
    k,
    camera: CAMERA,
  };
}

// A point on the orbit plane at radius r and angle theta (theta = π/2 is the
// front, nearest the viewer) seen through the camera. `s` is the perspective
// scale, `zd` the depth (positive = in front of the sun), `near` 0 back … 1 front.
export function project(r, theta, { cx, cy, k = 1, camera = CAMERA }) {
  const tilt = rad(camera.tilt), roll = rad(camera.roll);
  const D = (900 - camera.depth * 6) * k;
  const X = r * Math.cos(theta), Z = r * Math.sin(theta);
  const y = Z * Math.sin(tilt), zd = Z * Math.cos(tilt);
  const s = D / (D - zd);
  const sx = X * s, sy = y * s;
  return {
    x: cx + sx * Math.cos(roll) - sy * Math.sin(roll),
    y: cy + sx * Math.sin(roll) + sy * Math.cos(roll),
    s,
    zd,
    near: (Math.sin(theta) + 1) / 2,
  };
}

// Exaggerated beyond true perspective so front and back read at a glance.
export function planetScale(s, near) {
  return Math.pow(s, 2.2) * (0.78 + 0.32 * near);
}

export function orbitCount(n) {
  return n <= 3 ? 1 : n <= 7 ? 2 : n <= 10 ? 3 : 4;
}

export function planetSize(totalSections) {
  return Math.round(13 + 15 * Math.sqrt(Math.max(0, totalSections) / 1755));
}

// Inner orbit first, in the order given. Planets per orbit follow the orbit's
// length; adjacent orbits are offset by half a slot, and the whole system
// turns at one speed, so two planets never come to sit on top of each other.
export function layoutOrbits(laws, { rIn = STAGE.rIn, rOut = STAGE.rOut, rOne = STAGE.rOne, k = 1 } = {}) {
  const n = laws.length;
  if (!n) return { orbits: [], planets: [] };
  const m = orbitCount(n);
  const orbits = [];
  for (let i = 0; i < m; i++) {
    orbits.push({ r: m === 1 ? rOne : rIn + (i * (rOut - rIn)) / (m - 1), count: 0 });
  }
  const total = orbits.reduce((sum, o) => sum + o.r, 0);
  let left = n;
  for (const o of orbits) {
    o.count = Math.max(1, Math.floor((n * o.r) / total));
    left -= o.count;
  }
  for (let i = m - 1; left > 0; i = (i - 1 + m) % m) { orbits[i].count++; left--; }
  for (let i = m - 1; left < 0; i = (i - 1 + m) % m) {
    if (orbits[i].count > 1) { orbits[i].count--; left++; }
  }
  const planets = [];
  let next = 0;
  orbits.forEach((o, orbit) => {
    for (let q = 0; q < o.count; q++) {
      const law = laws[next++];
      planets.push({
        id: law.id,
        orbit,
        r: o.r,
        phase: (2 * Math.PI * q) / o.count + ((orbit % 2) * Math.PI) / o.count + 0.35 * orbit,
        size: Math.round(planetSize(law.totalSections) * k),
      });
    }
  });
  return { orbits: orbits.map(o => o.r), planets };
}

function overlaps(a, b) {
  return a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Every planet keeps its name (spec 3.4). Nearest first, each label takes the
// first free slot — the one it had last frame, then below, above, right,
// left. With no free slot it keeps its old one and is marked crowded, which
// the caller draws at half opacity rather than hiding.
export function placeLabels(labels, { minX, maxX }) {
  const placed = [];
  const out = new Map();
  for (const l of [...labels].sort((a, b) => b.near - a.near)) {
    const slots = [
      { x: l.x - l.w / 2, y: l.y + l.rad + 2 },
      { x: l.x - l.w / 2, y: l.y - l.rad - l.h - 1 },
      { x: l.x + l.rad + 4, y: l.y - l.h / 2 },
      { x: l.x - l.rad - 4 - l.w, y: l.y - l.h / 2 },
    ];
    let chosen = -1;
    for (const i of [l.slot ?? 0, 0, 1, 2, 3]) {
      const box = { ...slots[i], w: l.w, h: l.h };
      if (box.x < minX || box.x + l.w > maxX) continue;
      if (placed.some(o => overlaps(box, o))) continue;
      chosen = i;
      break;
    }
    const crowded = chosen < 0;
    if (crowded) chosen = l.slot ?? 0;
    const s = slots[chosen];
    placed.push({ x: s.x, y: s.y, w: l.w, h: l.h });
    out.set(l.id, { x: s.x, y: s.y, slot: chosen, crowded });
  }
  return out;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/orbit.test.js`
Expected: PASS 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/orbit.js src/lib/orbit.test.js
git commit -m "feat(galaxy): solar-system geometry — projection, orbits, labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: toast มีปุ่ม action

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
    const onPress = () => {};
    showToast('เพิ่มแล้ว', { action: { label: 'เลิกทำ', onPress } });
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
Expected: FAIL ที่เทสต์แรก (ได้ `[['สวัสดี']]` ไม่มี `undefined`) และเทสต์ที่สอง (ได้ `[undefined]`)

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

แทนทั้งฟังก์ชัน `ToastHost` (คง import และค่าคงที่เดิมไว้ แล้วเพิ่ม `ACTION_MS`):

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
            className="pointer-events-auto tap-btn font-ui text-[12px] font-bold text-accent flex-shrink-0"
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

### Task 6: คิวฟังต่อ (`lib/resumeQueue.js` + TtsContext)

**Files:**
- Create: `src/lib/resumeQueue.js`, `src/lib/resumeQueue.test.js`
- Modify: `src/context/TtsContext.jsx`

**Interfaces:**
- Consumes: `buildItemsFromRefs(books, refs)` จาก `src/lib/sectionText.js`; item ของ tts มี `{ sectionId, bookId, number, ... }`; `tts.currentItemIndex()` คืน index ของ item ที่กำลังเริ่มในตอนที่ `onItemStart` ถูกเรียก (ทั้ง JS loop และ `enterNativeItem`)
- Produces (`resumeQueue.js`): `defaultLabel(items)`, `startQueue(items, startIndex, label?)`, `markItem(index)`, `markDone()`, `getResume() → { label, refs, index, done, updatedAt } | null`, `clearResume()`, `resolveResume(record, books) → { label, refs, index } | null`
- Produces (`useTts()`): `playSections(items, startIndex = 0, { label }?)`, `playResume() → boolean`, `resumeQueue` (ค่าจาก `getResume()` ตอน render)

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
// The queue the sun on the Galaxy home resumes (spec 4): the whole list that
// was playing and where it stopped. A section is counted as heard once the
// next one starts, so resuming replays the cut-off section from its start
// and goes on from there — 1–10 stopped in section 2 resumes 2, 3 … 10.
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
  return `${meta?.orbitName ?? meta?.shortName ?? ''} ม.${first.number}`.trim();
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
  // `label` names the queue on the Galaxy home's sun ("สอบเนติ สมัย 78").
  // The queue is saved before playItems because native announces its first
  // section from inside it, and markItem needs the new queue already there.
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

  // The sun's "ฟังต่อ". False when there is nothing to resume, so the caller
  // can fall back to the last-read section. A queue whose sections are all
  // gone is cleared — but only once the corpus has loaded.
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
Expected: ผ่านทั้งหมด (เทสต์เดิมของ tts ใช้ `tts.js` โดยตรง ไม่ผ่าน context)

- [ ] **Step 7: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

ใน dev server เล่นโฟลเดอร์ที่มีหลายมาตรา ปล่อยให้ขึ้นมาตราที่ 2 แล้วกดหยุด ดู `localStorage['lawcode-th-resume']` ต้องเป็น `index: 1` และ `done: false` จากนั้นเล่นคิวสั้น 1 มาตราจนจบ ต้องได้ `done: true`

- [ ] **Step 8: Commit**

```bash
git add src/lib/resumeQueue.js src/lib/resumeQueue.test.js src/context/TtsContext.jsx
git commit -m "feat(tts): remember the playing queue so it can be resumed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ฉากอวกาศและระบบสุริยะ (component)

**Files:**
- Create: `src/components/galaxy/GalaxySky.jsx`, `src/components/galaxy/SolarSystem.jsx`
- Modify: `src/styles/galaxy.css`

**Interfaces:**
- Consumes: ทุกอย่างจาก `src/lib/orbit.js` (Task 4)
- Produces:
  - `<GalaxySky still={boolean} />` — absolute เต็มกล่องแม่ที่เป็น `relative`
  - `<SolarSystem planets selectedId onPlanetPress sun still />`
    - `planets: { id, name, color, fullName, totalSections, available }[]`
    - `onPlanetPress(id)`
    - `sun: { icon: 'play' | 'pause', title, sub, onPress, disabled? }`
    - `still`: true = ค้างนิ่ง ไม่วิ่ง frame loop

- [ ] **Step 1: สร้าง `src/components/galaxy/GalaxySky.jsx`**

```jsx
// The Galaxy home's sky, after กฎดิ's space mode: nebula, three star layers
// drifting at different speeds, twinkles, a ringed planet and comets. Every
// animation is CSS transform/opacity; `still` stops them all.
import { useMemo } from 'react';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Seeded, so the sky is the same every launch.
function starField() {
  const r = rng(20261028);
  const layer = (count, alpha) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const tint = r() < 0.18 ? '255,214,170' : r() < 0.3 ? '190,205,255' : '255,255,255';
      out.push(`${Math.round(r() * 1400)}px ${Math.round(r() * 1800)}px rgba(${tint},${(alpha * (0.4 + r() * 0.6)).toFixed(2)})`);
    }
    return out.join(',');
  };
  const twinkle = Array.from({ length: 22 }, () => ({
    left: `${(r() * 100).toFixed(1)}%`,
    top: `${(r() * 100).toFixed(1)}%`,
    animationDelay: `-${(r() * 6).toFixed(2)}s`,
    animationDuration: `${(3 + r() * 4).toFixed(2)}s`,
  }));
  return { small: layer(260, 0.8), mid: layer(80, 0.95), big: layer(22, 1), twinkle };
}

export default function GalaxySky({ still = false }) {
  const stars = useMemo(starField, []);
  return (
    <div className={`gx-sky${still ? ' is-still' : ''}`} aria-hidden="true">
      <i className="gx-neb" />
      <i className="gx-band" />
      <i className="gx-stars gx-s1" style={{ boxShadow: stars.small }} />
      <i className="gx-stars gx-s2" style={{ boxShadow: stars.mid }} />
      <i className="gx-stars gx-s3" style={{ boxShadow: stars.big }} />
      {stars.twinkle.map((t, i) => <span key={i} className="gx-tw" style={t} />)}
      <i className="gx-bigplanet"><i className="gx-bigplanet-ring" /></i>
      <i className="gx-comet" />
      <i className="gx-comet gx-c2" />
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `src/components/galaxy/SolarSystem.jsx`**

```jsx
// The Galaxy home's solar system. Geometry is lib/orbit.js; this file owns the
// DOM and the frame loop. A frame writes only transform, opacity and z-index
// (spec 3.7) — what kept กฎดิ's ring at 60 fps on a slow phone.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CAMERA, HIT_PX, layoutOrbits, placeLabels, planetScale, project, stageFor } from '../../lib/orbit';

const LABEL_PX = 11;   // labels are laid out at this size, then scaled per frame
const RING_STEPS = 72;

function ringPath(r, from, to, stage) {
  let d = '';
  for (let i = 0; i <= RING_STEPS; i++) {
    const p = project(r, from + ((to - from) * i) / RING_STEPS, stage);
    d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

export default function SolarSystem({ planets, selectedId, onPlanetPress, sun, still }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth || 300);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stage = useMemo(() => stageFor(width), [width]);
  const layout = useMemo(() => layoutOrbits(planets, stage), [planets, stage]);
  const byId = useMemo(() => new Map(planets.map(p => [p.id, p])), [planets]);
  const paths = useMemo(() => ({
    disc: `${ringPath(stage.rOut + 24 * stage.k, 0, 2 * Math.PI, stage)}Z`,
    back: layout.orbits.map(r => ringPath(r, Math.PI, 2 * Math.PI, stage)),
    front: layout.orbits.map(r => ringPath(r, 0, Math.PI, stage)),
  }), [layout, stage]);

  // id → { planet, hit, label, w0, slot, lx, ly }. Mutated, never replaced,
  // so ref callbacks on re-render keep what the frame loop remembered.
  const els = useRef({});
  const reg = (id, key) => (el) => { (els.current[id] ||= {})[key] = el; };
  const angle = useRef(0);

  // Label widths at LABEL_PX, measured once per set of planets.
  useLayoutEffect(() => {
    for (const p of layout.planets) {
      const e = els.current[p.id];
      if (e?.label) e.w0 = e.label.offsetWidth;
    }
  }, [layout]);

  useEffect(() => {
    const draw = (snap) => {
      const labels = [];
      const drawn = [];
      for (const p of layout.planets) {
        const e = els.current[p.id];
        if (!e?.planet || !e.hit || !e.label) continue;
        const q = project(p.r, p.phase + angle.current, stage);
        const k = planetScale(q.s, q.near);
        const z = String(1000 + Math.round(q.zd));
        const half = p.size / 2;
        e.planet.style.transform = `translate3d(${(q.x - half).toFixed(1)}px,${(q.y - half).toFixed(1)}px,0) scale(${k.toFixed(3)})`;
        e.planet.style.zIndex = z;
        const [glow, , light, dim] = e.planet.children;
        glow.style.opacity = (0.15 + 0.6 * q.near).toFixed(2);
        dim.style.opacity = (0.55 * (1 - q.near)).toFixed(2);
        // The lit side faces the sun.
        light.style.transform = `rotate(${((Math.atan2(stage.cy - q.y, stage.cx - q.x) * 180) / Math.PI).toFixed(0)}deg)`;
        e.hit.style.transform = `translate3d(${(q.x - HIT_PX / 2).toFixed(1)}px,${(q.y - HIT_PX / 2).toFixed(1)}px,0)`;
        e.hit.style.zIndex = z;
        const fs = 8.5 + 3 * q.near;
        const sc = fs / LABEL_PX;
        labels.push({ id: p.id, x: q.x, y: q.y, rad: (p.size * k) / 2, w: (e.w0 || 40) * sc, h: fs * 1.45, near: q.near, slot: e.slot });
        drawn.push({ id: p.id, e, z, sc, near: q.near });
      }
      const placed = placeLabels(labels, { minX: 4, maxX: width - 4 });
      for (const d of drawn) {
        const pl = placed.get(d.id);
        const e = d.e;
        e.slot = pl.slot;
        // Ease towards a new side instead of jumping there.
        e.lx = snap || e.lx == null ? pl.x : e.lx + (pl.x - e.lx) * 0.18;
        e.ly = snap || e.ly == null ? pl.y : e.ly + (pl.y - e.ly) * 0.18;
        e.label.style.transform = `translate3d(${e.lx.toFixed(1)}px,${e.ly.toFixed(1)}px,0) scale(${d.sc.toFixed(3)})`;
        e.label.style.opacity = ((pl.crowded ? 0.5 : 1) * (0.6 + 0.4 * d.near)).toFixed(2);
        e.label.style.zIndex = d.z;
      }
    };

    if (still) {
      draw(true);
      return undefined;
    }
    const speed = (2 * Math.PI) / (CAMERA.period * 1000); // radians per ms
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      angle.current += (now - last) * speed;
      last = now;
      draw(false);
      raf = requestAnimationFrame(tick);
    };
    draw(true);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, stage, still, width]);

  return (
    <div ref={wrapRef} className="gx-solar" style={{ height: stage.height }}>
      <svg aria-hidden="true" style={{ zIndex: 1 }}>
        <defs>
          <radialGradient id="gx-disc">
            <stop offset="0" stopColor="rgba(150,130,255,0.22)" />
            <stop offset="0.6" stopColor="rgba(90,120,255,0.07)" />
            <stop offset="1" stopColor="rgba(90,120,255,0)" />
          </radialGradient>
        </defs>
        <path d={paths.disc} fill="url(#gx-disc)" />
        {paths.back.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(190,200,255,0.13)" strokeDasharray={i % 2 ? '3 4' : undefined} />
        ))}
      </svg>

      <button
        type="button"
        className="gx-sun"
        style={{ left: stage.cx - 37, top: stage.cy - 37 }}
        onClick={sun.onPress}
        disabled={!!sun.disabled}
        aria-label={`${sun.title} ${sun.sub || ''}`.trim()}
      >
        <span className="gx-sun-icon" aria-hidden="true">{sun.icon === 'pause' ? '❚❚' : '▶'}</span>
        <span>{sun.title}</span>
        {sun.sub && <span className="gx-sun-sub">{sun.sub}</span>}
      </button>

      <svg aria-hidden="true" style={{ zIndex: 1001 }}>
        {paths.front.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(200,210,255,0.34)" strokeWidth="1.2" strokeDasharray={i % 2 ? '3 4' : undefined} />
        ))}
      </svg>

      {layout.planets.map(p => {
        const law = byId.get(p.id);
        return (
          <Fragment key={p.id}>
            <div
              ref={reg(p.id, 'planet')}
              className={`gx-planet${p.id === selectedId ? ' is-selected' : ''}${law.available === false ? ' is-soon' : ''}`}
              style={{ width: p.size, height: p.size, '--c': law.color }}
              aria-hidden="true"
            >
              <i className="gx-planet-glow" />
              <i className="gx-planet-sphere" />
              <i className="gx-planet-light" />
              <i className="gx-planet-dim" />
            </div>
            <button
              ref={reg(p.id, 'hit')}
              type="button"
              className="gx-hit"
              onClick={() => onPlanetPress(p.id)}
              aria-label={law.fullName}
            />
            <div ref={reg(p.id, 'label')} className="gx-label" aria-hidden="true">{law.name}</div>
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: เพิ่มสไตล์ใน `src/styles/galaxy.css`**

ต่อท้ายไฟล์:

```css
/* ── Sky (Home) ─────────────────────────────────────────────────────────── */
.gx-sky { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
  background: radial-gradient(120% 80% at 50% 0%, #0d1433 0%, #070a1a 45%, #03040b 100%);
  animation: gx-fade-in 0.9s ease-out both; }
@keyframes gx-fade-in { from { opacity: 0; } }
.gx-sky i, .gx-sky span { position: absolute; display: block; }
.gx-neb { inset: -25%;
  background:
    radial-gradient(34% 26% at 22% 30%, rgba(120, 72, 255, 0.32), transparent 70%),
    radial-gradient(30% 24% at 84% 22%, rgba(255, 80, 150, 0.16), transparent 70%),
    radial-gradient(36% 30% at 78% 62%, rgba(0, 170, 220, 0.2), transparent 70%),
    radial-gradient(40% 30% at 30% 80%, rgba(90, 60, 220, 0.22), transparent 70%);
  animation: gx-neb 46s ease-in-out infinite alternate; }
@keyframes gx-neb { from { transform: translate3d(-3%, -2%, 0) scale(1); } to { transform: translate3d(3%, 2%, 0) scale(1.08); } }
.gx-band { left: -40%; right: -40%; top: 34%; height: 34%; transform: rotate(-28deg); opacity: 0.9;
  background: linear-gradient(180deg, transparent, rgba(160, 150, 255, 0.1) 30%, rgba(255, 226, 210, 0.16) 50%, rgba(160, 150, 255, 0.1) 70%, transparent); }
.gx-stars { left: 0; top: 0; border-radius: 50%; }
.gx-s1 { width: 1px; height: 1px; animation: gx-drift 160s linear infinite; }
.gx-s2 { width: 1.5px; height: 1.5px; animation: gx-drift 110s linear infinite; }
.gx-s3 { width: 2.5px; height: 2.5px; animation: gx-drift 70s linear infinite; }
@keyframes gx-drift { to { transform: translate3d(-80px, 14px, 0); } }
.gx-tw { width: 3px; height: 3px; border-radius: 50%; background: #fff; box-shadow: 0 0 6px 1px rgba(200, 215, 255, 0.8);
  animation: gx-twinkle 4s ease-in-out infinite alternate; }
@keyframes gx-twinkle { from { opacity: 0.1; transform: scale(0.6); } to { opacity: 1; transform: scale(1.2); } }
.gx-bigplanet { left: -38vmax; bottom: -30vmax; width: 62vmax; height: 62vmax; border-radius: 50%; opacity: 0.9;
  background:
    radial-gradient(circle at 70% 26%, rgba(255, 220, 190, 0.35), transparent 34%),
    repeating-linear-gradient(-18deg, rgba(255, 255, 255, 0.05) 0 3%, rgba(0, 0, 0, 0.08) 3% 7%, rgba(255, 190, 150, 0.06) 7% 9%),
    radial-gradient(circle at 62% 32%, #6b4fa8 0%, #3a2a6e 38%, #160f33 70%, #07050f 100%);
  box-shadow: 0 0 60px 8px rgba(140, 110, 255, 0.35), inset -30px 30px 80px rgba(255, 200, 170, 0.18); }
.gx-bigplanet-ring { left: -18%; right: -18%; top: 44%; height: 16%; border-radius: 50%;
  border: 2px solid rgba(220, 200, 255, 0.22); box-shadow: 0 0 18px rgba(170, 150, 255, 0.25); transform: rotate(-18deg); }
.gx-comet { left: 88%; top: 10%; width: 130px; height: 2px; opacity: 0; border-radius: 2px;
  background: linear-gradient(90deg, rgba(235, 242, 255, 1), rgba(190, 210, 255, 0.5) 25%, rgba(255, 255, 255, 0));
  animation: gx-comet 13s linear infinite 3s; }
.gx-c2 { left: 30%; top: 4%; width: 90px; animation-duration: 19s; animation-delay: 11s; }
@keyframes gx-comet {
  0%, 86% { opacity: 0; transform: translate3d(0, 0, 0) rotate(-24deg); }
  88% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(-380px, 170px, 0) rotate(-24deg); }
}
.gx-sky.is-still, .gx-sky.is-still * { animation: none !important; }
.gx-sky.is-still .gx-comet { display: none; }

/* ── Solar system ───────────────────────────────────────────────────────── */
/* isolation keeps the planets' z-index 1000+ from rising above the tab bar
   and the sheets. */
.gx-solar { position: relative; width: 100%; isolation: isolate; user-select: none; -webkit-user-select: none; }
.gx-solar svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.gx-sun { position: absolute; width: 74px; height: 74px; padding: 0; border: 0; border-radius: 50%; z-index: 1000;
  color: #2a1408; font: 600 9px/1.25 var(--f-ui); text-align: center;
  background: radial-gradient(circle at 40% 35%, #fff2de, #ffc58a 30%, #f2a865 55%, #c0602a 85%);
  box-shadow: 0 0 30px 8px rgba(242, 168, 101, 0.5), 0 0 90px 30px rgba(242, 120, 60, 0.2); }
.gx-sun::before { content: ''; position: absolute; inset: -14px; z-index: -1; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(242, 168, 101, 0.45), transparent);
  animation: gx-sun 2.6s ease-in-out infinite alternate; }
@keyframes gx-sun { from { opacity: 0.5; transform: scale(0.94); } to { opacity: 1; transform: scale(1.06); } }
.gx-sun:disabled { opacity: 0.6; }
.gx-sun-icon { display: block; font-size: 15px; line-height: 1; margin-bottom: 2px; }
.gx-sun-sub { display: block; max-width: 64px; margin: 0 auto; font-size: 8px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gx-planet { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.gx-planet > i { position: absolute; inset: 0; display: block; border-radius: 50%; }
.gx-planet > .gx-planet-glow { inset: -5px; box-shadow: 0 0 12px 3px var(--c); opacity: 0.5; }
.gx-planet-sphere { background: var(--c); box-shadow: inset -3px -4px 8px rgba(0, 0, 0, 0.55), inset 2px 2px 4px rgba(255, 255, 255, 0.15); }
.gx-planet-light { background: radial-gradient(circle at 82% 50%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 48%); }
.gx-planet-dim { background: #04060e; opacity: 0; }
.gx-planet.is-selected .gx-planet-sphere { outline: 1.5px solid rgb(var(--c-accent)); outline-offset: 3px; }
.gx-planet.is-soon { opacity: 0.45; }
.gx-hit { position: absolute; left: 0; top: 0; width: 48px; height: 48px; margin: 0; padding: 0; border: 0;
  border-radius: 50%; background: transparent; will-change: transform; }
.gx-label { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; white-space: nowrap;
  font: 600 11px/1.45 var(--f-ui); color: #eef0ff; will-change: transform, opacity;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6); }
```

- [ ] **Step 4: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด (component ยังไม่ถูก render จนถึง Task 8)

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/GalaxySky.jsx src/components/galaxy/SolarSystem.jsx src/styles/galaxy.css
git commit -m "feat(galaxy): sky and 3D solar-system components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: หน้าแรก Galaxy

**Files:**
- Create: `src/screens/GalaxyHome.jsx`
- Modify: `src/App.jsx`, `src/styles/galaxy.css`

**Interfaces:**
- Consumes: `GalaxySky`, `SolarSystem` (Task 7), `OrbitPickerSheet` (Task 3), `orbitBooks`, `resolveReduceMotion`, `resolveTheme` (Task 2), `useTts()` ได้ `playSections`, `playResume`, `resumeQueue` (Task 6) และ `playing`, `paused`, `pause`, `resume`, `currentItem` (มีอยู่แล้ว), `getStatsByBook()` จาก `src/lib/stats.js` (`{ [bookId]: [{ sectionId, ... }] }`)
- Produces: `GalaxyHome` (default export) และ `ThemedScreen` ใน `App.jsx` (`<ThemedScreen classic={C} galaxy={G} />`)

- [ ] **Step 1: สร้าง `src/screens/GalaxyHome.jsx`**

```jsx
// Galaxy theme's Home (spec 3): the laws as a 3D solar system around a
// "continue listening" sun, then every law with how much of it was heard.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';
import VoiceNewsCard from '../components/VoiceNewsCard';
import GalaxySky from '../components/galaxy/GalaxySky';
import SolarSystem from '../components/galaxy/SolarSystem';
import OrbitPickerSheet from '../components/galaxy/OrbitPickerSheet';
import { buildItemsFromRefs } from '../lib/sectionText';
import { getStatsByBook } from '../lib/stats';
import { showToast } from '../lib/toast';
import { orbitBooks, resolveReduceMotion } from '../lib/theme';
import { LAW_BOOKS_META } from '../data/lawMeta';

const metaOf = (id) => LAW_BOOKS_META.find(m => m.id === id);
const nameOf = (id) => metaOf(id)?.orbitName ?? '';

export default function GalaxyHome() {
  const navigate = useNavigate();
  const { books, history, loadingData, settings } = useApp();
  const { playSections, playResume, resumeQueue, playing, paused, pause, resume, currentItem } = useTts();
  const [selectedId, setSelectedId] = useState(null);
  const [orbitOpen, setOrbitOpen] = useState(false);

  // The frame loop stops while the app is in the background (spec 3.7).
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  const still = resolveReduceMotion(settings);

  const planets = useMemo(() => orbitBooks(settings).map(m => {
    const b = books.find(x => x.id === m.id);
    return {
      id: m.id, name: m.orbitName, color: m.orbitColor, fullName: m.fullName,
      totalSections: b?.totalSections ?? m.totalSections, available: m.available,
    };
  }), [settings.orbitHidden, books]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-read when a section starts or playback stops, so progress keeps up.
  const heardByBook = useMemo(() => getStatsByBook(), [playing, currentItem?.sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id) => {
    if (!metaOf(id)?.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate(`/code/${id}`);
  };
  const onPlanetPress = (id) => {
    if (selectedId === id) open(id);
    else setSelectedId(id);
  };

  const lastRead = history[0];
  const listenLastRead = () => {
    if (!lastRead) { navigate('/select'); return; }
    const items = buildItemsFromRefs(books, [{ sectionId: lastRead.sectionId, bookId: lastRead.bookId }]);
    if (items.length) playSections(items, 0);
    else showToast('เปิดมาตรานี้ไม่ได้');
  };

  // spec 4.2
  const now = currentItem ? `${nameOf(currentItem.bookId)} ม.${currentItem.number}` : '';
  let sun;
  if (playing && !paused) sun = { icon: 'pause', title: 'กำลังฟัง', sub: now, onPress: pause };
  else if (paused) sun = { icon: 'play', title: 'ฟังต่อ', sub: now, onPress: resume };
  else if (resumeQueue && !resumeQueue.done) {
    sun = {
      icon: 'play', title: 'ฟังต่อ',
      sub: `${resumeQueue.label} · ${resumeQueue.index + 1}/${resumeQueue.refs.length}`,
      onPress: () => { if (!playResume()) listenLastRead(); },
      disabled: loadingData,
    };
  } else if (lastRead) {
    sun = { icon: 'play', title: 'ฟัง', sub: `${nameOf(lastRead.bookId)} ม.${lastRead.number}`, onPress: listenLastRead, disabled: loadingData };
  } else sun = { icon: 'play', title: 'เริ่มฟัง', sub: '', onPress: () => navigate('/select') };

  const picked = selectedId ? metaOf(selectedId) : null;
  const pickedBook = picked ? books.find(b => b.id === picked.id) : null;

  return (
    <div className="relative flex flex-col h-full overflow-hidden text-paper font-ui">
      <GalaxySky still={still} />
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <AdBanner />
        <div className="flex items-center justify-between px-4 pt-2 pb-1 flex-shrink-0">
          <div className="text-[18px] font-bold tracking-tight">Juris <span className="text-accent">Voice</span></div>
          <button
            onClick={() => setOrbitOpen(true)}
            className="tap-btn gx-icon-btn w-9 h-9 rounded-full grid place-items-center text-[15px]"
            aria-label="เลือกดาวที่โคจร"
          >
            ⚙
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <VoiceNewsCard />

          <SolarSystem
            planets={planets}
            selectedId={selectedId}
            onPlanetPress={onPlanetPress}
            sun={sun}
            still={still || hidden}
          />

          <button
            onClick={() => picked && open(picked.id)}
            className="tap-btn gx-card mx-4 flex items-center gap-3 px-3 py-2.5 text-left"
            style={{ width: 'calc(100% - 2rem)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: picked?.orbitColor ?? 'rgb(var(--c-accent))' }} />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold truncate">
                {loadingData ? 'กำลังโหลด…' : picked ? picked.fullName : 'แตะดาวเพื่อเปิดกฎหมาย'}
              </span>
              <span className="block text-[10.5px] text-rule-soft">
                {picked
                  ? `${(pickedBook?.totalSections ?? picked.totalSections).toLocaleString()} มาตรา · แตะอีกครั้งเพื่อเปิด`
                  : 'ดวงอาทิตย์ = ฟังต่อจากที่ค้างไว้'}
              </span>
            </span>
            {picked && <span className="text-accent text-[16px]" aria-hidden="true">›</span>}
          </button>

          <div className="px-4 pt-4 pb-1 text-[10px] tracking-[1.5px] text-rule-soft">ทุกฉบับ · {LAW_BOOKS_META.length}</div>
          {LAW_BOOKS_META.map(m => {
            const b = books.find(x => x.id === m.id);
            const total = b?.totalSections ?? m.totalSections;
            const heard = heardByBook[m.id]?.length ?? 0;
            const pct = total ? Math.min(100, Math.round((heard / total) * 100)) : 0;
            return (
              <button key={m.id} onClick={() => open(m.id)} className="tap-row gx-row w-full flex items-center gap-3 px-4 py-2.5 text-left">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.orbitColor }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">{m.displayName ?? m.fullName}</span>
                  <span className="block text-[10.5px] text-rule-soft">
                    {m.available ? `ฟังแล้ว ${heard.toLocaleString()} / ${total.toLocaleString()} มาตรา` : 'เร็ว ๆ นี้'}
                  </span>
                </span>
                <span className="gx-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
              </button>
            );
          })}
          <div className="h-4" />
        </div>

        <TabBar />
      </div>

      {orbitOpen && <OrbitPickerSheet onClose={() => setOrbitOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: สไตล์ส่วนที่หน้าแรกใช้ใน `src/styles/galaxy.css`**

ต่อท้ายไฟล์:

```css
/* ── Shared Galaxy pieces ───────────────────────────────────────────────── */
.gx-icon-btn { background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(200, 210, 255, 0.15); color: #c9cdf0; }
.gx-card { background: rgba(16, 21, 50, 0.86); border: 1px solid rgba(170, 185, 255, 0.16); border-radius: 14px; }
.gx-row { border-bottom: 1px solid rgba(200, 205, 255, 0.06); }
.gx-progress { width: 52px; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, 0.1); overflow: hidden; flex-shrink: 0; }
.gx-progress i { display: block; height: 100%; background: linear-gradient(90deg, #7c6cff, #00c8be); }
```

- [ ] **Step 3: เลือกหน้าแรกตามธีมใน `src/App.jsx`**

เพิ่ม import:

```js
import GalaxyHome from './screens/GalaxyHome';
import { resolveTheme } from './lib/theme';
```

(รวม `resolveTheme` เข้ากับบรรทัด import ของ `./lib/theme` ที่เพิ่มไว้ใน Task 2)

เพิ่มเหนือ `function AppRoutes()`:

```jsx
// Home and Select have their own Galaxy screens (spec 2.6); every other
// route is shared and follows the theme through the CSS tokens.
function ThemedScreen({ classic: Classic, galaxy: Galaxy }) {
  const { settings } = useApp();
  return resolveTheme(settings) === 'galaxy' ? <Galaxy /> : <Classic />;
}
```

เปลี่ยน `<Route path="/" element={<HomeScreen />} />` เป็น:

```jsx
            <Route path="/" element={<ThemedScreen classic={HomeScreen} galaxy={GalaxyHome} />} />
```

- [ ] **Step 4: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 5: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

เปิด `/` ที่ขนาด mobile (375×812) แล้วตรวจ:
- ดาว 13 ดวงหมุน 4 วง ดาวหน้าใหญ่ ดาวหลังเล็กและลอดหลังดวงอาทิตย์ ทุกดวงมีชื่อ ไม่ทับกัน ไม่ล้นขอบ
- แตะดาวครั้งแรกแถบใต้ระบบขึ้นชื่อเต็ม แตะซ้ำเปิดหน้าฉบับนั้น
- ดวงอาทิตย์ทำตามตารางใน spec 4.2 (ลองทั้งตอนไม่มีประวัติ, มีประวัติ, มีคิวค้างจาก Task 6, กำลังเล่น)
- ⚙ เปิดแผ่นดาวที่โคจร ปิดบางฉบับแล้วจำนวนวงเปลี่ยนตาม
- ตั้งค่า › ลดการเคลื่อนไหว แล้วทุกอย่างหยุด ป้ายยังครบ
- console ไม่มี error และ `read_console_messages` สะอาด
- สลับเป็น Classic แล้วหน้าแรกกลับเป็นแบบเดิม

- [ ] **Step 6: Commit**

```bash
git add src/screens/GalaxyHome.jsx src/App.jsx src/styles/galaxy.css
git commit -m "feat(galaxy): Home — 3D solar system with a resume-queue sun

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: แยก logic หน้าเลือกฟังเป็น hook (Classic ไม่เปลี่ยน)

**Files:**
- Create: `src/lib/selection.js`, `src/lib/selection.test.js`
- Create: `src/hooks/useTocNavigation.js`, `src/hooks/useSectionSelection.js`, `src/hooks/useFolderPlayback.js`
- Modify: `src/lib/toc.js`, `src/screens/SelectScreen.jsx`

**Interfaces:**
- Consumes: `playSections(items, start, { label })` (Task 6)
- Produces:
  - `selection.js`: `keyOf(bookId, sectionId)`, `toggleOne(prev, bookId, section)`, `toggleMany(prev, bookId, sections)`, `selectionState(selected, bookId, sections) → { all, some, count, total }`
  - `toc.js`: `tocNodeKey(node, idx)`
  - `useTocNavigation({ activeBook, filter }) → { tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections }`
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
// Ticking sections on the Select screen, without React, so Classic and Galaxy
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
// SelectScreen unchanged so GalaxySelect can share it.
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

  const currentToc = tocByBook[activeBook?.id] || [];
  const currentNodes = tocPath.length ? tocPath[tocPath.length - 1].children : currentToc;
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

  return { tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections };
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
// Play buttons on the Select screen. A button whose own source is already
// playing stops it instead of starting it again — without that the only way
// to stop was the player bar, and pressing the button you just pressed looked
// like the app had hung. Which button is "the one playing" is tracked here:
// two folders can hold the same sections, and the engine knows what it reads
// but not who asked.
import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';
import { isSpeaking as ttsIsSpeaking } from '../lib/tts';
import { buildItemsFromRefs } from '../lib/sectionText';
import { sortSectionsByNumber } from '../lib/folders';
import { showToast } from '../lib/toast';

export function useFolderPlayback({ books, folders, selectedList }) {
  const { playSections, playing, stop } = useTts();
  const [playingSource, setPlayingSource] = useState(null);

  const isPlayingSource = (source) => playing && playingSource === source;

  // The icon reads the rendered `playing`, but the decision must not: a press
  // before React re-renders would see a stale value and start the same thing
  // over. isSpeaking() is read from the engine at the moment of the tap.
  const isPlayingSourceNow = (source) => ttsIsSpeaking() && playingSource === source;

  // Playback also ends on its own, or from the player bar.
  useEffect(() => { if (!playing) setPlayingSource(null); }, [playing]);

  // `label` names the queue on the Galaxy home's sun (spec 4.1).
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
   - ตั้งแต่ `// v15 #2: TOC navigation stack on the left panel` ลงไปจนถึงบรรทัดก่อน `const refreshFolders = () => setFolders(getFolders());` (state ของ TOC, `fetchToc`, effect สองตัว, `retryToc`)
   - ตั้งแต่บรรทัดถัดจาก `const refreshFolders = …` (`const selectedList = …`) ลงไปจนถึงบรรทัดก่อน `const addToTarget = () => {` (currentToc, currentNodes, atLeaf, visibleSections, nodeAllSections, visibleKeys, allSelected, someSelected, selectAllInNode, nodeSelectionState, toggleSelect, toggleSelectAll, isPlayingSource, isPlayingSourceNow, effect ของ playing, startOrStop, playSelected, playLeaf, playGroup)

3. วางแทนที่จุดที่ลบก้อนสุดท้าย (ต่อจาก `const refreshFolders = …`):

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

4. ลบ import ที่ไม่ใช้แล้ว: `useMemo` (ถ้าไม่มีที่อื่นใช้), `useTts`, `isSpeaking as ttsIsSpeaking`, `loadToc`, `sectionsInRange` (ถ้าไม่มีที่อื่นใช้), `buildItemsFromRefs` (คง `cleanTitle` ไว้), `showToast` (ถ้าไม่มีที่อื่นใช้) ตรวจด้วย:

```bash
for w in useMemo useTts ttsIsSpeaking loadToc sectionsInRange buildItemsFromRefs showToast useEffect; do printf "%s: " $w; grep -c "\b$w\b" src/screens/SelectScreen.jsx; done
```

ชื่อที่นับได้ 1 (มีแค่ในบรรทัด import) ให้ลบออกจาก import

- [ ] **Step 10: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 11: ตรวจ Classic (ผู้ควบคุมงานทำ)**

ตั้งธีม Classic เปิด `/select`:
- เลือกฉบับ
- เข้าสารบัญสองชั้น
- ติ๊กมาตรา และกด "เลือกทั้งหมวด"
- ค้นด้วยเลขมาตรา
- ติ๊กมาตราข้ามฉบับแล้ว BookPicker แสดงจำนวนที่เลือก
- "ฟังเลย" กดซ้ำแล้วหยุด
- เล่นโฟลเดอร์และกลุ่ม
- "+ เพิ่มใน" ลงโฟลเดอร์ที่เลือก

ทุกอย่างต้องทำงานและหน้าตาเหมือนภาพใน Task 1

- [ ] **Step 12: Commit**

```bash
git add src/lib/selection.js src/lib/selection.test.js src/lib/toc.js src/hooks/useTocNavigation.js src/hooks/useSectionSelection.js src/hooks/useFolderPlayback.js src/screens/SelectScreen.jsx
git commit -m "refactor(select): selection, TOC and playback logic into shared hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Popup โฟลเดอร์ (`lib/folderPicker.js` + `FolderPickerSheet`)

**Files:**
- Create: `src/lib/folderPicker.js`, `src/lib/folderPicker.test.js`
- Create: `src/components/galaxy/FolderPickerSheet.jsx`
- Modify: `src/styles/galaxy.css`

**Interfaces:**
- Consumes: `getFolders`, `addSectionsToFolder`, `addSectionsToGroup`, `removeSectionFromFolder`, `createFolder` จาก `src/lib/folders.js`; `BottomSheet`
- Produces:
  - `getRecentIds() → string[]`, `pushRecent(ids)`
  - `pickerLists(folders = getFolders()) → { recent, groups, mine }` (โฟลเดอร์ที่ใส่ได้เท่านั้น)
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
    const res = addToFolders([a.id], [sec(1)]);
    expect(res).toEqual({ folderIds: [], added: [] });
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
    const all = [...recent, ...groups, ...own].map(f => f.id);
    expect(all).not.toContain('grp-forgotten');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/folderPicker.test.js`
Expected: FAIL "Failed to resolve import ./folderPicker.js"

- [ ] **Step 3: เขียน `src/lib/folderPicker.js`**

```js
// The "เพิ่มใน…" sheet on the Galaxy Select screen (spec 5.2): add the ticked
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

ถ้าเทสต์ "lists only folders…" ได้ลำดับ `groups` ต่างจากที่คาด ให้ดูลำดับจาก `getFolders()` จริง (permanent groups เรียงตาม `PERM_GROUPS`) แล้วแก้ค่าที่คาดในเทสต์ อย่าแก้ลำดับใน `folders.js`

- [ ] **Step 5: สร้าง `src/components/galaxy/FolderPickerSheet.jsx`**

```jsx
// "เพิ่ม N มาตราใน…" — slides up from the bottom after "＋ เพิ่ม" (spec 5.2).
// Several folders can be ticked; the button adds to all of them at once.
import { useMemo, useState } from 'react';
import BottomSheet from '../BottomSheet';
import { createFolder, getFolders } from '../../lib/folders';
import { addToFolders, alreadyIn, pickerLists, sectionCount } from '../../lib/folderPicker';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const nameOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.orbitName ?? bookId;

export default function FolderPickerSheet({ sections, isPro, onNeedPro, onClose, onAdded }) {
  const [folders, setFolders] = useState(() => getFolders());
  const [checked, setChecked] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const lists = useMemo(() => pickerLists(folders), [folders]);
  const books = [...new Set(sections.map(s => s.bookId))].map(nameOf).join(', ');

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
    const sub = f.type === 'group'
      ? `จะลงใน › ${books}`
      : `${sectionCount(f, folders)} มาตรา`;
    const note = have.length
      ? ` · มี ม.${have[0].number}${have.length > 1 ? ` และอีก ${have.length - 1}` : ''} อยู่แล้ว`
      : '';
    return (
      <button key={f.id} onClick={() => toggle(f.id)} role="checkbox" aria-checked={on}
        className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left">
        <span className="gx-folder-icon" aria-hidden="true">{f.type === 'group' ? '📊' : '📁'}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-medium truncate">{f.name}</span>
          <span className="block text-[10.5px] text-rule-soft truncate">{sub}{note}</span>
        </span>
        <span className={`gx-check${on ? ' is-on' : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>
      </button>
    );
  };

  const section = (title, list) => list.length > 0 && (
    <div key={title}>
      <div className="px-5 pt-3 pb-1 text-[10px] tracking-[1.5px] text-rule-soft">{title}</div>
      {list.map(row)}
    </div>
  );

  return (
    <BottomSheet height="82%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-2 flex items-baseline select-none flex-shrink-0" {...dragHandlers}>
            <span className="text-[16px] font-bold">เพิ่ม {sections.length} มาตราใน…</span>
            <span className="ml-auto text-[10.5px] text-rule-soft">เลือกได้หลายโฟลเดอร์</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {section('ใช้ล่าสุด', lists.recent)}
            {section('สถิติ (แยกลงตามฉบับให้เอง)', lists.groups)}
            {section('โฟลเดอร์ของฉัน', lists.mine)}
            {creating ? (
              <div className="flex items-center gap-2 px-5 py-2.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') create(); }}
                  placeholder="ชื่อโฟลเดอร์"
                  className="gx-input flex-1"
                />
                <button onClick={create} className="tap-btn text-accent text-[13px] font-semibold px-2">สร้าง</button>
              </div>
            ) : (
              <button
                onClick={() => (isPro ? setCreating(true) : onNeedPro())}
                className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left text-accent"
              >
                <span className="gx-folder-icon is-new" aria-hidden="true">＋</span>
                <span className="text-[13.5px] font-medium">โฟลเดอร์ใหม่…</span>
                {!isPro && <span className="gx-pro">PRO</span>}
              </button>
            )}
          </div>
          <div className="px-4 pt-2 pb-3 flex-shrink-0">
            <button
              onClick={confirm}
              disabled={!checked.size}
              className="tap-btn w-full h-11 rounded-full bg-accent text-paper text-[13px] font-bold disabled:opacity-40"
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

- [ ] **Step 6: สไตล์ใน `src/styles/galaxy.css`**

ต่อท้ายไฟล์:

```css
/* ── Folders and lists (Select) ─────────────────────────────────────────── */
.gx-folder-icon { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0;
  font-size: 13px; background: rgba(120, 140, 255, 0.14); }
.gx-folder-icon.is-new { background: transparent; border: 1.5px dashed rgba(242, 168, 101, 0.6); }
.gx-check { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid rgba(200, 205, 255, 0.35); flex-shrink: 0;
  display: grid; place-items: center; font-size: 10px; font-weight: 700; color: #1a1020; }
.gx-check.is-on, .gx-check.is-some { background: rgb(var(--c-accent)); border-color: rgb(var(--c-accent)); }
.gx-pro { font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 5px; background: rgb(var(--c-accent)); color: #1a1020; }
.gx-input { height: 36px; border-radius: 18px; padding: 0 14px; font: 400 13px var(--f-ui); color: rgb(var(--c-paper));
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(200, 205, 255, 0.12); outline: none; }
.gx-input::placeholder { color: #8f95c0; }
.gx-input:focus { border-color: rgb(var(--c-accent)); }
```

- [ ] **Step 7: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 8: Commit**

```bash
git add src/lib/folderPicker.js src/lib/folderPicker.test.js src/components/galaxy/FolderPickerSheet.jsx src/styles/galaxy.css
git commit -m "feat(galaxy): folder picker sheet — several folders, undo, recent first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: หน้าเลือกฟัง Galaxy

**Files:**
- Create: `src/components/galaxy/BookOrbitHeader.jsx`, `src/components/galaxy/FoldersView.jsx`, `src/screens/GalaxySelect.jsx`
- Modify: `src/App.jsx`, `src/styles/galaxy.css`

**Interfaces:**
- Consumes: hook ทั้งสามจาก Task 9, `keyOf` (`lib/selection`), `tocNodeKey`/`nodeShortLabel`/`sectionsInRange` (`lib/toc`), `FolderPickerSheet` และ `undoAdd` (Task 10), `showToast(msg, { action })` (Task 5), `FolderEditModal({ folder, onClose, onChanged })`, `ProGateModal({ title, body, onClose })`, `SignInGateModal({ state, feature, onClose })`, `gateContentFor(state, 'folder')`, `ThemedScreen` (Task 8)
- Produces: `GalaxySelect` (default export), `<BookOrbitHeader books activeIndex onChange />`, `<FoldersView folders play onEdit />`

- [ ] **Step 1: สร้าง `src/components/galaxy/BookOrbitHeader.jsx`**

```jsx
// The Galaxy Select screen's header: the books on a small tilted orbit, the
// current one in front. Swipe or tap a side planet to change book (spec 5.1).
// Positions change only when the book does, so this is CSS transitions, not a
// frame loop.
import { useLayoutEffect, useRef, useState } from 'react';

const STEP = 0.9;   // radians between neighbouring books on the ring
const SHOW = 2;     // books shown either side of the front one
const RY = 22;      // the ring's half-height
const CY = 44;

export default function BookOrbitHeader({ books, activeIndex, onChange }) {
  const ref = useRef(null);
  const [w, setW] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setW(el.clientWidth || 300);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const touch = useRef(null);
  const n = books.length;
  const rx = w * 0.42;
  const go = (d) => { if (n) onChange((activeIndex + d + n) % n); };
  const offsetOf = (i) => {
    const half = Math.floor(n / 2);
    return ((i - activeIndex + n + half) % n) - half;
  };

  return (
    <div
      ref={ref}
      className="relative flex-shrink-0 select-none"
      style={{ height: 96 }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const start = touch.current;
        touch.current = null;
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <ellipse cx={w / 2} cy={CY} rx={rx} ry={RY} transform={`rotate(-6 ${w / 2} ${CY})`}
          fill="none" stroke="rgba(200,210,255,0.25)" />
      </svg>
      {books.map((b, i) => {
        const d = offsetOf(i);
        if (Math.abs(d) > SHOW) return null;
        const a = d * STEP;
        const depth = Math.cos(a);                 // 1 front … <0 behind
        const size = d === 0 ? 40 : 22;
        const scale = d === 0 ? 1 : 0.7 + 0.3 * Math.max(0, depth);
        const x = w / 2 + Math.sin(a) * rx - size / 2;
        const y = CY + depth * RY - size / 2;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => (d ? go(d) : undefined)}
            aria-label={b.fullName}
            className="gx-head-planet"
            style={{
              width: size, height: size, '--c': b.orbitColor,
              transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(2)})`,
              zIndex: 10 - Math.abs(d),
              opacity: d === 0 ? 1 : Math.abs(d) === 1 ? 0.8 : 0.5,
            }}
          >
            {d !== 0 && <span className="gx-head-name">{b.orbitName}</span>}
          </button>
        );
      })}
      <div className="absolute left-0 right-0 bottom-0 text-center text-[9px] text-rule-soft">‹ ปัดเพื่อเปลี่ยนฉบับ ›</div>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `src/components/galaxy/FoldersView.jsx`**

```jsx
// "โฟลเดอร์ของฉัน" on the Galaxy Select screen (spec 5.3): every folder as a
// card with ▶ to play all of it; stats groups open into per-book chips.
import { LAW_BOOKS_META } from '../../data/lawMeta';

const metaOf = (id) => LAW_BOOKS_META.find(m => m.id === id);

function PlayButton({ source, play, onPress, disabled }) {
  const on = play.isPlayingSource(source);
  return (
    <button onClick={onPress} disabled={disabled} className="tap-btn gx-play" aria-label={on ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'}>
      {on ? '■' : '▶'}
    </button>
  );
}

export default function FoldersView({ folders, play, onEdit }) {
  const top = folders.filter(f => !f.parentId);
  const childrenOf = (id) => folders.filter(f => f.parentId === id);
  const hasOwn = top.some(f => f.type !== 'group');

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      {top.map(f => {
        if (f.type === 'group') {
          const kids = childrenOf(f.id).filter(c => c.sections.length);
          const total = kids.reduce((sum, c) => sum + c.sections.length, 0);
          return (
            <div key={f.id} className="gx-card mt-2.5 p-3">
              <div className="flex items-center gap-3">
                <span className="gx-folder-icon" aria-hidden="true">{f.readOnly ? '?' : '📊'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{f.name}</div>
                  <div className="text-[10.5px] text-rule-soft">{f.readOnly ? 'อัตโนมัติ · ' : ''}{kids.length} ฉบับ · {total} มาตรา</div>
                </div>
                <PlayButton source={`group:${f.id}`} play={play} onPress={() => play.playGroup(f.id)} disabled={!total} />
              </div>
              {kids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {kids.map(c => (
                    <button key={c.id} onClick={() => play.playLeaf(c)} className="tap-btn gx-chip">
                      <i style={{ background: metaOf(c.bookId)?.orbitColor }} />
                      {metaOf(c.bookId)?.orbitName ?? c.name} {c.sections.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={f.id} className="gx-card mt-2.5 p-3 flex items-center gap-3">
            <button onClick={() => onEdit(f)} className="tap-row flex-1 min-w-0 flex items-center gap-3 text-left">
              <span className="gx-folder-icon" aria-hidden="true">📁</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate">{f.name}</span>
                <span className="block text-[10.5px] text-rule-soft">{f.sections.length} มาตรา</span>
              </span>
            </button>
            <PlayButton source={`leaf:${f.id}`} play={play} onPress={() => play.playLeaf(f)} disabled={!f.sections.length} />
          </div>
        );
      })}
      {!hasOwn && (
        <p className="text-[12px] text-rule-soft mt-4 text-center">
          ยังไม่มีโฟลเดอร์ของตัวเอง ติ๊กมาตราแล้วกด "＋ เพิ่ม" เพื่อสร้าง
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: สร้าง `src/screens/GalaxySelect.jsx`**

```jsx
// Galaxy theme's Select screen (spec 5): pick a book on the orbit header, zoom
// through its table of contents as cards, tick sections, then "＋ เพิ่ม" opens
// the folder sheet. Shares its logic with Classic's SelectScreen via hooks.
import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import TabBar from '../components/TabBar';
import FolderEditModal from '../components/FolderEditModal';
import ProGateModal from '../components/ProGateModal';
import SignInGateModal from '../components/SignInGateModal';
import BookOrbitHeader from '../components/galaxy/BookOrbitHeader';
import FolderPickerSheet from '../components/galaxy/FolderPickerSheet';
import FoldersView from '../components/galaxy/FoldersView';
import { useTocNavigation } from '../hooks/useTocNavigation';
import { useSectionSelection } from '../hooks/useSectionSelection';
import { useFolderPlayback } from '../hooks/useFolderPlayback';
import { getFolders } from '../lib/folders';
import { undoAdd } from '../lib/folderPicker';
import { getAllMemory } from '../lib/memory';
import { keyOf } from '../lib/selection';
import { nodeShortLabel, sectionsInRange, tocNodeKey } from '../lib/toc';
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
    <span className={`gx-check${state === 'all' ? ' is-on' : state === 'some' ? ' is-some' : ''}`} aria-hidden="true">
      {state === 'all' ? '✓' : state === 'some' ? '–' : ''}
    </span>
  );
}

export default function GalaxySelect() {
  const { books, loadingData } = useApp();
  const { isPro, state: proAccessState } = useProAccess();

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(null);
  const found = available.findIndex(b => b.id === activeBookId);
  const activeIndex = found < 0 ? 0 : found;
  const activeBook = available[activeIndex];

  const [filter, setFilter] = useState('');
  const [folders, setFolders] = useState(() => getFolders());
  const [view, setView] = useState('browse'); // 'browse' | 'folders'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proHint, setProHint] = useState(false);
  const [editFolder, setEditFolder] = useState(null);
  const [memory] = useState(() => getAllMemory());
  const refreshFolders = () => setFolders(getFolders());

  const toc = useTocNavigation({ activeBook, filter });
  const sel = useSectionSelection({ activeBook, visibleSections: toc.visibleSections });
  const play = useFolderPlayback({ books, folders, selectedList: sel.selectedList });

  // Back one level by swiping in from the left edge.
  const edge = useRef(null);

  if (loadingData || !activeBook) {
    return (
      <div className="gx-flat flex flex-col h-full text-paper font-ui">
        <div className="flex-1 grid place-items-center text-[14px] text-rule-soft">กำลังโหลด…</div>
        <TabBar />
      </div>
    );
  }

  const pickBook = (i) => { setActiveBookId(available[i]?.id ?? null); setFilter(''); };
  const node = toc.tocPath[toc.tocPath.length - 1];
  const searching = !!filter.trim();
  const bookName = activeBook.displayName ?? activeBook.fullName;
  const scopeSections = node ? sectionsInRange(activeBook, node.range) : activeBook.sections;
  const scopeSource = node ? `node:${activeBook.id}:${tocNodeKey(node, 0)}` : `book:${activeBook.id}`;
  const playScope = () => play.playRefs(
    scopeSource,
    node ? `${activeBook.orbitName} ${nodeShortLabel(node)}` : bookName,
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

  const scopeRow = (
    <button onClick={playScope} className="tap-btn gx-tile text-left flex items-center gap-2">
      <span className="text-accent text-[16px]" aria-hidden="true">{play.isPlayingSource(scopeSource) ? '■' : '▶'}</span>
      <span>
        <span className="block text-[13px] font-semibold">{node ? 'ฟังทั้งหมวด' : 'ฟังทั้งฉบับ'}</span>
        <span className="block text-[10.5px] text-rule-soft">{scopeSections.length.toLocaleString()} มาตรา</span>
      </span>
    </button>
  );

  const sectionRows = toc.visibleSections.map((s, idx) => {
    const on = !!sel.selected[keyOf(activeBook.id, s.id)];
    return (
      <button key={`${s.id}_${idx}`} onClick={() => sel.toggleSelect(s)}
        className="tap-row gx-row w-full text-left flex items-center gap-3 px-4 py-2.5">
        <Check state={on ? 'all' : 'none'} />
        <span className="text-accent font-bold flex-shrink-0" style={{ minWidth: 36 }}>{s.number}</span>
        <span className={`text-[13.5px] ${s.excerpt ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={{ color: memColor(memory[s.id]) }}>
          {cleanTitle(s.title) || '—'}
        </span>
      </button>
    );
  });

  let body;
  if (searching) {
    body = toc.visibleSections.length ? (
      <>
        <button onClick={sel.toggleSelectAll} className="tap-row gx-row w-full flex items-center gap-3 px-4 py-2.5">
          <Check state={sel.allSelected ? 'all' : sel.someSelected ? 'some' : 'none'} />
          <span className="text-[13px] font-semibold">{sel.allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</span>
          <span className="ml-auto text-[11px] text-rule-soft">{toc.visibleSections.length} รายการ</span>
        </button>
        {sectionRows}
      </>
    ) : (
      <div className="px-4 py-6 text-center text-[12px] text-rule-soft">ไม่พบมาตราที่ตรงกับ "{filter.trim()}"</div>
    );
  } else if (toc.atLeaf) {
    const st = sel.nodeSelectionState(node);
    body = (
      <>
        <div className="gx-row flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => sel.selectAllInNode(node)} className="tap-row flex-1 flex items-center gap-3 text-left">
            <Check state={st.all ? 'all' : st.some ? 'some' : 'none'} />
            <span className="text-[13px] font-semibold">{st.all ? 'ยกเลิกทั้งหมวด' : 'เลือกทั้งหมวด'}</span>
            <span className="ml-auto text-[11px] text-rule-soft">{st.count}/{st.total}</span>
          </button>
          <button onClick={playScope} className="tap-btn gx-play" aria-label="ฟังทั้งหมวด">
            {play.isPlayingSource(scopeSource) ? '■' : '▶'}
          </button>
        </div>
        {sectionRows}
      </>
    );
  } else if (!toc.currentNodes.length) {
    body = (
      <div className="px-4 py-6 text-center">
        {!toc.tocLoaded[activeBook.id] ? (
          <div className="text-[12px] text-rule-soft">กำลังโหลดสารบาญ…</div>
        ) : (
          <>
            <div className="text-[12px] text-rule-soft">โหลดสารบาญไม่สำเร็จ</div>
            <button onClick={toc.retryToc} className="tap-btn mt-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-accent text-accent">
              ลองใหม่
            </button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-2 px-4 pt-1">
        {toc.currentNodes.map((n, idx) => (
          <button
            key={tocNodeKey(n, idx)}
            onClick={() => toc.setTocPath(p => [...p, n])}
            disabled={!n.children?.length && !n.range}
            className="tap-btn gx-tile text-left"
          >
            <span className="block text-[13px] font-semibold">{nodeShortLabel(n)}</span>
            <span className="block text-[10.5px] text-rule-soft leading-snug mt-0.5 line-clamp-2">
              {n.num ? n.name : ''}{n.range ? `${n.num ? ' · ' : ''}ม.${n.range.from}–${n.range.to}` : ''}
            </span>
          </button>
        ))}
        {scopeRow}
      </div>
    );
  }

  return (
    <div
      className="gx-flat relative flex flex-col h-full text-paper font-ui overflow-hidden"
      onTouchStart={e => { const x = e.touches[0].clientX; edge.current = x < 24 ? x : null; }}
      onTouchEnd={e => {
        const start = edge.current;
        edge.current = null;
        if (start == null || view !== 'browse' || !toc.tocPath.length || searching) return;
        if (e.changedTouches[0].clientX - start > 60) toc.setTocPath(p => p.slice(0, -1));
      }}
    >
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
        <div className="text-[20px] font-bold">{view === 'folders' ? 'โฟลเดอร์ของฉัน' : 'เลือกฟัง'}</div>
        <button
          data-tour="select-folders"
          onClick={() => setView(v => (v === 'folders' ? 'browse' : 'folders'))}
          className="tap-btn gx-icon-btn w-9 h-9 rounded-full grid place-items-center"
          aria-label={view === 'folders' ? 'กลับไปเลือกมาตรา' : 'โฟลเดอร์ของฉัน'}
        >
          {view === 'folders' ? '✕' : '📁'}
        </button>
      </div>

      {view === 'folders' ? (
        <FoldersView folders={folders} play={play} onEdit={setEditFolder} />
      ) : (
        <>
          <BookOrbitHeader books={available} activeIndex={activeIndex} onChange={pickBook} />
          <div className="text-center text-[14px] font-bold px-4 truncate flex-shrink-0">{bookName}</div>
          {toc.tocPath.length > 0 && !searching && (
            <button onClick={() => toc.setTocPath(p => p.slice(0, -1))} className="tap-row flex items-center gap-1.5 px-4 py-1.5 text-left flex-shrink-0">
              <span className="text-accent text-[18px] leading-none" aria-hidden="true">‹</span>
              <span className="text-[11px] text-rule-soft truncate">{toc.tocPath.map(nodeShortLabel).join(' › ')}</span>
            </button>
          )}
          <div className="px-4 py-1.5 flex-shrink-0">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="ค้นเลขมาตรา หรือคำในฉบับนี้"
              className="gx-input w-full"
            />
          </div>
          <div data-tour="select-list" className="flex-1 overflow-y-auto pb-3">{body}</div>
          {sel.selectedList.length > 0 && (
            <div data-tour="select-bar" className="gx-selbar mx-3 mb-2 flex items-center gap-2 pl-4 pr-1.5 flex-shrink-0">
              <span className="text-[12px] font-semibold">เลือก {sel.selectedList.length}</span>
              <button onClick={() => sel.setSelected({})} className="tap-btn text-[11px] underline opacity-70">ล้าง</button>
              <span className="flex-1" />
              <button onClick={() => setPickerOpen(true)} className="tap-btn gx-selbar-btn">＋ เพิ่ม</button>
              <button onClick={play.playSelected} className="tap-btn gx-selbar-btn is-primary">
                {play.isPlayingSource('selected') ? '■ หยุด' : '▶ ฟัง'}
              </button>
            </div>
          )}
        </>
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
            const next = getFolders().find(x => x.id === editFolder.id);
            setEditFolder(next || null);
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

- [ ] **Step 4: สไตล์ใน `src/styles/galaxy.css`**

ต่อท้ายไฟล์:

```css
/* ── Select ─────────────────────────────────────────────────────────────── */
/* A working screen: flat navy with a few faint stars, nothing that moves
   behind long lists. */
.gx-flat { background: linear-gradient(180deg, #0f1430 0%, #0a0e22 35%, #080b1a 100%); }
.gx-flat::before { content: ''; position: absolute; left: 0; top: 0; width: 1px; height: 1px; border-radius: 50%; opacity: 0.5; pointer-events: none;
  box-shadow: 20px 40px #fff8, 110px 30px #fffb, 230px 50px #fff9, 270px 120px #fffa, 150px 10px #fff7, 60px 90px #fff6, 330px 70px #fff7; }
.gx-tile { border-radius: 14px; padding: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(200, 205, 255, 0.1); }
.gx-tile:disabled { opacity: 0.5; }
.gx-play { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; font-size: 11px;
  background: rgb(var(--c-accent)); color: #1a1020; }
.gx-play:disabled { opacity: 0.35; }
.gx-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px 5px 7px; border-radius: 14px; font-size: 10.5px;
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(200, 205, 255, 0.12); white-space: nowrap; }
.gx-chip i { width: 8px; height: 8px; border-radius: 50%; display: block; }
.gx-selbar { height: 48px; border-radius: 24px; background: #f6efe6; color: #1a1020; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6); }
.gx-selbar-btn { padding: 8px 13px; border-radius: 18px; font-size: 11.5px; font-weight: 600; background: rgba(0, 0, 0, 0.08); white-space: nowrap; }
.gx-selbar-btn.is-primary { background: #f2a865; }
.gx-head-planet { position: absolute; left: 0; top: 0; padding: 0; border: 0; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.7), var(--c) 45%, #05060f 105%);
  box-shadow: 0 0 16px var(--c);
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s; }
.gx-head-name { position: absolute; left: 50%; top: 100%; margin-top: 2px; transform: translateX(-50%);
  font-size: 9px; color: #c9cdf0; white-space: nowrap; pointer-events: none; }
```

- [ ] **Step 5: ต่อ route ใน `src/App.jsx`**

เพิ่ม import:

```js
import GalaxySelect from './screens/GalaxySelect';
```

เปลี่ยน `<Route path="/select" element={<SelectScreen />} />` เป็น:

```jsx
            <Route path="/select" element={<ThemedScreen classic={SelectScreen} galaxy={GalaxySelect} />} />
```

- [ ] **Step 6: รันเทสต์และ build**

Run: `npm test` แล้ว `npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 7: ตรวจในเบราว์เซอร์ (ผู้ควบคุมงานทำ)**

ใช้ธีม Galaxy เปิด `/select` ที่ขนาด mobile:
- ปัดและแตะดาวข้าง ๆ เพื่อเปลี่ยนฉบับ
- ซูมการ์ดลงไปถึงระดับมาตรา แล้วย้อนกลับทั้งด้วยปุ่ม ‹ และปัดจากขอบซ้าย
- ติ๊กมาตราข้ามสองฉบับ แถบลอยนับรวมถูก
- "＋ เพิ่ม" แล้วแผ่นเด้งขึ้น ติ๊กสองโฟลเดอร์ (หนึ่งในนั้นเป็นกลุ่มสถิติ) แล้วยืนยัน
  - toast ขึ้นพร้อม "เลิกทำ" กดแล้วมาตราที่เพิ่งเพิ่มหายไป ส่วนมาตราที่มีอยู่ก่อนยังอยู่
  - เปิดแผ่นอีกครั้ง โฟลเดอร์ที่เพิ่งใช้อยู่ใต้ "ใช้ล่าสุด"
- ผู้ใช้ไม่ใช่ Pro กด "โฟลเดอร์ใหม่…" ต้องได้หน้าชวน Pro
- ปุ่ม 📁 เปิดหน้าโฟลเดอร์ ▶ เล่นทั้งโฟลเดอร์ได้ แล้วกลับไปหน้าแรก ดวงอาทิตย์ต้องขึ้น "ฟังต่อ · <ชื่อโฟลเดอร์>"
- console ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add src/components/galaxy/BookOrbitHeader.jsx src/components/galaxy/FoldersView.jsx src/screens/GalaxySelect.jsx src/App.jsx src/styles/galaxy.css
git commit -m "feat(galaxy): Select — orbit header, zooming TOC cards, folder sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: เก็บงานหน้าที่ใช้ร่วมกันใน Galaxy และตรวจทั้งระบบ

**Files:**
- Modify: `src/styles/galaxy.css` (และ component ที่ตรวจเจอปัญหา ถ้าจำเป็น)

**Interfaces:**
- Consumes: ทุกอย่างก่อนหน้า

- [ ] **Step 1: ไล่ตรวจด้วยตาใน Galaxy (ผู้ควบคุมงานทำ)**

ใช้ dev server ขนาด mobile ตรวจหน้าและส่วนต่อไปนี้:
- **หน้า:** `/code/criminal`, หน้าอ่านมาตรา, `/search`, `/stats`, `/bookmarks`, `/settings`
- **modal และ sheet:** แผ่นคิวเล่นเสียง, `FolderEditModal`, `ProGateModal`, `ConfirmDialog`, `UpdateModal`, `HighlightPopup`, `NoteDrawer`
- **อื่น ๆ:** `TtsPlayer` ตอนเล่น, toast, และ `AppTour` (เปิดทัวร์จากตั้งค่า)

เกณฑ์ (spec 7.2):
- ไม่มีตัวอักษรเข้มบนพื้นเข้ม
- ไม่มีพื้นหรือขอบสีกระดาษหลงเหลือ
- ปุ่มสีส้มมีตัวอักษรสีเข้ม

- [ ] **Step 2: แก้จุดที่เจอใน `src/styles/galaxy.css`**

ทุกการแก้ต้องอยู่ใต้ `html.theme-galaxy` เพื่อไม่ให้ Classic เปลี่ยน แก้ด้วย selector ที่แคบที่สุดที่ครอบจุดนั้นได้ เช่น ถ้า `TtsPlayer` ใช้ `bg-ink` เป็นพื้นแถบโดยไม่มี `dark:` คู่กัน:

```css
html.theme-galaxy .bg-ink:not([class*='dark:bg-']) { background-color: rgb(20 26 54); }
```

จดทุกจุดที่แก้ลงข้อความ commit ถ้าจุดไหนแก้ด้วย CSS อย่างเดียวไม่ได้ ให้เพิ่มการเช็ก `resolveTheme(settings) === 'galaxy'` ใน component นั้นแบบเดียวกับ `TabBar` ใน Task 2

- [ ] **Step 3: ทัวร์แนะนำแอป**

ใน Galaxy เปิดทัวร์ ขั้นที่ชี้ `select-list`, `select-bar`, `select-folders` ต้องมีกรอบชี้ (ถ้าขั้น `select-bar` ไม่มีกรอบเพราะยังไม่ได้ติ๊ก ถือว่ายอมรับได้ เหมือน Classic ตอนที่แถบยังไม่ขึ้น) ส่วนขั้น `folder-forgotten` จะไม่มีกรอบใน Galaxy การ์ดยังแสดง ให้จดไว้ในรายงาน ไม่ต้องแก้ในรอบนี้

- [ ] **Step 4: เทสต์และ build ทั้งหมด**

Run: `npm test`
Expected: PASS ทั้งหมด รวมเทสต์ใหม่ `themeTokens`, `theme`, `lawMeta.orbit`, `orbit`, `toast`, `resumeQueue`, `selection`, `folderPicker`

Run: `npm run build`
Expected: build สำเร็จ ใน `dist/assets` มีไฟล์ฟอนต์ `ibm-plex-sans-thai-*.woff2`

- [ ] **Step 5: ตรวจ Classic รอบสุดท้าย (ผู้ควบคุมงานทำ)**

สลับเป็น Classic แล้วถ่ายภาพ 8 หน้า × 2 โหมด เทียบกับภาพใน Task 1 ต้องเหมือนกัน

- [ ] **Step 6: ออฟไลน์และ reduce motion (ผู้ควบคุมงานทำ)**

- ใน `npm run preview` ตั้ง network เป็น offline ใน devtools แล้วรีโหลด ฟอนต์ Galaxy ต้องยังเป็น IBM Plex Sans Thai
- ตั้ง `prefers-reduced-motion: reduce` ใน devtools กับผู้ใช้ที่ยังไม่เคยตั้งค่า "ลดการเคลื่อนไหว" ระบบสุริยะและฉากต้องหยุดนิ่ง

- [ ] **Step 7: Commit**

```bash
git add src/styles/galaxy.css
git commit -m "fix(galaxy): recolour shared screens' leftover light surfaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(ถ้า Step 2 แก้ component ด้วย ให้ `git add` ไฟล์นั้นเพิ่ม)

- [ ] **Step 8: สิ่งที่ต้องให้ผู้ใช้ตรวจบนเครื่องจริง**

แจ้งผู้ใช้เป็นรายการ (ทำแทนไม่ได้):
- วัด fps หน้าแรกบน Android รุ่นช้าด้วยดาว 13 ดวง เป้าราว 60 fps (spec 7.2) ถ้าไม่ถึง ลดจำนวนดาวในฉากพื้นหลังก่อน (`layer(260…)`, `layer(80…)` ใน `GalaxySky.jsx`)
- iPhone และ iPad ทุกขนาดตัวอักษร ระบบสุริยะต้องไม่ล้นจอ
- เปิดแอปจากปิดสนิท ต้องเห็นจอเข้มตั้งแต่ splash ไม่มีจอสีกระดาษแวบ
- ฟังโฟลเดอร์ ออกจากแอปเกิน 80 วินาที แล้วกลับมา ดวงอาทิตย์ต้องบอกตำแหน่งล่าสุด (spec 8)
