// Pilot only — answers two questions before anyone spends money on Gemini-TTS:
//
//   1. Does it space Thai legal prose correctly without us segmenting first?
//   2. Is it DETERMINISTIC?
//
// Question 2 is the one that matters. Chirp3 HD returns different audio for
// byte-identical input (proved in this repo by sha256-ing four renders of the
// same SSML), which is why every "this variant sounds right" conclusion about
// it was worthless — a single listen cannot distinguish a fix from a lucky
// roll. If Gemini is non-deterministic too, switching models buys nothing and
// the pilot has already paid for itself by saying so.
//
// Gemini-TTS is served by the SAME Cloud Text-to-Speech API that render.mjs
// already talks to, not a separate product: same client library, same
// synthesizeSpeech call, MP3 straight out of the box. Promoting this from
// pilot to production is `voice.modelName` plus a voice name, not a rewrite.
//
// Deliberately standalone: it does not import render.mjs, does not touch
// out/, ledger.jsonl, or the manifest, and cannot disturb the Chirp3 corpus.
//
// Usage:
//   node scripts/tts-render/pilot-gemini.mjs --determinism   # 4x identical input, compare sha256
//   node scripts/tts-render/pilot-gemini.mjs --limit 10 --voice Charon
//   node scripts/tts-render/pilot-gemini.mjs --prompt "อ่านตัวบทกฎหมายอย่างชัดถ้อยชัดคำ"
//   node scripts/tts-render/pilot-gemini.mjs --wording f    # test against 'f'-style wording instead
//   node scripts/tts-render/pilot-gemini.mjs --aistudio      # free-tier smoke test (GEMINI_API_KEY)
//
// Credentials come from the environment, never the command line, matching
// requireEnv() in upload.mjs — a key in argv lands in shell history.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectParagraphs } from './corpus.mjs';

const MODEL = 'gemini-3.1-flash-tts-preview';

// Prebuilt male voices from the Gemini-TTS voice list. Gacrux — the Chirp3
// voice shipping today — is female, so any of these is already the "second
// voice" the app wants rather than a near-duplicate of what users have.
const MALE_VOICES = [
  'Charon', 'Fenrir', 'Orus', 'Iapetus', 'Enceladus', 'Puck',
  'Algenib', 'Rasalgethi', 'Schedar', 'Umbriel', 'Alnilam', 'Achird',
];

const OUT_DIR = fileURLToPath(new URL('./pilot-out/', import.meta.url));

// Gemini-TTS bills output as audio tokens at 25 per second, so seconds — not
// characters — drive the bill. There is no free tier for these models on
// either surface, which is why the $300 Cloud credit is the whole plan.
const TOKENS_PER_SECOND = 25;
const USD_PER_1M_AUDIO_TOKENS = 20;

// Hard API limits: 4,000 bytes of text, 4,000 of prompt, 8,000 combined. The
// longest paragraph in this corpus is 3,997 bytes — three bytes of headroom,
// so any edit to วิ.อาญา 150 can push it over. render.mjs already splits
// over-length pieces; the pilot only needs to refuse to send a broken request.
const MAX_TEXT_BYTES = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const flag = (argv, name) => argv.includes(name);

