import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Source PNG icon (already includes its own rounded background).
const pngPath = join(root, 'store-assets', 'Icon Juris Voice.png');
const pngB64 = readFileSync(pngPath).toString('base64');

// Full-bleed bitmap (legacy launcher icons + store assets).
const svgFull = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <image href="data:image/png;base64,${pngB64}" x="0" y="0" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

// Adaptive foreground: icon.png is already a finished icon with its own
// rounded cream backdrop, so we render it full-bleed. The transparent corners
// outside its rounded rect are filled by the cream adaptive background, and the
// system mask (circle/squircle) then trims the corners cleanly — no "card in a
// card" double border. A tiny inset keeps the artwork off the very edge.
const ICON_BG = '#465647';
const SAFE = 0.96;
const inset = Math.round(1024 * (1 - SAFE) / 2);
const innerW = 1024 - inset * 2;
const svgForeground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${ICON_BG}"/>
  <image href="data:image/png;base64,${pngB64}" x="${inset}" y="${inset}" width="${innerW}" height="${innerW}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

function renderAt(svgStr, size, outPath) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`  ${size}x${size} → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

console.log('Generating icons from icon.png…');

// Store assets (full-bleed)
renderAt(svgFull, 1024, join(root, 'store-assets', 'icon-1024.png'));
renderAt(svgFull, 512,  join(root, 'store-assets', 'icon-512.png'));

// Android mipmaps
const mipmap = [
  ['mipmap-mdpi',    48],
  ['mipmap-hdpi',    72],
  ['mipmap-xhdpi',   96],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
];
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');
for (const [folder, size] of mipmap) {
  // Legacy square/round launcher icons → full-bleed bitmap
  renderAt(svgFull, size, join(resDir, folder, 'ic_launcher.png'));
  renderAt(svgFull, size, join(resDir, folder, 'ic_launcher_round.png'));
  // Adaptive foreground (Android 8+) → inset into safe zone
  renderAt(svgForeground, size, join(resDir, folder, 'ic_launcher_foreground.png'));
}

// Set adaptive-icon background color to match the icon's cream backdrop.
const bgColorXml = join(resDir, 'values', 'ic_launcher_background.xml');
writeFileSync(
  bgColorXml,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG}</color>\n</resources>\n`,
);
console.log(`  bg color → ${ICON_BG}`);

console.log('Done.');
