// Generate a BLANK splash screen — a solid paper-colored rectangle, no text
// and no icon art (v19 #2). Capacitor's SplashScreen uses drawable/splash.png
// (+ density and orientation variants); we fill each with one flat color.
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');

// App background color (paper). Keep this in sync with capacitor.config.ts →
// SplashScreen.backgroundColor.
const BG = { r: 236, g: 228, b: 212, alpha: 1 }; // #ece4d4

async function render(w, h, outPath) {
  const png = await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  }).png().toBuffer();
  mkdirSync(dirname(outPath), { recursive: true });
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, png);
  console.log(`  ${w}x${h} → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

const sizes = [
  ['drawable',              480, 320],
  ['drawable-port-mdpi',    320, 480],
  ['drawable-port-hdpi',    480, 800],
  ['drawable-port-xhdpi',   720, 1280],
  ['drawable-port-xxhdpi',  960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi',    480, 320],
  ['drawable-land-hdpi',    800, 480],
  ['drawable-land-xhdpi',   1280, 720],
  ['drawable-land-xxhdpi',  1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
];

console.log('Generating blank splash…');
for (const [folder, w, h] of sizes) {
  await render(w, h, join(resDir, folder, 'splash.png'));
}
console.log('Done.');