function value(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

// ── paragraph selection ─────────────────────────────────────────────────────
//
// A random sample would mostly return short paragraphs that Chirp3 already
// reads correctly, and prove nothing. These are the shapes that break it:
// long runs with no statute-authored space (where it invents a boundary
// mid-word), and dense sub-clause lists.

export function longestSpacelessRun(text) {
  return text.split(/ +/).reduce((max, run) => Math.max(max, run.length), 0);
}

export function pickHardParagraphs(paragraphs, limit) {
  const picked = [];
  const seen = new Set();

  const take = (p) => {
    if (!p || seen.has(p.hash)) return;
    if (Buffer.byteLength(p.text, 'utf8') > MAX_TEXT_BYTES) return;
    seen.add(p.hash);
    picked.push(p);
  };

  // The known-bad one. วิ.อาญา 158 (5) reads "พอสม…ควร" — a pause dropped
  // into the middle of a word — and is the whole reason this pilot exists.
  take(paragraphs.find((p) => p.book === 'criminal-proc-th'
    && p.number === '158'
    && p.text.includes('พอสมควร')));

  // Worst offenders by the shape that causes it.
  const byRun = [...paragraphs].sort(
    (a, b) => longestSpacelessRun(b.text) - longestSpacelessRun(a.text),
  );
  for (const p of byRun) {
    if (picked.length >= Math.ceil(limit * 0.6)) break;
    take(p);
  }

  // Sub-clause density, which is the other thing the new voice has to get
  // right — "อนุมาตรา n" is currently produced by rewriting the text.
  const bySubClause = [...paragraphs].sort(
    (a, b) => (b.text.match(/อนุมาตรา \d+/g) || []).length
            - (a.text.match(/อนุมาตรา \d+/g) || []).length,
  );
  for (const p of bySubClause) {
    if (picked.length >= limit) break;
    take(p);
  }

  return picked.slice(0, limit);
}

// ── duration ────────────────────────────────────────────────────────────────
//
// The bill is audio seconds, so guessing them guesses the invoice. MP3 from
// this API is constant-bitrate, so one frame header gives an exact figure.

export function mp3Seconds(buf) {
  let i = 0;
  if (buf.slice(0, 3).toString() === 'ID3') {
    i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  while (i < buf.length - 4 && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  const version = (buf[i + 1] >> 3) & 3;
  const bitrateIndex = (buf[i + 2] >> 4) & 15;
  const V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const kbps = (version === 3 ? V1L3 : V2L3)[bitrateIndex];
  if (!kbps) throw new Error('could not read MP3 bitrate');
  return (buf.length * 8) / (kbps * 1000);
}

// The AI Studio surface hands back raw PCM instead of MP3, and a pilot whose
// files nobody can play is useless — ffmpeg is not installed here, so wrap the
// PCM in a 44-byte RIFF header and any player will open it.
export function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);              // PCM
  header.writeUInt16LE(1, 22);              // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate, 16-bit mono
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// ── the two transports ──────────────────────────────────────────────────────

// The one that matters. Same API and same client library as render.mjs, so
// what this proves transfers directly to the production renderer.
//
// Authentication, in order of preference:
//
//   1. Application Default Credentials — what `gcloud auth application-default
//      login` writes. This is the path Google steers you to, and the reason
//      the org policy blocking service-account key creation costs us nothing:
//      we never wanted a key.
//   2. GEMINI_TTS_CREDENTIALS, a path to a credentials JSON, for the day the
//      two accounts need to be held apart in one shell.
//
// GEMINI_TTS_PROJECT is required either way and is deliberately NOT
// GOOGLE_CLOUD_PROJECT: render.mjs shares this machine's ADC, so naming the
// project explicitly is what stops a pilot run and a Chirp3 run from quietly
// billing each other's project.
async function makeCloudTtsCall(voice, prompt, encoding) {
  const projectId = requireEnv('GEMINI_TTS_PROJECT');
  const keyFilename = process.env.GEMINI_TTS_CREDENTIALS;
  const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
  const client = new TextToSpeechClient({
    projectId,
    ...(keyFilename ? { keyFilename } : {}),
  });

  return async function call(text) {
    const [res] = await client.synthesizeSpeech({
      input: prompt ? { text, prompt } : { text },
      voice: { languageCode: 'th-TH', name: voice, modelName: MODEL },
      audioConfig: { audioEncoding: encoding },
    });
    return Buffer.from(res.audioContent, 'base64');
  };
}

// Free-tier smoke test. RPD 10 on this account means it can confirm the model
// answers at all and nothing more — it cannot render a corpus.
function makeAiStudioCall(voice, prompt) {
  const key = requireEnv('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  return async function call(text) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt ? `${prompt}: ${text}` : text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (!res.ok) throw new Error(`AI Studio ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const json = await res.json();
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) {
      const why = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'no audio';
      throw new Error(`no audio returned (${why})`);
    }
    return pcmToWav(Buffer.from(part.inlineData.data, 'base64'));
  };
}

// ── runs ────────────────────────────────────────────────────────────────────

// Four renders of one string. If the hashes differ, Gemini is as unfixable by
// text tweaking as Chirp3 is, and no amount of segmentation work will help.
async function runDeterminism(call, text, ext, throttleMs) {
  console.log('\n── determinism: 4 renders of byte-identical input ──');
  console.log(`text: ${text.slice(0, 76)}…\n`);

  const hashes = [];
  for (let i = 1; i <= 4; i++) {
    const audio = await call(text);
    const sha = createHash('sha256').update(audio).digest('hex');
    hashes.push(sha);
    writeFileSync(`${OUT_DIR}determinism-${i}.${ext}`, audio);
    console.log(`  ${i}. ${sha.slice(0, 16)}…  ${audio.length} bytes`);
    if (i < 4) await sleep(throttleMs);
  }

  const identical = new Set(hashes).size === 1;
  console.log(identical
    ? '\n  DETERMINISTIC — identical input gives identical audio.'
      + '\n  A text fix can be verified once and trusted, and regression tests are possible.'
    : '\n  NON-DETERMINISTIC — same input, different audio, exactly like Chirp3 HD.'
      + '\n  No single listen proves anything, and no text fix can be regression-tested.');
  console.log(`\n  Listen to ${OUT_DIR} — four files that should sound identical.`);
  return identical;
}

async function runSample(call, paragraphs, ext, throttleMs) {
  console.log(`\n── sample: ${paragraphs.length} hard paragraphs ──\n`);

  let seconds = 0;
  let chars = 0;
  for (const [i, p] of paragraphs.entries()) {
    const label = `${p.book}-${p.number.replace(/\//g, '_')}-${p.paraIndex}`;
    try {
      const audio = await call(p.text);
      writeFileSync(`${OUT_DIR}${label}.${ext}`, audio);
      const secs = ext === 'mp3' ? mp3Seconds(audio) : (audio.length - 44) / 2 / 24000;
      seconds += secs;
      chars += p.text.length;
      console.log(`  ${String(i + 1).padStart(2)}. ${label.padEnd(28)}`
        + ` ${secs.toFixed(1)}s  run=${String(longestSpacelessRun(p.text)).padStart(3)}`);
    } catch (err) {
      console.log(`  ${String(i + 1).padStart(2)}. ${label.padEnd(28)} FAILED — ${err.message}`);
    }
    if (i < paragraphs.length - 1) await sleep(throttleMs);
  }
  return { seconds, chars };
}

async function main() {
  const argv = process.argv.slice(2);
  const aiStudio = flag(argv, '--aistudio');
  const voice = value(argv, '--voice', MALE_VOICES[0]);
  const prompt = value(argv, '--prompt', '');
  const limit = Number(value(argv, '--limit', '10'));
  const encoding = value(argv, '--encoding', 'MP3');
  // Every voice this pilot tests is a Gemini candidate — a companion to, or
  // replacement for, 'm' (Umbriel). collectParagraphs() defaults to 'f', the
  // OTHER voice's wording ("อนุมาตรา" instead of "อนุ" for a sub-clause) —
  // silently correct as source text, wrong as what a Gemini voice would ship
  // reading. Defaulting here to 'm' is what makes a rendered sample match
  // production instead of just sounding like it does.
  const wording = value(argv, '--wording', 'm');
  // RPD 10 on the AI Studio free tier makes throttling there beside the point;
  // Cloud TTS on a billed project has room to move.
  const throttleMs = Number(value(argv, '--throttle', aiStudio ? '6500' : '300'));

  mkdirSync(OUT_DIR, { recursive: true });

  const ext = aiStudio ? 'wav' : encoding.toLowerCase().replace('linear16', 'wav');
  const call = aiStudio
    ? makeAiStudioCall(voice, prompt)
    : await makeCloudTtsCall(voice, prompt, encoding);

  console.log(`model    : ${MODEL}`);
  console.log(`transport: ${aiStudio ? 'AI Studio (free tier)' : 'Cloud Text-to-Speech API'}`);
  console.log(`voice    : ${voice}   (other male voices: ${MALE_VOICES.slice(1, 6).join(', ')}…)`);
  console.log(`wording  : ${wording}`);
  if (prompt) console.log(`prompt   : ${prompt}`);
  console.log(`output   : ${OUT_DIR}`);

  const paragraphs = pickHardParagraphs(collectParagraphs(wording), limit);

  if (flag(argv, '--determinism')) {
    await runDeterminism(call, paragraphs[0].text, ext, throttleMs);
    return;
  }

  const { seconds, chars } = await runSample(call, paragraphs, ext, throttleMs);
  if (!seconds) return;

  // Extrapolating from measured seconds-per-character is the only honest way
  // to price the full render: the bill is audio duration, Gemini's pacing is
  // not Chirp3's, and reusing the 31.96h measured off the existing MP3s would
  // be a guess dressed up as a number.
  const CORPUS_CHARS = 1_177_114;
  const projected = (seconds / chars) * CORPUS_CHARS;
  const usd = (projected * TOKENS_PER_SECOND / 1e6) * USD_PER_1M_AUDIO_TOKENS;

  console.log('\n── projection ──');
  console.log(`  measured     : ${seconds.toFixed(1)}s of audio from ${chars.toLocaleString()} chars`);
  console.log(`  full corpus  : ${(projected / 3600).toFixed(2)}h`
    + ` (${Math.round(projected * TOKENS_PER_SECOND).toLocaleString()} audio tokens)`);
  console.log(`  cost @ $20/1M: $${usd.toFixed(2)}   — against $300 of credit`);
  console.log(`\nListen to ${OUT_DIR} before deciding. The pilot is only useful if you`);
  console.log('actually hear whether the spacing is right.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
