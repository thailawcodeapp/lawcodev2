# Phase 2 pilot

Renders ten real sections through Google TTS so the engine and voice for
phase 3 can be chosen by listening, and so the first invoice gives us the
real per-character cost before committing to 6,770 files.

Throwaway: not imported by the app, not run in CI, output is gitignored.

## Run

    npm install -D @google-cloud/text-to-speech
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/tts-pilot/render.mjs

Output lands in `out/`, one file per voice per section.

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
