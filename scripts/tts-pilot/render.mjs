// Phase 2 pilot — renders real sections so the engine and voice can be
// judged by ear, and so the bill tells us the real per-character cost
// before committing to 6,770 files.
//
// Round 1 picked th-TH-Chirp3-HD-Gacrux by ear and then died on civil
// 1598/21 with "sentences that are too long" — Thai legal text almost never
// uses sentence-ending punctuation (13 of 6,770 paragraphs do), so the whole
// paragraph is one "sentence" to the engine, and 24% of paragraphs are
// longer than the longest one that worked.
//
// Round 2 bracketed the real limit against real paragraph text (civil
// 1598/21, paragraph index 1) to between 255 chars (ok) and 378 chars
// (fail). It also refuted the earlier hypothesis that the trigger was the
// longest run of characters without a space: a 204-character run is present
// in the 255-char prefix that passed, so run length is not the mechanism —
// do not reintroduce that hypothesis. --gemini found no Gemini TTS voice
// for th-TH (32 Thai voices came back, none Gemini), so that engine is out;
// it did surface th-TH-Neural2-C, a different, cheaper architecture not
// previously known to be available.
//
// This round: (1) split-on-failure in the normal render path, so a rejected
// paragraph is cut at the space nearest its midpoint and the pieces
// retried, recursively, instead of the paragraph being lost — this is what
// decides whether phase 3 is possible at all, since the seam has to sound
// acceptable; (2) --neural2 checks whether th-TH-Neural2-C shares the same
// limit and renders samples with it for comparison; (3) --probe now
// narrows the 255/378 bracket further by bisection.
//
// Throwaway: not imported by the app, not run in CI.
//
// Authenticate with `gcloud auth application-default login` first — see
// README.md. Google blocks service-account key downloads by default for
// organizations now, and the client picks up your own credentials without
// being told where they are.
//
// Usage, from the repository root:
//   node scripts/tts-pilot/render.mjs            render remaining samples with Gacrux,
//                                                 splitting and retrying any paragraph the
//                                                 engine rejects
//   node scripts/tts-pilot/render.mjs --probe    narrow the 255/378 bracket further by
//                                                 bisecting the real failing paragraph (civil
//                                                 1598/21)
//   node scripts/tts-pilot/render.mjs --gemini   check whether a Gemini TTS voice is
//                                                 reachable for th-TH and try it against
//                                                 the paragraph that killed round 1
//   node scripts/tts-pilot/render.mjs --neural2  check whether th-TH-Neural2-C shares
//                                                 Gacrux's limit and render samples with it
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
  if (argv.includes('--neural2')) return 'neural2';
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
    for (const sp of r.splits || []) {
      lines.push(
        `    paragraph ${sp.paragraphIndex} (${sp.originalLength} chars) needed splitting: ` +
          `${sp.pieceCount} pieces, max depth ${sp.maxDepth}`,
      );
    }
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

// A paragraph the engine rejects still has to be spoken somehow, and the
// only tool available is cutting it into pieces small enough to accept.
// Thai legal text uses spaces as clause separators, not word separators —
// there is no punctuation marking where a "sentence" the engine would
// tolerate ends — so a clause boundary is the least bad place to put an
// audible seam. This finds the space nearest the character midpoint of
// `text` and returns its index; if there is no space at all, it returns the
// raw midpoint (a mid-word cut, which is why the caller only reaches for
// this when nothing better is available).
export function splitPoint(text) {
  const mid = Math.floor(text.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
  }
  return best === -1 ? mid : best;
}

// Splits `text` into two non-empty pieces at splitPoint(text). Returns a
// single-element array (i.e. "cannot usefully split") if there is nothing on
// one side after trimming — this is what stops the caller from recursing
// forever on a paragraph that has run out of room to cut.
export function splitParagraph(text) {
  const cut = splitPoint(text);
  const first = text.slice(0, cut).trim();
  const second = text.slice(cut).trim();
  return [first, second].filter(Boolean);
}

export const MAX_SPLIT_DEPTH = 4; // 2^4 = 16 pieces worst case — a depth limit so a
// pathological paragraph (or a bug in splitParagraph) cannot loop forever.

