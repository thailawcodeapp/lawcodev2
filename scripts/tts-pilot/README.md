# Phase 2 pilot

Renders ten real sections through Google TTS so the engine and voice for
phase 3 can be chosen by listening, and so the first invoice gives us the
real per-character cost before committing to 6,770 files.

Throwaway: not imported by the app, not run in CI, output is gitignored.

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

    node scripts/tts-pilot/render.mjs

Run it from the repository root — it reads `public/data/*.json` by relative
path. Output lands in `out/`, one file per voice per section.

There is no resume. If the run dies partway — a bad voice name, a network
blip, a killed terminal — re-running starts from the first sample again and
re-bills everything already synthesized. At this size that's cents, not
dollars, but it's not free.

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

## Cost

The script prints the characters it billed. Reconcile that against the Cloud
console. Free tier is 1M characters/month and the whole corpus is 1.16M, so
splitting the real render across two months costs nothing.
