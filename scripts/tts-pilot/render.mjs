// Phase 2 pilot — renders real sections so the engine and voice can be
// judged by ear, and so the bill tells us the real per-character cost
// before committing to 6,770 files.
//
// Round 1 picked th-TH-Chirp3-HD-Gacrux by ear and then died on civil
// 1598/21 with "sentences that are too long" — Thai legal text almost never
// uses sentence-ending punctuation (13 of 6,770 paragraphs do), so the whole
// paragraph is one "sentence" to the engine, and 24% of paragraphs are
// longer than the longest one that worked. This round: (1) find the real
// limit with --probe, (2) check whether Gemini TTS does any better with
// --gemini, (3) render everything else with Gacrux, skipping what round 1
// already produced, and never letting one bad paragraph kill the run.
//
// Throwaway: not imported by the app, not run in CI.
//
// Authenticate with `gcloud auth application-default login` first — see
// README.md. Google blocks service-account key downloads by default for
// organizations now, and the client picks up your own credentials without
// being told where they are.
//
// Usage, from the repository root:
//   node scripts/tts-pilot/render.mjs            render remaining samples with Gacrux
//   node scripts/tts-pilot/render.mjs --probe    binary-search the sentence-length limit
//   node scripts/tts-pilot/render.mjs --gemini   check whether a Gemini TTS voice is
//                                                 reachable for th-TH and try it against
//                                                 the paragraph that killed round 1
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { normalizeForSpeech } from '../../src/lib/thaiSpeech.js';

// Chosen to cover what the corpus actually throws at a synthesiser:
// the longest paragraph, a slash number, a Thai ordinal, a real fraction,
// a multi-paragraph section, and a couple of ordinary ones.
//
// Note: '172 ทวิ/1' lives in criminal-proc-th, not criminal-th — verified
// against public/data/criminal-proc-th.json before this list was written.
export const SAMPLES = [
  ['civil-th', '420'],        // 9 clause-separating spaces — the phrasing case
  ['civil-th', '193/30'],     // slash number
  ['civil-th', '968'],        // real fraction, must stay a fraction
  ['civil-th', '1598/21'],    // slash in the body too — killed round 1, 378 chars
  ['criminal-th', '288'],     // short and well known
  ['criminal-proc-th', '172 ทวิ/1'], // Thai ordinal before the slash
  ['criminal-proc-th', '7'],  // list-heavy
  ['civil-proc-th', '4 ฉ'],   // the ฉ suffix
  ['civil-proc-th', '222/12'], // procedural, dense cross-references
  ['civil-th', '1'],          // the opening section
];

// The owner listened to all three Chirp 3 HD candidates and chose this one.
// Charon and Schedar are dropped from the default run; round 1 already has
// their files for the three samples it reached.
export const VOICE = 'th-TH-Chirp3-HD-Gacrux';

// Sections used to build a long, punctuation-free probe string out of real
// corpus text rather than a repeated syllable, so --probe measures what the
// engine actually sees. Chosen for length and variety, not cherry-picked for
// an easy result — 1598/21 is the paragraph that failed in round 1.
const PROBE_SOURCES = [
  ['civil-th', '1598/21'],
  ['civil-th', '420'],
  ['civil-proc-th', '222/12'],
  ['criminal-proc-th', '7'],
];

// What round 1 actually measured: 229 chars succeeded, 378 chars failed.
// --probe treats these as a starting bracket and re-confirms both ends
// before binary-searching between them, in case the true limit moved.
const PROBE_KNOWN_GOOD = 229;
const PROBE_KNOWN_BAD = 378;

export const OUT = fileURLToPath(new URL('./out/', import.meta.url));

export function loadSection(book, number) {
  const j = JSON.parse(readFileSync(`public/data/${book}.json`, 'utf8'));
  const s = j.sections.find((x) => String(x.number) === number);
  if (!s) throw new Error(`not found: ${book} ${number}`);
  return s;
}

// Same unit the render pipeline will use: one paragraph per request.
export function paragraphsOf(section) {
  return (section.text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizeForSpeech);
}

export function safeName(book, number) {
  return `${book}-${number}`.replace(/[^\w.-]/g, '_');
}

export function outPathFor(voice, book, number) {
  return `${OUT}${voice}-${safeName(book, number)}.mp3`;
}

