# Sign in with Apple — owner setup

> **⚠️ Do this BEFORE the next CI Release build, not after.** Merging this
> branch adds `CODE_SIGN_ENTITLEMENTS` to the Xcode project. The next
> Release build will fail signing ("provisioning profile doesn't include
> the com.apple.developer.applesignin entitlement") until steps 1 and 2
> below are done and the regenerated profile is re-uploaded to the
> `IOS_PROVISIONING_PROFILE_BASE64` secret.

Code-side wiring (entitlements file, CODE_SIGN_ENTITLEMENTS build setting,
Firebase Apple provider, the in-app buttons) is already done. Two account
actions remain, both on the Apple Developer / Firebase side, neither doable
from a checked-out repo:

## 1. Enable the capability on the App ID

1. https://developer.apple.com/account → Certificates, Identifiers & Profiles → Identifiers
2. Select the App ID for `com.lawcodev2.app`
3. Check **Sign In with Apple** → Save

## 2. Regenerate the provisioning profile

The existing "Juris Voice App Store" profile (referenced by
`ios/ExportOptions.plist` and the Release build config) was generated
before the capability existed on the App ID, so it does not grant the
entitlement — Apple ties provisioning profiles to the exact capability set
present on the App ID at generation time.

1. Profiles → find "Juris Voice App Store" → Edit
2. Confirm Sign In with Apple now appears as an available capability (it
   will, automatically, once step 1 is saved) → Save (this regenerates the
   profile; the name stays the same)
3. Download the regenerated `.mobileprovision`
4. Re-encode it and update the `IOS_PROVISIONING_PROFILE_BASE64` GitHub
   Actions secret the same way the original was set:
   ```bash
   base64 -i "Juris Voice App Store.mobileprovision" | pbcopy
   ```
   (or on Windows, `certutil -encode` then strip the header/footer lines)
   then paste into the repo's Settings → Secrets → Actions →
   `IOS_PROVISIONING_PROFILE_BASE64`.

## 3. Enable the provider in the Firebase console

Firebase project `juris-voice` → Authentication → Sign-in method → Apple →
Enable. No extra configuration is required for the Firebase-SDK flow this
app uses (no server-side client secret / private key needed — that is only
for the web OAuth redirect flow, which this app does not use).

## Verifying

After the next CI build, TestFlight → the two sign-in buttons should both
appear in Settings and in any Pro-gated sign-in prompt on iOS; on Android
only the Google button appears (Apple's guidance is not to show it where
it cannot work). Tapping Apple should present the native system sheet, not
an error — a "invalid_client" or entitlement-related failure means step 1
or step 2 above did not take effect yet (profile regeneration can take a
few minutes to propagate).
