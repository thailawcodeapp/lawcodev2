# Phase 2 pilot

Renders ten real sections through Google TTS so the engine and voice for
phase 3 can be chosen by listening, and so the first invoice gives us the
real per-character cost before committing to 6,770 files.

Throwaway: not imported by the app, not run in CI, output is gitignored.

## Round 3: what to decide now

**Listening to civil 1598/21 with the automatic split is now the decision
that matters most.** Round 2 bracketed the real limit to between 255 (ok)
and 378 (fail) characters of real paragraph text — by paragraph length that
means somewhere between 414 (6%) and 1,289 (19%) of the corpus's 6,770
paragraphs need to be split before they can be sent to Chirp 3 HD at all.
That number is fixed regardless of exactly where the limit turns out to be,
so whether the resulting seam is *acceptable to listen to* decides phase 3
by itself — if it isn't, nothing else in this round matters. `render.mjs`
now splits and retries a rejected paragraph automatically (see below); the
owner should render civil 1598/21 and judge the seam before reading further.

Round 2 also refuted a hypothesis from its own probe: that the trigger was
the longest run of characters with no space to break at. A 204-character
run is present in the 255-char prefix that *passed*, so run length is not
the mechanism. **Do not reintroduce that hypothesis.** What actually gates
acceptance is still unconfirmed beyond the 255/378 bracket.

`--gemini` confirmed there is no Gemini TTS voice for `th-TH` — 32 Thai
voices came back (30 Chirp3-HD, `th-TH-Neural2-C`, `th-TH-Standard-A`), none
of them Gemini. That engine is out for this language. It did surface
`th-TH-Neural2-C`, a different architecture from Chirp 3 HD, not previously
known to be available, priced at roughly half — `--neural2` checks whether
it shares Gacrux's limit and renders samples with it for comparison.

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

    node scripts/tts-pilot/render.mjs            # render, Gacrux only, splitting on rejection
    node scripts/tts-pilot/render.mjs --probe     # narrow the 255/378 bracket further
    node scripts/tts-pilot/render.mjs --gemini    # check Gemini TTS reachability
    node scripts/tts-pilot/render.mjs --neural2   # check th-TH-Neural2-C and render samples

Run it from the repository root — it reads `public/data/*.json` by relative
path. Output lands in `out/`, one file per voice per section.

### Split-on-failure (the default render path)

A paragraph the engine rejects is no longer simply lost. It is split and the
pieces are retried, recursively:

1. The whole paragraph is tried first, exactly as before.
2. On rejection, it's cut at the space nearest its character midpoint —
   Thai legal text uses spaces as clause separators, not word separators, so
   a clause boundary is the least bad place to put an audible seam. Falls
   back to the raw midpoint (a mid-word cut) only if the paragraph has no
   usable space.
3. Both pieces are tried; a piece that still fails is split again, up to a
   depth of `MAX_SPLIT_DEPTH` (4, i.e. at most 16 pieces), so a pathological
   paragraph cannot loop forever. A leaf that still fails at the depth limit
   is recorded as a failure, same as before.
4. Every piece that succeeded is concatenated into the section's output
   file, in reading order — exactly the same concatenation multi-paragraph
   sections already go through, so a split paragraph is inaudible as a
   *file* boundary; whether it's inaudible as a *sentence* boundary is what
   the owner needs to judge by ear.

The summary lists which paragraphs needed splitting and into how many
pieces, e.g.:

    ok         th-TH-Chirp3-HD-Gacrux  civil-th 1598/21  2/2 paragraphs ok
        paragraph 1 (378 chars) needed splitting: 2 pieces, max depth 1

This could not be exercised against the real API from this environment.
It was verified with a fake client that rejects text over a configurable
length threshold (`scripts/tts-pilot/render.test.mjs`): pieces are
confirmed to be retried after a split, concatenated in the original reading
order, counted (only characters from a successful request), and reported.
What that cannot confirm is whether a real split, on real audio, sounds
acceptable — that's exactly what listening to the rendered civil 1598/21
is for.

### `--neural2`: does th-TH-Neural2-C have the same limit?

`--gemini` (below) turned up `th-TH-Neural2-C` while confirming there's no
Gemini voice for Thai. It's a different architecture from the Chirp3-HD
family, not previously known to be available, and priced at roughly half.
This mode:

1. Sends the exact paragraph that killed round 1 (civil 1598/21, 378 chars,
   unmodified — no splitting) to `th-TH-Neural2-C` and reports accept or
   reject with the API's own message.
2. Renders `civil-th 420` (the phrasing case), `civil-th 968` (the fraction
   case), and `civil-th 193/30` (a slash number) with that voice into
   `out/`, skipping any that already exist, so the owner can compare its
   quality against Gacrux directly.

Only step 1 (the accept/reject check) is unit-tested, against a fake
client, as `checkNeural2Limit` — it does not touch disk. Step 2 writes real
audio files and was not run against the live API from this environment;
it needs a real credentialed run before there's anything to listen to.

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
essentially never uses `. ! ?`, so it was hypothesised that the engine was
limiting some per-segment unit (a run of characters with no space to break
at), not the sentence's total length.