// Synthesizes `text` with VOICE, and on rejection splits it and retries the
// pieces, recursively, up to maxDepth. Returns { parts, chars, failures,
// splits }: parts is the audio for every piece that succeeded, in reading
// order (so Buffer.concat(parts) is exactly the section's audio, the same
// way multi-paragraph sections are already concatenated); chars counts only
// characters actually sent to a successful request; failures lists leaves
// that still failed at the depth limit or that could not be split further;
// splits records every split that happened, for the summary.
export async function synthesizeParagraphWithSplit(client, text, { maxDepth = MAX_SPLIT_DEPTH } = {}) {
  const parts = [];
  const failures = [];
  const splits = [];
  let chars = 0;

  async function attempt(piece, depth) {
    try {
      const bytes = Buffer.byteLength(piece, 'utf8');
      if (bytes > 5000) throw new Error(`paragraph over the 5000-byte limit: ${bytes}`);
      const audio = await synthesizeOne(client, piece, VOICE);
      parts.push(audio);
      chars += piece.length;
      return true;
    } catch (err) {
      if (depth >= maxDepth) {
        failures.push({ text: piece, length: piece.length, message: err.message, depth });
        return false;
      }
      const pieces = splitParagraph(piece);
      if (pieces.length < 2) {
        failures.push({ text: piece, length: piece.length, message: err.message, depth });
        return false;
      }
      splits.push({ depth, originalLength: piece.length, pieceCount: pieces.length });
      let allOk = true;
      for (const p of pieces) {
        const ok = await attempt(p, depth + 1);
        if (!ok) allOk = false;
      }
      return allOk;
    }
  }

  await attempt(text, 0);
  return { parts, chars, failures, splits };
}

