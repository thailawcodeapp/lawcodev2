# Phase 3A — render pipeline

Turns the four Thai legal codes into one MP3 per paragraph, named by a hash
of the text the engine was given, plus the manifest the app ships.

## Authenticate

    gcloud auth application-default login
    gcloud auth application-default set-quota-project YOUR_PROJECT_ID
    gcloud services enable texttospeech.googleapis.com

No key file. Google blocks service-account key downloads by default for
organizations, and the client finds your own credentials unaided.

## Run, from the repository root

    node scripts/tts-render/render.mjs --manifest      # manifest only, no API calls
    node scripts/tts-render/render.mjs --limit 50      # try 50 paragraphs first
    node scripts/tts-render/render.mjs                 # everything still missing

Files land in `out/<hash>.mp3` (gitignored). A file that already exists is
never re-rendered, so a failed run costs nothing to resume and the whole
thing can be split across two months to stay inside the 1M characters/month
free tier.

At 180 requests/minute the full corpus takes roughly 40 minutes.

## What to expect

6,764 paragraphs, about 1.17M characters. A paragraph the engine rejects for
sentence length is split at the space nearest its midpoint and retried; the
pieces are concatenated back into one file, so it stays one file per
paragraph. The summary reports how many were split.

Verify before uploading — see `verify.mjs`. A request that returns 200 with
truncated audio is the failure mode that matters, and it is invisible here.
