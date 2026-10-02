# Receipt validator — device checklist (build 65)

Sandbox subscriptions expire in minutes (a monthly renews every 5 minutes and
stops after 6 renewals), which makes lapse testing fast and makes "still Pro
after 30 minutes" meaningless. Test on iOS first — Android never had the bug.

## iOS

- [ ] 1. Fresh install, no subscription. App opens, no Pro, no sign-in prompt.
- [ ] 2. Buy monthly in sandbox. Pro turns on.
- [ ] 3. Force-quit, reopen with network ON. **Pro survives** — this is the bug
      that shipped in every build up to 63.
- [ ] 4. Force-quit, reopen with network OFF. Pro survives.
- [ ] 5. Airplane mode for a full minute, then back on. Pro survives.
- [ ] 6. Wait for the sandbox subscription to run out its 6 renewals (~30 min),
      then reopen with network ON. **Pro is revoked.** This is the behaviour
      no previous build had.
- [ ] 7. After 6, press Restore. Pro does **not** come back (it is genuinely
      expired) and no error toast fires.
- [ ] 8. After 6, go offline and reopen. Pro stays revoked — the cached expiry
      is what enforces this.
- [ ] 9. At no point does an Apple ID password prompt appear on launch.
- [ ] 10. Settings screen does not flicker or shift on open, for Pro or free.

## Android

- [ ] 11. Existing Pro subscriber: force-quit, reopen. Pro survives.
- [ ] 12. Offline launch. Pro survives.
- [ ] 13. Cancel and let the test subscription lapse; reopen. Pro is revoked.
- [ ] 14. Purchase flow still charges the plan that was tapped (monthly vs
      quarterly vs yearly) — the base-plan matcher is untouched but this is
      the highest-cost regression in the file.

## Server

- [ ] 15. Run the smoke test from `firebase/functions/README.md`. Expect
      `{"ok":false,"code":6777018,...}`.
- [ ] 16. Firebase console → Functions → Logs: confirm no unhandled exceptions
      during the runs above, and that `validateReceipt` invocation count is
      roughly one per app launch, not one per second.

## Rollback

If anything in 1-14 fails and cannot be fixed quickly: set
`RECEIPT_VALIDATOR_URL = ''` in `src/config.js`, bump to 66, ship. The app
returns to build 64 behaviour (Pro persists, never revoked) with no server
change and no store review dependency.
