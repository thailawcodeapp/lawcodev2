# Pro login gate — device checklist (build 66)

## iOS

- [ ] 0. Before running any of the checks below: confirm `ios/APPLE_SIGNIN_SETUP.md`'s
      two Apple Developer Portal steps are done and the CI Release build
      succeeded with the new entitlement — otherwise nothing past this point
      is testable.
- [ ] 1. Buy Pro in sandbox, do NOT sign in with Google or Apple. Open Settings:
      Pro card shows "Pro รอเปิดใช้งาน" with both sign-in buttons — Apple's
      button uses the native system style, appears above/beside Google's.
- [ ] 2. From Reader, tap highlight without signing in. Modal reads
      "เข้าสู่ระบบเพื่อใช้งาน Pro" — NOT "ไฮไลท์ตัวบท — ฟีเจอร์ Pro". Tapping the
      sign-in button inside the modal, completing sign-in, closes the modal
      and the tap's underlying action is now available (tap highlight again
      — it toggles).
- [ ] 3. Same check for bookmark (Reader) and folder creation (เลือกฟัง tab).
- [ ] 4. Sign in with Google. Ads disappear, folder creation works, listening
      is unlimited (no quota bar).
- [ ] 5. Sign out. Ads reappear, quota bar reappears, highlight/bookmark/folder
      gates re-block with the sign-in modal again (not the "buy Pro" modal —
      the subscription itself is still owned).
- [ ] 6. Sign in with Apple instead of Google on a fresh sandbox tester Apple
      ID. Same result as step 4. Confirm no "invalid_client" or entitlement
      error appears (see `ios/APPLE_SIGNIN_SETUP.md` if one does).
- [ ] 7. Sign in on 4 different sandbox-capable simulators/devices with the
      SAME account. The 4th shows "ใช้งานครบจำนวนอุปกรณ์แล้ว" (device-slot gate,
      not the sign-in gate) with a "จัดการอุปกรณ์" button that lands on
      Settings' device list.
- [ ] 8. From Settings on any already-signed-in device, revoke one of the
      other 3 devices. The 4th device (from step 7), on its next Pro-gated
      tap, is now allowed.
- [ ] 9. A genuinely FREE (non-purchasing) account still sees the original
      "buy Pro" modals (ProGateModal) everywhere, unchanged from before this
      plan — never the sign-in modal.
- [ ] 10. TTS quota-blocked bar: a signed-out subscriber sees "เข้าสู่ระบบ" as
      the button, not "ดูโฆษณา +N มาตรา". A genuinely free user still sees the
      ad-watch button as before.

## Android

- [ ] 11. Repeat steps 1, 2, 4, 5 on Android. Only the Google button appears
      anywhere sign-in is offered — no Apple button.
- [ ] 12. Existing Pro subscribers who were already signed in before this
      build: reopen the app. Nothing changes for them — Pro still active,
      no new prompt (this build only starts gating previously-ungated call
      sites; someone who already satisfies `useEffectivePro`'s `'pro'` state
      sees no behavior change at all).

## Rollback

If anything above fails and cannot be fixed quickly: this plan added no new
flag to gate itself behind (unlike the receipt validator's
`RECEIPT_VALIDATOR_URL`), because the underlying `useEffectivePro`/
`useDeviceGate` machinery was already live and correct — this plan only
wires MORE call sites to it. Reverting means re-pointing the 6 call sites in
Tasks 7–11 back to `settings.isPro` (`git revert` those commits) and
shipping a build without the sign-in requirement; Apple sign-in itself
(Tasks 2–4, 12) can stay shipped and simply unused.