**That run-length hypothesis is refuted.** Round 2's real-paragraph probe
bracketed the limit to 255 chars (ok) / 378 chars (fail), and the
255-character prefix that passed *contains* a 204-character run with no
space in it. If run length without a space were the trigger, that prefix
should have failed too. It didn't, so run length is not the mechanism.
**Do not reintroduce this hypothesis** in code or documentation without new
evidence. What the actual trigger is remains unconfirmed beyond the
255/378 character bracket itself.

`--probe` bisects the real paragraph instead of a stand-in:

1. Loads civil 1598/21, paragraph index 1, exactly as `paragraphsOf()`
   returns it (i.e. after `normalizeForSpeech`, the same text the failing
   request actually sent) and sends it whole, unmodified, first. If that
   alone now succeeds, round 1's failure was not reproducible at all — the
   script reports that prominently and stops. It does not bisect a failure
   that didn't happen.
2. If it fails (reproducing round 1), confirms the shortest space-bounded
   prefix of that paragraph succeeds — the first word. If even that fails,
   the script stops rather than bisect from an unconfirmed low end.
3. Confirms the space boundary nearest the previously-established 255-char
   good mark still succeeds. If it doesn't, the old bracket no longer holds
   and the script falls back to bisecting from the first-word low end
   instead of trusting a stale endpoint.
4. Bisects prefixes of the paragraph between that confirmed-good ~255-char
   mark and the confirmed-bad full paragraph (378 chars), narrowing the
   round 2 bracket further. Cuts land at space boundaries where possible,
   but **Thai does not put a space between every word** — spaces mark
   clause boundaries, not word boundaries — so a cut can still fall in the
   middle of what would be one semantic word. The script says this in its
   own output and the resulting number should be treated as approximate,
   not an exact byte-for-byte limit.
5. Sends the civil 420 paragraph (229 chars, the case round 1 actually
   finished) once, purely as a passing density reference.

For every attempt it prints character count, space count, and mean
characters between spaces, so if failures track density (few spaces, long
unbroken runs) rather than raw length, that shows up in the output
directly instead of requiring a second run to notice — this is exactly
the kind of confound that produced the now-refuted run-length hypothesis,
so the raw numbers stay visible rather than being collapsed into a single
verdict. It finishes by printing both the longest prefix that succeeded
and the shortest that failed, with their text, so the boundary can be
eyeballed. Total: roughly half a dozen to a dozen requests depending on how
many internal spaces the paragraph has to bisect over.

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

**Result: no Gemini TTS voice exists for `th-TH`.** 32 voices came back for
the language — 30 `Chirp3-HD` voices, plus `th-TH-Neural2-C` and
`th-TH-Standard-A`. None contain "Gemini". Gemini TTS is out as an engine
for this language; see `--neural2` above for what to do with the Neural2
voice this run turned up instead.

### Resuming

If the output file for a (voice, section) pair already exists, that pair is
skipped and not re-billed — the nine files from round 1 are left alone. A
paragraph that fails no longer kills the run and no longer stays lost: it's
split and the pieces retried (see split-on-failure, above), and only a leaf
that still fails at the depth limit is recorded (section, paragraph index,
length, the API's message) while synthesis moves on to the next paragraph,
then the next section. A summary table at the end lists every section as
`ok`, `partial` (some paragraphs failed), `failed` (all did), or `skipped`,
with split and failure details indented underneath. Losing eight finished
sections because the ninth was rejected was the defect in round 1;
re-running now only ever does new work.

## What to listen for

**Priority one: does civil 1598/21 sound acceptable with the automatic
split?** Round 2 established the real limit lies between 255 and 378
characters of paragraph text; by paragraph length that puts 414 (6%) to
1,289 (19%) of the corpus's paragraphs over it, so however exact the limit
turns out to be, hundreds to over a thousand paragraphs must be split no
matter what. Whether the seam between the two pieces is acceptable to the
ear decides whether phase 3 can proceed with this engine at all — everything
else below is secondary to this.

1. The seam itself, on civil 1598/21 — does the cut (at a clause-separating
   space) read as a natural pause, or as an audible break mid-thought?
2. Naturalness against the Apple enhanced voice you hear in the app today.
3. Phrasing — section 420 has nine clause-separating spaces and is the hard
   case. Turning them into commas was tried on-device and made it choppy, so
   the engine has to phrase this from context or not at all.
4. Legal vocabulary: ทวิ, ฉ้อฉล, นิติกรรมอำพราง, and the section numbers.
5. Fatigue — play the longest file to the end. A voice that is pleasant for
   ten seconds and tiring for ten minutes is the wrong voice for 43 hours.
6. Section 968 must read "ร้อยละ เศษหนึ่งส่วนหก". If it says "หนึ่งทับหก",
   normalizeForSpeech has regressed.
7. If `--neural2` was run, compare its samples against the equivalent
   Gacrux files — same sections, so the comparison is direct.

## Cost

The script prints the characters it billed. Reconcile that against the Cloud
console. Free tier is 1M characters/month and the whole corpus is 1.16M, so
splitting the real render across two months costs nothing.
