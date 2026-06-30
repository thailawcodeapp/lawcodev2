// Generate launcher + store icons from a single source PNG using sharp.
//
// Source (Icon Real) is a macOS-style rounded icon on a transparent canvas.
// For Android we:
//   • trim the transparent margin → the bare rounded-icon artwork
//   • composite on an opaque background so launchers never show transparency
//   • for the adaptive foreground, inset to the safe zone on the same bg
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcPath = join(root, 'store-assets', 'Icon Real.png');
const srcBuf = readFileSync(srcPath);

// Background sampled from the artwork's terracotta tone.
const ICON_BG = { r: 193, g: 128, b: 96, alpha: 1 }; // warm terracotta

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
  // 98% fill so the rounded corners have a thin background frame.
  const inner = Math.round(size * 0.98);
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
// 82% keeps the figure well within the 66% circle safe zone while still large.
async function renderForeground(size, outPath) {
  const trimmed = await getTrimmed();
  const inner = Math.round(size * 0.82);
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
  console.log('Generating icons from Icon Real…');

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
