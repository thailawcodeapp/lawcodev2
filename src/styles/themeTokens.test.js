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
});
