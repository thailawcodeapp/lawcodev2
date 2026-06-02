// Generate launcher + store icons from a single source PNG using sharp
// (high-quality Lanczos resample — sharper than the resvg SVG-embed approach).
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcPath = join(root, 'store-assets', 'Icon Juris Voice.png');
const srcBuf = readFileSync(srcPath);

// Background color of the icon (matches the dark-green of "Icon Juris Voice")
const ICON_BG = { r: 70, g: 86, b: 69, alpha: 1 };

// Adaptive-icon safe zone: foreground is rendered onto a 108×108dp canvas
// but only the inner 66×66dp is guaranteed to be visible across mask shapes.
// Standard safe ratio ≈ 66/108 = 0.611. We use a tiny bit more (0.72) so the
// book reads clearly but never gets cropped by the round/squircle mask.
const SAFE = 0.72;

async function renderLauncher(size, outPath) {
  // Foreground at safe-zone size on a transparent canvas (legacy + foreground)
  const inner = Math.round(size * SAFE);
  const inset = Math.round((size - inner) / 2);
  const fg = await sharp(srcBuf)
    .resize(inner, inner, { kernel: 'lanczos3' })
    .toBuffer();

  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fg, top: inset, left: inset }])
    .png()
    .toBuffer();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

async function renderFull(size, outPath) {
  // Full-bleed source on opaque cream background — for store assets that
  // don't need the safe-zone treatment.
  const inner = Math.round(size * SAFE);
  const inset = Math.round((size - inner) / 2);
  const fg = await sharp(srcBuf)
    .resize(inner, inner, { kernel: 'lanczos3' })
    .toBuffer();

  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
  })
    .composite([{ input: fg, top: inset, left: inset }])
    .png()
    .toBuffer();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, composed);
  console.log(`  ${size}x${size} (filled) → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

async function main() {
  console.log('Generating icons (sharp, lanczos3, SAFE=' + SAFE + ')…');

  // Store assets — Play Store wants 512 (high-res) and 1024 (feature)
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
    // Legacy square + round launcher icons (older Android) use the full-bleed look
    await renderFull(size, join(resDir, folder, 'ic_launcher.png'));
    await renderFull(size, join(resDir, folder, 'ic_launcher_round.png'));
    // Adaptive foreground (Android 8+) → transparent canvas, system mask trims edges
    await renderLauncher(size, join(resDir, folder, 'ic_launcher_foreground.png'));
  }

  // Adaptive-icon background colour
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
