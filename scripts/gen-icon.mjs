// Generate launcher + store icons from a single source PNG using sharp.
//
// Source (Icon JurisVoice) is a 1254×1254 photo (Lady Justice with
// headphones on golden background). No transparency — already
// edge-to-edge artwork.
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcPath = join(root, 'store-assets', 'Icon JurisVoice.png');
const srcBuf = readFileSync(srcPath);

// Background sampled from the artwork's golden tone — used for adaptive
// icon background layer and any fill behind content.
const ICON_BG = { r: 193, g: 146, b: 52, alpha: 1 }; // warm gold

// Full-bleed render: artwork fills the entire tile edge to edge.
async function renderFull(size, outPath) {
  const composed = await sharp(srcBuf)
    .resize(size, size, { kernel: 'lanczos3', fit: 'cover' })
    .sharpen({ sigma: 0.5 })
    .png()
    .toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} (full) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

// Adaptive foreground: artwork inset to keep the woman visible within
// the safe zone (~66% circle). 82% of tile keeps the face/headphones
// centered and most of the figure visible in all launcher shapes.
async function renderForeground(size, outPath) {
  const inner = Math.round(size * 0.82);
  const fg = await sharp(srcBuf)
    .resize(inner, inner, { kernel: 'lanczos3', fit: 'cover' })
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
  console.log('Generating icons from Icon JurisVoice…');

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