// Concatenates real paragraph text from several long sections into one
// punctuation-free run, the same shape as the sentence the engine choked on
// (Thai legal text essentially never contains '.', '!' or '?').
export function buildProbeCorpus() {
  let text = '';
  for (const [book, number] of PROBE_SOURCES) {
    const paragraphs = paragraphsOf(loadSection(book, number));
    text += ` ${paragraphs.join(' ')}`;
  }
  text = text.replace(/[.!?]/g, '').trim();
  if (text.length < PROBE_KNOWN_BAD + 200) {
    throw new Error(
      `probe corpus is only ${text.length} chars — add more PROBE_SOURCES so it comfortably ` +
        `exceeds the known-bad length (${PROBE_KNOWN_BAD})`,
    );
  }
  return text;
}

export function parseMode(argv) {
  if (argv.includes('--probe')) return 'probe';
  if (argv.includes('--gemini')) return 'gemini';
  return 'render';
}

export function formatSummary(results, totalChars) {
  const lines = ['', '=== summary ==='];
  for (const r of results) {
    if (r.status === 'skipped') {
      lines.push(`skipped    ${r.voice}  ${r.book} ${r.number}  (output already exists)`);
      continue;
    }
    const okCount = r.paragraphCount - r.failures.length;
    lines.push(
      `${r.status.padEnd(10)} ${r.voice}  ${r.book} ${r.number}  ` +
        `${okCount}/${r.paragraphCount} paragraphs ok`,
    );
    for (const f of r.failures) {
      lines.push(`    paragraph ${f.paragraphIndex} (${f.length} chars): ${f.message}`);
    }
  }
  lines.push('');
  lines.push(`characters billed this run (successful requests only): ${totalChars}`);
  lines.push('compare against the Cloud console billing page to get the real per-character rate');
  return lines.join('\n');
}

async function synthesizeOne(client, text, voiceName, languageCode = 'th-TH') {
  const [res] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: 'MP3' },
  });
  return Buffer.from(res.audioContent, 'base64');
}

// Renders every sample with VOICE. Never throws out of the loop: a bad
// paragraph is recorded as a failure and synthesis moves on, so eight good
// sections are never lost because the ninth was rejected. A (voice, section)
// pair whose output file already exists is skipped — round 1's files are
// not re-billed.
export async function runRender(client) {
  mkdirSync(OUT, { recursive: true });
  let totalChars = 0;
  const results = [];

  for (const [book, number] of SAMPLES) {
    const outPath = outPathFor(VOICE, book, number);
    if (existsSync(outPath)) {
      console.log(`skip  ${VOICE}  ${book} ${number}  (already rendered)`);
      results.push({ book, number, voice: VOICE, status: 'skipped' });
      continue;
    }

    const paragraphs = paragraphsOf(loadSection(book, number));
    const parts = [];
    const failures = [];
    let sectionChars = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i];
      try {
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > 5000) throw new Error(`paragraph over the 5000-byte limit: ${bytes}`);
        const audio = await synthesizeOne(client, text, VOICE);
        parts.push(audio);
        sectionChars += text.length;
      } catch (err) {
        failures.push({ paragraphIndex: i, length: text.length, message: err.message });
        console.error(`FAIL  ${VOICE}  ${book} ${number}  paragraph ${i} (${text.length} chars): ${err.message}`);
      }
    }

    if (parts.length > 0) {
      writeFileSync(outPath, Buffer.concat(parts));
    }
    totalChars += sectionChars;

    const status = failures.length === 0 ? 'ok' : parts.length > 0 ? 'partial' : 'failed';
    results.push({
      book,
      number,
      voice: VOICE,
      status,
      paragraphCount: paragraphs.length,
      failures,
    });
    console.log(
      `${status}  ${VOICE}  ${book} ${number}  ` +
        `(${paragraphs.length - failures.length}/${paragraphs.length} paragraphs, ${failures.length} failed)`,
    );
  }

  console.log(formatSummary(results, totalChars));
}

