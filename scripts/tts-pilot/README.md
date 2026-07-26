# Phase 2 pilot

Renders ten real sections through Google TTS so the engine and voice for
phase 3 can be chosen by listening, and so the first invoice gives us the
real per-character cost before committing to 6,770 files.

Throwaway: not imported by the app, not run in CI, output is gitignored.

## Round 1 result: the voice is chosen, the engine might not be usable

The owner listened to all three Chirp 3 HD candidates and picked
**`th-TH-Chirp3-HD-Gacrux`**. `render.mjs` now renders only that voice by
default — Charon and Schedar are done, their files from round 1 are kept.

Round 1 also died partway through, on civil 1598/21:

    3 INVALID_ARGUMENT: This request contains sentences that are too long.
    Consider splitting up long sentences with sentence ending punctuation
    e.g. periods. Sentence starting with: "ถ้าไม" is too long.

The limit is on **sentence** length, not the 5,000-byte request limit this
script was designed around, and it is undocumented on the quota page. Thai
legal text essentially never uses `. ! ?` (13 of 6,770 paragraphs do), so
the engine treats each paragraph as one giant sentence. Measured against the
corpus: the longest paragraph that succeeded was 229 characters, the one
that failed was 378, and 24% of all paragraphs have a longest "sentence"
over 230 characters. This is not an edge case — it decides whether phase 3
is possible with this engine at all, which is why this round adds `--probe`
and `--gemini` before rendering anything further.

## Authenticate

Sign in as yourself. No key file is involved, and none should be — Google
turns on `iam.disableServiceAccountKeyCreation` by default for organizations
now, so downloading a service-account key is both blocked and the thing that
policy exists to prevent.

    gcloud auth application-default login
    gcloud auth application-default set-quota-project YOUR_PROJECT_ID
    gcloud services enable texttospeech.googleapis.com

`TextToSpeechClient` finds those credentials on its own; nothing needs to be
passed to it and no environment variable needs setting.

Worth putting this in its own project rather than alongside an existing
Firebase one — separate billing line, separate quota, and deleting it later
takes nothing else with it:

    gcloud projects create juris-voice-tts
    gcloud config set project juris-voice-tts

A new project still needs the billing account linked (Console → Billing → Link).

If a service-account key is genuinely unavoidable in some other environment,
the client also honours `GOOGLE_APPLICATION_CREDENTIALS` pointing at one.

## Run

    node scripts/tts-pilot/render.mjs            # render, Gacrux only
    node scripts/tts-pilot/render.mjs --probe     # find the sentence-length limit
    node scripts/tts-pilot/render.mjs --gemini    # check Gemini TTS reachability

Run it from the repository root — it reads `public/data/*.json` by relative
path. Output lands in `out/`, one file per voice per section.

### `--probe`: where exactly does the real paragraph break?

An earlier version of this mode built a synthetic probe string by
concatenating paragraphs from four sections and stripping stray `. ! ?`,
then binary-searched a 229/378 character bracket carried over from round 1.
That was measuring the wrong variable: a 378-character *slice of the
synthetic corpus* succeeded, while the actual 378-character *paragraph*
that killed round 1 (civil 1598/21, paragraph index 1) still failed. The
synthetic corpus concatenated four sections with spaces in between, so it
had far more spaces per character than a single dense Thai legal
paragraph — character count was a confound, not the constraint. Round 1's
error was `"Sentence starting with: ... is too long"`, and Thai legal text
essentially never uses `. ! ?`, so the engine is plausibly limiting some
per-segment unit (a run of characters with no space to break at), not the
sentence's total length. That's a hypothesis, not a confirmed mechanism.

`--probe` now bisects the real paragraph itself instead of a stand-in:

1. Loads civil 1598/21, paragraph index 1, exactly as `paragraphsOf()`
   returns it (i.e. after `normalizeForSpeech`, the same text the failing
   request actually sent) and sends it whole, unmodified, first. If that
   alone now succeeds, round 1's failure was not reproducible at all — the
   script reports that prominently and stops. It does not bisect a failure
   that didn't happen.
