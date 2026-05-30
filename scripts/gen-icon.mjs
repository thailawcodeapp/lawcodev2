import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const svgPath = join(root, 'store-assets', 'icon_f_character.svg');
const svgStr = readFileSync(svgPath, 'utf8');

function renderAt(size, outPath) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true },
  });
  const png = resvg.render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`  ${size}x${size} → ${outPath.replace(root, '').replace(/\\/g, '/')}`);
}

console.log('Generating icons…');

// Store assets
renderAt(1024, join(root, 'store-assets', 'icon-1024.png'));
renderAt(512,  join(root, 'store-assets', 'icon-512.png'));

// Android mipmap ic_launcher (square)
const mipmap = [
  ['mipmap-mdpi',    48],
  ['mipmap-hdpi',    72],
  ['mipmap-xhdpi',   96],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
];
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');
for (const [folder, size] of mipmap) {
  renderAt(size, join(resDir, folder, 'ic_launcher.png'));
  renderAt(size, join(resDir, folder, 'ic_launcher_round.png'));
}

console.log('Done.');