// Binary-searches the sentence-length limit using real, punctuation-free
// corpus text. Confirms the known-good and known-bad lengths from round 1
// first (2 requests) so a moved limit is visible rather than silently
// assumed, then narrows the bracket (~8 requests for a 149-char bracket).
async function runProbe(client) {
  const corpus = buildProbeCorpus();
  console.log(`probe corpus: ${corpus.length} chars, built from real section text (no sentence punctuation)\n`);

  const probeAt = async (length) => {
    const text = corpus.slice(0, length);
    try {
      await synthesizeOne(client, text, VOICE);
      return { ok: true, length };
    } catch (err) {
      return { ok: false, length, message: err.message };
    }
  };

  console.log(`confirming known-good length ${PROBE_KNOWN_GOOD} (round 1) still succeeds...`);
  const loCheck = await probeAt(PROBE_KNOWN_GOOD);
  console.log(loCheck.ok ? `  ok` : `  UNEXPECTED FAILURE at ${PROBE_KNOWN_GOOD}: ${loCheck.message}`);

  console.log(`confirming known-bad length ${PROBE_KNOWN_BAD} (round 1) still fails...`);
  const hiCheck = await probeAt(PROBE_KNOWN_BAD);
  console.log(
    hiCheck.ok
      ? `  UNEXPECTED SUCCESS at ${PROBE_KNOWN_BAD} — the limit is higher than round 1 observed`
      : `  fails as expected: ${hiCheck.message}`,
  );

  if (!loCheck.ok || hiCheck.ok) {
    console.log(
      '\nSanity checks did not reproduce round 1. Not binary-searching against a bracket that ' +
        "may no longer bound the real limit — adjust PROBE_KNOWN_GOOD/PROBE_KNOWN_BAD and re-run.",
    );
    return;
  }

  let lo = PROBE_KNOWN_GOOD;
  let hi = PROBE_KNOWN_BAD;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const result = await probeAt(mid);
    console.log(`  ${mid} chars: ${result.ok ? 'ok' : `FAIL — ${result.message}`}`);
    if (result.ok) lo = mid;
    else hi = mid;
  }

  console.log(`\nlargest length that succeeded: ${lo}`);
  console.log(`smallest length that failed:   ${hi}`);
}

// Answers "does Gemini TTS have the same limit" — but first, "can this
// project reach Gemini TTS at all". Lists th-TH voices exactly as returned
// by the API (no guessing at names), looks for anything that appears to be
// a Gemini voice, and if one exists, throws the paragraph that killed round
// 1 (civil 1598/21, 378 chars) at it.
async function runGemini(client) {
  console.log("listing voices for languageCode 'th-TH'...\n");
  const [response] = await client.listVoices({ languageCode: 'th-TH' });
  console.log(JSON.stringify(response, null, 2));

  const voices = response.voices || [];
  console.log(`\n${voices.length} voice(s) returned for th-TH:`);
  for (const v of voices) {
    console.log(`  ${v.name}  languageCodes=${(v.languageCodes || []).join(',')}`);
  }

  const geminiVoices = voices.filter((v) => /gemini/i.test(v.name || ''));
  if (geminiVoices.length === 0) {
    console.log(
      '\nNo voice with "Gemini" in its name was returned for languageCode th-TH. Per the ' +
        '@google-cloud/text-to-speech v6.4.1 typings, Gemini TTS is a real, documented part of ' +
        'the v1 API surface (SynthesisInput.prompt, AdvancedVoiceOptions, MultiSpeakerMarkup all ' +
        'reference it in cloud_tts.proto) and voices are selected the same way as any other voice ' +
        '— by the name returned from listVoices, via VoiceSelectionParams.name. There is no separate ' +
        'call or model parameter to opt in. So either this project/region does not currently have a ' +
        'Gemini TTS voice provisioned for Thai, or its name does not contain the literal string ' +
        '"gemini" — see the full dump above and adjust the filter if a candidate is visible there.',
    );
    return;
  }

  const failingParagraph = paragraphsOf(loadSection('civil-th', '1598/21'))
    .reduce((longest, p) => (p.length > longest.length ? p : longest), '');
  console.log(`\ntrying the round-1 failing paragraph (${failingParagraph.length} chars) against each Gemini voice...`);

  mkdirSync(OUT, { recursive: true });
  for (const v of geminiVoices) {
    try {
      const audio = await synthesizeOne(client, failingParagraph, v.name);
      const outPath = `${OUT}gemini-check-${safeName('civil-th', '1598_21')}-${v.name}.mp3`;
      writeFileSync(outPath, audio);
      console.log(`  ok    ${v.name}  -> ${outPath}`);
    } catch (err) {
      console.log(`  FAIL  ${v.name}: ${err.message}`);
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const mode = parseMode(process.argv.slice(2));
  const client = new TextToSpeechClient();
  if (mode === 'probe') await runProbe(client);
  else if (mode === 'gemini') await runGemini(client);
  else await runRender(client);
}