2. If it fails (reproducing round 1), confirms the shortest space-bounded
   prefix of that paragraph succeeds — the first word. If even that fails,
   the script stops rather than bisect from an unconfirmed low end.
3. Bisects prefixes of the paragraph between that confirmed-good short
   prefix and the confirmed-bad full paragraph, cutting only at space
   boundaries (never mid-word) so every request is a plausible utterance.
4. Sends the civil 420 paragraph (229 chars, the case round 1 actually
   finished) once, purely as a passing density reference.

For every attempt it prints character count, space count, and mean
characters between spaces, so if failures track density (few spaces, long
unbroken runs) rather than raw length, that shows up in the output
directly instead of requiring a second run to notice. It finishes by
printing both the longest prefix that succeeded and the shortest that
failed, with their text, so the boundary can be eyeballed. Total: roughly
half a dozen to a dozen requests depending on how many internal spaces the
paragraph has to bisect over.

### `--gemini`: does Gemini TTS have the same limit?

The owner noticed in Google's demo that Gemini-TTS phrases Thai better,
which now matters more than it did as an aesthetic preference — if Gemini
TTS doesn't choke on unpunctuated paragraphs the way Chirp 3 HD does, it may
be the only viable engine for phase 3. This mode:

1. Calls `client.listVoices({ languageCode: 'th-TH' })` and prints the raw
   response — no guessing at voice names.
2. Looks for a voice whose name contains "Gemini". If none comes back for
   `th-TH`, it says so and prints the full dump so you can eyeball it for
   anything unexpected, rather than silently concluding Gemini TTS is
   unreachable.
3. If a candidate voice exists, synthesizes the exact paragraph that killed
   round 1 (civil 1598/21, 378 chars) against it and reports success or
   failure.

Per the installed `@google-cloud/text-to-speech` v6.4.1 typings, Gemini TTS
is a documented part of the v1 API (`SynthesisInput.prompt`,
`AdvancedVoiceOptions`, `MultiSpeakerMarkup` all reference it in
`cloud_tts.proto`), and a Gemini voice is selected the same way as any other
voice — by name, via `VoiceSelectionParams.name` — not through a separate
call or model parameter. Whether this project actually has a Gemini voice
provisioned for `th-TH` is exactly what step 1 above answers; it was not
guessed at.

### Resuming

If the output file for a (voice, section) pair already exists, that pair is
skipped and not re-billed — the nine files from round 1 are left alone. A
paragraph that fails no longer kills the run: it's recorded (section,
paragraph index, length, the API's message) and synthesis moves on to the
next paragraph, then the next section. A summary table at the end lists
every section as `ok`, `partial` (some paragraphs failed), `failed` (all
did), or `skipped`, with failure details indented underneath. Losing eight
finished sections because the ninth was rejected was the defect in round 1;
re-running now only ever does new work.

## What to listen for

1. Naturalness against the Apple enhanced voice you hear in the app today.
2. Phrasing — section 420 has nine clause-separating spaces and is the hard
   case. Turning them into commas was tried on-device and made it choppy, so
   the engine has to phrase this from context or not at all.
3. Legal vocabulary: ทวิ, ฉ้อฉล, นิติกรรมอำพราง, and the section numbers.
4. Fatigue — play the longest file to the end. A voice that is pleasant for
   ten seconds and tiring for ten minutes is the wrong voice for 43 hours.
5. Section 968 must read "ร้อยละ เศษหนึ่งส่วนหก". If it says "หนึ่งทับหก",
   normalizeForSpeech has regressed.
6. The open question now isn't tone, it's whether an engine can handle
   unpunctuated Thai legal paragraphs at all. If `--probe` puts the real
   limit well under 378 characters, most of the corpus needs to be split
   before it can be sent to Chirp 3 HD at all — check what `--gemini`
   found before assuming that work is necessary.

## Cost

The script prints the characters it billed. Reconcile that against the Cloud
console. Free tier is 1M characters/month and the whole corpus is 1.16M, so
splitting the real render across two months costs nothing.
