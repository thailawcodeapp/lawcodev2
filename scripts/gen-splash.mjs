// Generate a text-only splash screen: solid green background with the gold
// wordmark "JURIS VOICE" centered. No icon art (v18 #6).
//
// Capacitor's SplashScreen uses drawable/splash.png (+ density variants and
// land/port orientations). We render one SVG at each required size.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');

const GREEN = '#465645';
const GOLD = '#C9A24C';
const GOLD_LIGHT = '#E3C275';

function splashSvg(w, h) {
  // Scale the wordmark to the smaller dimension so it fits both orientations.
  const base = Math.min(w, h);
  const fontSize = Math.round(base * 0.082);
  const letter = (fontSize * 0.32).toFixed(1);
  const cx = w / 2;
  const cy = h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${GREEN}"/>
  <defs>
    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-weight="600"
        font-size="${fontSize}" fill="url(#g)"
        style="letter-spacing:${letter}px">JURIS VOICE</text>
  <line x1="${cx - base * 0.28}" y1="${cy + fontSize * 0.85}" x2="${cx + base * 0.28}" y2="${cy + fontSize * 0.85}"
        stroke="${GOLD}" stroke-width="${Math.max(1, base * 0.003)}" opacity="0.5"/>
</svg>`;
}

function render(w, h, outPath) {
  const svg = splashSvg(w, h);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: w } });
  const png = resvg.render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`  ${w}x${h} → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

console.log('Generating text-only splash…');

// Base (used by drawable/splash.png)
render(480, 320, join(resDir, 'drawable', 'splash.png'));

// Portrait + landscape per density. Sizes follow Capacitor's defaults.
const port = [
  ['drawable-port-mdpi',    320, 480],
  ['drawable-port-hdpi',    480, 800],
  ['drawable-port-xhdpi',   720, 1280],
  ['drawable-port-xxhdpi',  960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
];
const land = [
  ['drawable-land-mdpi',    480, 320],
  ['drawable-land-hdpi',    800, 480],
  ['drawable-land-xhdpi',   1280, 720],
  ['drawable-land-xxhdpi',  1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
];
for (const [folder, w, h] of [...port, ...land]) {
  render(w, h, join(resDir, folder, 'splash.png'));
}

console.log('Done.');
