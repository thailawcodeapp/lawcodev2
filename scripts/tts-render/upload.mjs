// Uploads the rendered audio to Cloudflare R2, which speaks the S3 API.
//
// Credentials come from the environment and are never read from a file in
// this repository:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Usage, from the repository root:
//   node scripts/tts-render/upload.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { collectParagraphs } from './corpus.mjs';

const OUT_DIRS = {
  f: fileURLToPath(new URL('./out/', import.meta.url)),
  m: fileURLToPath(new URL('./out-m/', import.meta.url)),
  leda: fileURLToPath(new URL('./out-leda/', import.meta.url)),
};

// Content-addressed, one prefix per voice. The prefix is not decoration:
// 5,048 of the 6,712 paragraphs have no "(n)" label, so their text and
// therefore their hash is identical between the two voices. A flat namespace
// would have the male render silently overwrite three quarters of the female
// one — same key, plausible size, and the only symptom a listener could
// notice is the wrong voice.
//
// 'f' keeps the bare `audio/<hash>.mp3` it has always had, so every object
// already in the bucket and every build already on a phone stays valid.
export function objectKey(hash, voice = 'f') {
  return voice === 'f' ? `audio/${hash}.mp3` : `audio/${voice}/${hash}.mp3`;
}

// A clip that is wrong rather than missing. planUpload skips anything the
// bucket already holds — which is right for a content-addressed corpus, where
// a key that exists holds the only audio that key can ever mean, and wrong for
// the one case that breaks the assumption: the text was read aloud incorrectly,
// so the file under that name has to be replaced by a better recording of the
// same words. See renderOverrides.mjs.
//
// Accepts "<sectionId>", "<sectionId>:<paraIndex>" or a bare hash — the same
// vocabulary render.mjs's --only takes, plus the hash, because a replacement is
// usually chased from the file name.
export function selectHashes(paragraphs, only) {
  const wanted = new Set(only);
  const hashes = [];
  for (const p of paragraphs) {
    const named = wanted.has(p.hash) || wanted.has(p.sectionId) || wanted.has(`${p.sectionId}:${p.paraIndex}`);
    if (named && !hashes.includes(p.hash)) hashes.push(p.hash);
  }
  return hashes;
}

export function planUpload(paragraphs, existingKeys, voice = 'f') {
  const seen = new Set();
  const plan = [];
  for (const p of paragraphs) {
    if (seen.has(p.hash)) continue;
    seen.add(p.hash);
    if (!existingKeys.has(objectKey(p.hash, voice))) plan.push(p.hash);
  }
  return plan;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name} — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET`);
    process.exit(1);
  }
  return v;
}

async function listExisting(client, bucket) {
  const keys = new Set();
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: 'audio/', ContinuationToken: token,
    }));
    for (const o of res.Contents ?? []) keys.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const at = process.argv.indexOf('--voice');
  const voice = at >= 0 ? process.argv[at + 1] : 'f';
  const OUT = OUT_DIRS[voice];
  if (!OUT) {
    console.error(`--voice must be one of ${Object.keys(OUT_DIRS).join(', ')}, got ${JSON.stringify(voice)}`);
    process.exit(1);
  }

  const accountId = requireEnv('R2_ACCOUNT_ID');
  const bucket = requireEnv('R2_BUCKET');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  // The lock screen's cover art, which has to be somewhere the native layer
  // can fetch. Both platforms' plugins take the artworkUrl, see a scheme that
  // is neither absent nor "file", and load it with a plain HTTP client from
  // native code — so capacitor://localhost and http://localhost, the only two
  // origins the webview has, are both unreachable. Serving it from the bucket
  // that already serves the audio is the whole fix.
  //
  // Not content-addressed, unlike everything else here: it is replaced in
  // place when the icon changes, so it gets a short cache life rather than the
  // immutable year the clips get.
  if (process.argv.includes('--artwork')) {
    const art = 'public/now-playing.png';
    if (!existsSync(art)) {
      console.error(`${art} not found — it ships in the app bundle too, so it should be there`);
      process.exit(1);
    }
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: 'now-playing.png',
      Body: createReadStream(art),
      ContentLength: statSync(art).size,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=86400',
    }));
    console.log(`uploaded now-playing.png (${statSync(art).size} bytes)`);
    return;
  }

  const paragraphs = collectParagraphs(voice);

  // Replacing named objects, not filling in missing ones.
  const onlyAt = process.argv.indexOf('--only');
  if (onlyAt >= 0) {
    const only = String(process.argv[onlyAt + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const hashes = selectHashes(paragraphs, only);
    if (!hashes.length) {
      console.error(`--only matched no paragraphs: ${only.join(', ')}`);
      process.exit(1);
    }
    for (const hash of hashes) {
      const file = `${OUT}${hash}.mp3`;
      if (!existsSync(file)) {
        console.error(`${file} not found — render it first: node scripts/tts-render/render.mjs --voice ${voice} --only ${only.join(',')}`);
        process.exit(1);
      }
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey(hash, voice),
        Body: createReadStream(file),
        ContentLength: statSync(file).size,
        ContentType: 'audio/mpeg',
        // Minutes, not the immutable year every other object gets. That header
        // is a promise this upload has just broken — the key's contents
        // changed — and any cache still holding the old recording is holding it
        // on the strength of that promise. A short life on the replacement
        // stops the correction from being pinned behind the mistake for a
        // second time.
        CacheControl: 'public, max-age=300',
      }));
      console.log(`replaced ${objectKey(hash, voice)} (${statSync(file).size} bytes)`);
    }
    console.log(
      '\nCaches still holding the old clip will keep playing it: Cloudflare\'s edge for a while,\n' +
      'and any phone that already downloaded it until its owner clears the audio cache in Settings.',
    );
    return;
  }

  const existing = await listExisting(client, bucket);
  console.log(`voice ${voice} -> ${objectKey('<hash>', voice)}`);
  console.log(`bucket already holds ${existing.size} objects`);

  const plan = planUpload(paragraphs, existing, voice);
  console.log(`${plan.length} to upload`);

  const missingLocally = plan.filter((h) => !existsSync(`${OUT}${h}.mp3`));
  if (missingLocally.length) {
    console.error(`${missingLocally.length} files are missing from out/ — run render.mjs and verify.mjs first`);
    process.exit(1);
  }

  let done = 0;
  for (const hash of plan) {
    const file = `${OUT}${hash}.mp3`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(hash, voice),
      Body: createReadStream(file),
      ContentLength: statSync(file).size,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    done += 1;
    if (done % 200 === 0) console.log(`  ${done}/${plan.length}`);
  }

  // Confirm from the bucket's own listing rather than from having sent the
  // requests — an upload that half-succeeded should not read as complete.
  const after = await listExisting(client, bucket);
  const stillMissing = paragraphs.filter((p) => !after.has(objectKey(p.hash, voice)));
  console.log(`\nuploaded ${done}; bucket now holds ${after.size} objects`);
  if (stillMissing.length) {
    console.error(`${stillMissing.length} paragraphs still have no object — re-run`);
    process.exit(1);
  }
  console.log('every paragraph in the manifest has an object in the bucket');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