// Renders every sample with VOICE. Never throws out of the loop: a bad
// paragraph is split and retried (see synthesizeParagraphWithSplit) rather
// than simply recorded as lost, so eight good sections are never lost
// because the ninth was rejected. A (voice, section) pair whose output file
// already exists is skipped — round 1's files are not re-billed.
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
    const sectionSplits = [];
    let sectionChars = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i];
      const result = await synthesizeParagraphWithSplit(client, text);
      parts.push(...result.parts);
      sectionChars += result.chars;

      if (result.splits.length > 0) {
        const maxDepth = result.splits.reduce((m, s) => Math.max(m, s.depth), 0);
        sectionSplits.push({
          paragraphIndex: i,
          originalLength: text.length,
          pieceCount: result.parts.length + result.failures.length,
          maxDepth,
        });
        console.log(
          `split ${VOICE}  ${book} ${number}  paragraph ${i} (${text.length} chars) ` +
            `into ${result.parts.length + result.failures.length} pieces`,
        );
      }

      for (const f of result.failures) {
        failures.push({ paragraphIndex: i, length: f.length, message: f.message });
        console.error(`FAIL  ${VOICE}  ${book} ${number}  paragraph ${i} piece (${f.length} chars): ${f.message}`);
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
      splits: sectionSplits,
    });
    console.log(
      `${status}  ${VOICE}  ${book} ${number}  ` +
        `(${paragraphs.length - failures.length}/${paragraphs.length} paragraphs, ${failures.length} failed, ` +
        `${sectionSplits.length} split)`,
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

  // The last round already bracketed the limit to 255 (ok) / 378 (fail) by hand. Start the
  // bisection from the space boundary nearest 255 instead of the first word, so this run
  // narrows that existing bracket instead of re-deriving it from scratch. If the endpoint
  // near 255 does not behave as expected (i.e. does not succeed), that bracket is no longer
  // trustworthy and this stops rather than bisect from an unconfirmed low end — the same
  // guard already applied to the shortest-prefix check above.
  let startIdx = 0;
  for (let k = 0; k < boundaries.length; k++) {
    if (boundaries[k] <= 255) startIdx = k;
    else break;
  }
  const nearBracketPrefix = failingParagraph.slice(0, boundaries[startIdx]);
  console.log(
    `\nconfirming the space boundary nearest the established 255-char mark ` +
      `(${nearBracketPrefix.length} chars) still succeeds...`,
  );
  const nearBracketResult = await probe(nearBracketPrefix);
  logProbeResult('near 255', nearBracketPrefix, nearBracketResult);

  if (!nearBracketResult.ok) {
    console.log(
      '\nThe boundary near the previously-established 255-char good mark now fails. The old ' +
        'bracket no longer holds — not bisecting from an endpoint that no longer behaves as ' +
        'expected. Falling back to the shortest confirmed-good prefix from above.',
    );
    startIdx = 0;
  }

  console.log(
    '\nbisecting prefixes between the established 255-char bracket and the full failing ' +
      'paragraph (378 chars) to narrow the limit further...',
  );
  console.log(
    'Note: Thai does not put a space between every word, only at clause boundaries, so each ' +
      'cut below lands at the nearest available space rather than a true word edge — sometimes ' +
      'effectively mid-word. Treat the resulting number as approximate, not an exact limit.',
  );
  let loIdx = startIdx; // boundaries[loIdx] confirmed good
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
  console.log(`\nlongest prefix that succeeded:  ${goodLength} chars (approximate — see note above)`);
  console.log(`  "${failingParagraph.slice(0, goodLength)}"`);
  console.log(`shortest prefix that failed:    ${badLength} chars (approximate — see note above)`);
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

// --gemini established there is no Gemini TTS voice for th-TH, but it surfaced a voice not
// previously known to be available: th-TH-Neural2-C, a different architecture from the
// Chirp3-HD family that priced roughly half. This checks whether it shares Gacrux's limit
// (by sending it the exact 378-char paragraph that killed round 1, unmodified — no splitting,
// no shortening, so a pass here would mean the limit is architecture-specific) and then
// renders a few SAMPLES with it so the owner can judge its quality against Gacrux directly.
export const NEURAL2_VOICE = 'th-TH-Neural2-C';
export const NEURAL2_SAMPLES = [
  ['civil-th', '420'], // the phrasing case — nine clause-separating spaces
  ['civil-th', '968'], // must still read as a fraction, not a section reference
  ['civil-th', '193/30'], // slash number
];

// Sends the exact 378-char paragraph that killed round 1 (civil 1598/21, paragraph index 1),
// unmodified, to th-TH-Neural2-C and reports accept/reject with the API's own message. Split
// out from runNeural2 so it can be exercised with a fake client without touching disk — the
// rest of runNeural2 writes sample audio to OUT, which a unit test should not do.
export async function checkNeural2Limit(client) {
  const failingParagraph = paragraphsOf(loadSection('civil-th', '1598/21'))[1];
  console.log(
    `sending the round-1 failing paragraph (${failingParagraph.length} chars, unmodified) to ` +
      `${NEURAL2_VOICE}...`,
  );
  try {
    await synthesizeOne(client, failingParagraph, NEURAL2_VOICE);
    console.log(
      `  ok    ${NEURAL2_VOICE} accepted the ${failingParagraph.length}-char paragraph that ` +
        `${VOICE} rejected — this voice does not share that limit, or not at this length.`,
    );
    return { ok: true };
  } catch (err) {
    console.log(`  FAIL  ${NEURAL2_VOICE}: ${err.message}`);
    return { ok: false, message: err.message };
  }
}

export async function runNeural2(client) {
  await checkNeural2Limit(client);

  mkdirSync(OUT, { recursive: true });
  console.log(`\nrendering ${NEURAL2_SAMPLES.length} samples with ${NEURAL2_VOICE} for comparison...`);
  for (const [book, number] of NEURAL2_SAMPLES) {
    const outPath = outPathFor(NEURAL2_VOICE, book, number);
    if (existsSync(outPath)) {
      console.log(`skip  ${NEURAL2_VOICE}  ${book} ${number}  (already rendered)`);
      continue;
    }

    const paragraphs = paragraphsOf(loadSection(book, number));
    const parts = [];
    let failed = 0;
    for (const text of paragraphs) {
      try {
        parts.push(await synthesizeOne(client, text, NEURAL2_VOICE));
      } catch (err) {
        failed += 1;
        console.log(`  FAIL  ${NEURAL2_VOICE}  ${book} ${number}: ${err.message}`);
      }
    }
    if (parts.length > 0) {
      writeFileSync(outPath, Buffer.concat(parts));
      console.log(
        `  ok    ${NEURAL2_VOICE}  ${book} ${number}  -> ${outPath} ` +
          `(${paragraphs.length - failed}/${paragraphs.length} paragraphs)`,
      );
    } else {
      console.log(`  failed ${NEURAL2_VOICE}  ${book} ${number}  all paragraphs rejected`);
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const mode = parseMode(process.argv.slice(2));
  const client = new TextToSpeechClient();
  if (mode === 'probe') await runProbe(client);
  else if (mode === 'gemini') await runGemini(client);
  else if (mode === 'neural2') await runNeural2(client);
  else await runRender(client);
}
