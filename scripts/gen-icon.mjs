// Generate launcher + store icons from a single source PNG using sharp.
//
// Source (Icon JV5) is a macOS-style rounded icon centered on a transparent
// canvas. For Android we:
//   • trim the transparent margin → the bare rounded-icon artwork
//   • composite it on an opaque background so launchers never show
//     transparency
//   • for the adaptive foreground, inset slightly inside the safe zone
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcPath = join(root, 'store-assets', 'Icon JV5.PNG');
const srcBuf = readFileSync(srcPath);

// Background sampled from the JV5 artwork's leather tone — used to fill behind
// the rounded icon so the square launcher tile blends seamlessly.
const ICON_BG = { r: 169, g: 62, b: 25, alpha: 1 }; // warm terracotta

// Pre-trim the transparent margin ONCE so every size starts from the artwork.
let trimmedBuf = null;
async function getTrimmed() {
  if (trimmedBuf) return trimmedBuf;
  trimmedBuf = await sharp(srcBuf).trim({ threshold: 10 }).toBuffer();
  return trimmedBuf;
}

// Full-bleed render: rounded artwork on the terracotta background, edge to edge.
async function renderFull(size, outPath) {
  const trimmed = await getTrimmed();
  // Scale the artwork to ~98% so a sliver of background frames the rounded
  // corners (prevents a hard clip against the tile edge).
  const inner = Math.round(size * 0.98);
  const inset = Math.round((size - inner) / 2);
  const fg = await sharp(trimmed)
    .resize(inner, inner, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .sharpen({ sigma: 0.5 })
    .toBuffer();
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
  })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} (full) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

// Adaptive foreground: artwork inset to the safe zone on the terracotta bg.
async function renderForeground(size, outPath) {
  const trimmed = await getTrimmed();
  const inner = Math.round(size * 0.74); // safe-zone fit
  const fg = await sharp(trimmed)
    .resize(inner, inner, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .sharpen({ sigma: 0.5 })
    .toBuffer();
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
  })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} (fg) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

async function main() {
  console.log('Generating icons from Icon JV5…');

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
  writeFileSync(
    join(resDir, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgHex}</color>\n</resources>\n`,
  );
  console.log(`  bg color → ${bgHex}`);
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
