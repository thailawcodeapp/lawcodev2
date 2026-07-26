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

## Upload

Create an R2 bucket in the Cloudflare dashboard, then an API token scoped to
it (R2 → Manage API tokens → Object Read & Write). Export the four values —
never put them in a file in this repository:

    export R2_ACCOUNT_ID=...
    export R2_ACCESS_KEY_ID=...
    export R2_SECRET_ACCESS_KEY=...
    export R2_BUCKET=juris-voice-audio

    node scripts/tts-render/verify.mjs   # must pass first
    node scripts/tts-render/upload.mjs

Objects are `audio/<hash>.mp3`, immutable and cached for a year. Re-running
uploads only what the bucket does not already have, and finishes by listing
the bucket to confirm every paragraph in the manifest has an object — a
half-finished upload exits non-zero rather than reporting success.

Connect a custom domain or enable the r2.dev subdomain so the app can fetch
these over HTTPS; that base URL is what phase 3B needs.

### Cost at this size

468 MB of audio against R2's 10 GB free storage, and egress is free. At 1,000
daily users fetching ~8 paragraphs each, reads land near 240k/month against a
10M free allowance. Nothing here bills at this scale.
