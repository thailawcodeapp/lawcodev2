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
//   node scripts/tts-pilot/render.mjs --probe    bisect the real failing paragraph (civil
//                                                 1598/21) to find where it breaks
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

// Character/space/density stats for a probe string. Round 1's synthetic
// probe corpus (concatenated paragraphs from four sections) had far more
// spaces per character than a single dense Thai legal paragraph, which is
// why its 229/378 bracket did not carry over to the real failing text —
// printing this for every attempt makes that kind of confound visible
// immediately instead of requiring a second run to notice.
export function densityOf(text) {
  const spaces = (text.match(/ /g) || []).length;
  const meanCharsPerSpace = spaces > 0 ? text.length / spaces : text.length;
  return { chars: text.length, spaces, meanCharsPerSpace };
}

function logProbeResult(label, text, result) {
  const d = densityOf(text);
  const status = result.ok ? 'ok' : `FAIL — ${result.message}`;
  console.log(
    `  ${label}: ${d.chars} chars, ${d.spaces} spaces, ` +
      `${d.meanCharsPerSpace.toFixed(1)} chars/space avg — ${status}`,
  );
}

// Cut points a prefix of `text` may end at without splitting a word: the
// position right before each space, plus the full length of `text` itself.
export function spacePrefixBoundaries(text) {
  const boundaries = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') boundaries.push(i);
  }
  boundaries.push(text.length);
  return boundaries;
}

// Round 1 failed on a specific real paragraph (civil 1598/21, paragraph
// index 1 after normalizeForSpeech), not on "378 characters" — a synthetic
// 378-character probe string built from concatenated corpus text succeeded,
// which meant the earlier bracket wasn't measuring the actual constraint.
// This probes that paragraph directly: send it whole first (if that alone
// no longer reproduces the failure, there is nothing to bisect and no
// bracket to trust), then bisect prefixes of it — cut only at space
// boundaries, so every request is a plausible utterance rather than a word
// fragment — to find the longest prefix that still succeeds and the
// shortest that still fails. A passing paragraph (civil 420, the case round
// 1 actually finished) is probed too, purely as a density reference point.
async function runProbe(client) {
  const failingParagraph = paragraphsOf(loadSection('civil-th', '1598/21'))[1];
  const referenceParagraph = paragraphsOf(loadSection('civil-th', '420'))[0];

  console.log('probing the real paragraph that failed round 1: civil 1598/21, paragraph index 1');
  console.log(`(${failingParagraph.length} chars): "${failingParagraph}"\n`);

  const probe = async (text) => {
    try {
      await synthesizeOne(client, text, VOICE);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  };

  console.log('sending the whole paragraph unmodified...');
  const wholeResult = await probe(failingParagraph);
  logProbeResult('whole paragraph', failingParagraph, wholeResult);

  if (wholeResult.ok) {
    console.log(
      "\nUNEXPECTED SUCCESS: the whole paragraph that killed round 1 now succeeds. Round 1's " +
        'failure was NOT reproduced — the limit that caused it is gone, moved, or was transient. ' +
        'There is nothing to bisect. Do not trust a bracket built from this run; re-check by ' +
        'rendering the section directly before concluding the engine is usable.',
    );
    return;
  }
  console.log('  reproduces round 1: fails as before.\n');

  const boundaries = spacePrefixBoundaries(failingParagraph);
  if (boundaries.length < 2) {
    console.log(
      'This paragraph has no internal space to cut a prefix at, so it cannot be bisected. The ' +
        'failure is real but this script cannot narrow it further for this paragraph.',
    );
    return;
  }

  const shortestPrefix = failingParagraph.slice(0, boundaries[0]);
  console.log(`confirming the shortest space-bounded prefix (${shortestPrefix.length} chars) succeeds...`);
  const shortestResult = await probe(shortestPrefix);
  logProbeResult('shortest prefix', shortestPrefix, shortestResult);

  if (!shortestResult.ok) {
    console.log(
      '\nEven the shortest space-bounded prefix of this paragraph fails. There is no confirmed ' +
        'good endpoint inside this paragraph to bisect from — not searching a bracket with no ' +
        'known-good end. Something other than run length is the trigger.',
    );
    return;
  }

  console.log(`\nreference (known to succeed, civil 420, ${referenceParagraph.length} chars)...`);
  const referenceResult = await probe(referenceParagraph);
  logProbeResult('civil 420', referenceParagraph, referenceResult);

  console.log('\nbisecting prefixes between the shortest good prefix and the full failing paragraph...');
  let loIdx = 0; // boundaries[loIdx] confirmed good (shortestResult, above)
  let hiIdx = boundaries.length - 1; // boundaries[hiIdx] confirmed bad (wholeResult, above)
  while (hiIdx - loIdx > 1) {
    const midIdx = Math.floor((loIdx + hiIdx) / 2);
    const prefix = failingParagraph.slice(0, boundaries[midIdx]);
    const result = await probe(prefix);
    logProbeResult(`prefix to ${boundaries[midIdx]}`, prefix, result);
    if (result.ok) loIdx = midIdx;
    else hiIdx = midIdx;
  }

  const goodLength = boundaries[loIdx];
  const badLength = boundaries[hiIdx];
  console.log(`\nlongest prefix that succeeded:  ${goodLength} chars`);
  console.log(`  "${failingParagraph.slice(0, goodLength)}"`);
  console.log(`shortest prefix that failed:    ${badLength} chars`);
  console.log(`  "${failingParagraph.slice(0, badLength)}"`);
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
