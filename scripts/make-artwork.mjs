// Builds public/now-playing.png — the cover art the lock screen shows —
// from a source illustration.
//
// Reproducible rather than a one-off trip through an image editor, for the
// same reason upload.mjs grew --artwork: the lock screen's artwork is served
// from R2 and replaced in place, so "how was this file made" has to be
// answerable months later when the icon changes again.
//
// The source is expected to carry its own alpha — the illustration this was
// written for is 46% transparent — and the whole job here is to not lose it.
// The file it replaced had been flattened onto a light background and then
// cropped to a rounded-rect badge, which is why the lock screen showed a tile
// with clipped corners instead of a picture.
//
// Usage, from the repository root:
//   node scripts/make-artwork.mjs "C:/path/to/Icon Play JurisVoice.png"
//
// Then, to put it where the lock screen can actually reach it — the app bundle
// is not somewhere either platform's media session can read from:
//   node scripts/tts-render/upload.mjs --artwork
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const OUT = 'public/now-playing.png';
// Both platforms downscale this heavily — iOS to the lock screen's art size,
// Android to a notification thumbnail. 1024 is past the point either can show
// and keeps the file inside a size a phone downloads once without noticing.
const SIZE = 1024;

async function main() {
  const src = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!src) {
    console.error('usage: node scripts/make-artwork.mjs <source image>');
    process.exit(1);
  }

  await sharp(src)
    // `contain` with a transparent background, not `cover`: cropping is the
    // defect being fixed here. A source that is not square gets transparent
    // bars rather than losing its edges.
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // Quantised: 1.5 MB of full-colour PNG for something shown at thumbnail
    // size, over mobile data, on a URL that is not immutable and so is
    // re-fetched. 297 KB, and at 5x magnification the skin gradients show no
    // banding — checked, not assumed.
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(OUT);

  // Report the alpha back, because "the background went away again" is the one
  // way this script can quietly produce the exact file it exists to replace.
  const { data, info } = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let p = 0; p < info.width * info.height; p++) if (data[p * info.channels + 3] === 0) clear += 1;
  const pct = ((clear / (info.width * info.height)) * 100).toFixed(1);

  console.log(`wrote ${OUT} at ${info.width}x${info.height}, ${pct}% transparent`);
  if (clear === 0) console.warn('WARNING: no transparency — the source was already flattened');
  console.log('remember: node scripts/tts-render/upload.mjs --artwork');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
