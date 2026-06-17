// Generate launcher + store icons from a single source PNG using sharp
// (high-quality Lanczos resample).
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// v19 #1: new full-bleed photo icon (no transparency — fills the whole square).
const srcPath = join(root, 'store-assets', 'Lastest Icon 2.PNG');
const srcBuf = readFileSync(srcPath);

// Dark backdrop sampled from the photo's border — used behind the adaptive
// foreground's safe-zone inset so the round/squircle mask blends seamlessly.
const ICON_BG = { r: 22, g: 20, b: 16, alpha: 1 };

// Adaptive foreground safe zone. The photo is busy edge-to-edge, so we inset
// it a bit and let the matching dark background fill the margin; the system
// mask then trims the corners without clipping the book.
const SAFE = 0.86;

// Full-bleed render (store assets + legacy launcher icons).
async function renderFull(size, outPath) {
  const png = await sharp(srcBuf)
    .resize(size, size, { kernel: 'lanczos3', fit: 'cover' })
    .sharpen({ sigma: 0.5 })
    .png()
    .toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`  ${size}x${size} (full) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

// Adaptive foreground render — inset on a dark canvas.
async function renderForeground(size, outPath) {
  const inner = Math.round(size * SAFE);
  const inset = Math.round((size - inner) / 2);
  const fg = await sharp(srcBuf)
    .resize(inner, inner, { kernel: 'lanczos3', fit: 'cover' })
    .sharpen({ sigma: 0.5 })
    .toBuffer();
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
  })
    .composite([{ input: fg, top: inset, left: inset }])
    .png()
    .toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} (fg) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

async function main() {
  console.log('Generating icons (sharp, lanczos3, SAFE=' + SAFE + ')…');

  // Store assets
  await renderFull(1024, join(root, 'store-assets', 'icon-1024.png'));
  await renderFull(512,  join(root, 'store-assets', 'icon-512.png'));

  const mipmap = [
    ['mipmap-mdpi',    48],
    ['mipmap-hdpi',    72],
    ['mipmap-xhdpi',   96],
    ['mipmap-xxhdpi',  144],
    ['mipmap-xxxhdpi', 192],
  ];
  const resDir = join(root, 'android', 'app', 'src', 'main', 'res');
  for (const [folder, size] of mipmap) {
    await renderFull(size, join(resDir, folder, 'ic_launcher.png'));
    await renderFull(size, join(resDir, folder, 'ic_launcher_round.png'));
    await renderForeground(size, join(resDir, folder, 'ic_launcher_foreground.png'));
  }

  const bgHex = '#' +
    ICON_BG.r.toString(16).padStart(2, '0') +
    ICON_BG.g.toString(16).padStart(2, '0') +
    ICON_BG.b.toString(16).padStart(2, '0');
  const bgXml = join(resDir, 'values', 'ic_launcher_background.xml');
  writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgHex}</color>\n</resources>\n`,
  );
  console.log(`  bg color → ${bgHex}`);
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
