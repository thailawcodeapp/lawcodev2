# Receipt validator

HTTPS endpoint that cordova-plugin-purchase calls as `store.validator`. It asks
Apple and Google for the real subscription expiry so the app can keep a paying
subscriber's Pro across restarts *and* cut a lapsed one.

## Secrets (owner only — never commit these)

Two secrets must exist before the first deploy. Set them from your machine;
they are stored in Google Secret Manager, not in this repo.

### APPLE_SHARED_SECRET

App Store Connect → your app → **App Information** → *App-Specific Shared
Secret* → Generate/View. Copy the hex string.

    firebase functions:secrets:set APPLE_SHARED_SECRET

### GOOGLE_PLAY_SA_JSON

1. Google Play Console → **Setup → API access** → link the Google Cloud project.
2. Create a service account, grant it **View financial data** and
   **Manage orders and subscriptions** on the app.
3. Download its JSON key.
4. Paste the whole file contents as the secret value:

    firebase functions:secrets:set GOOGLE_PLAY_SA_JSON

## Deploy

    firebase deploy --only functions

Note the URL it prints. It goes into `RECEIPT_VALIDATOR_URL` in `src/config.js`.

## Smoke test

    curl -s -X POST <URL> -H 'Content-Type: application/json' \
      -d '{"id":"com.lawcodev2.app","transaction":{"type":"ios-appstore"}}'

Expect `{"ok":false,"code":6777018,"message":"Missing appStoreReceipt"}` —
that proves routing and deployment without needing a real receipt.

## Rollback

Set `RECEIPT_VALIDATOR_URL = ''` in `src/config.js` and ship. The client then
never configures a validator and the plugin falls back to local receipts,
i.e. exactly build 64's behaviour.
