// Older builds persisted the plugin's numeric voice-list index into settings.
// That index isn't a stable identifier (see tts.js setVoice), so the engine
// already drops it and falls back to auto-pick. But nothing told the stored
// setting to drop it too, so the settings value stayed a stale number and the
// voice <select> (keyed by voiceURI string) matched no <option>, rendering
// blank instead of "อัตโนมัติ (ค่าเริ่มต้นระบบ)".
//
// Pure so it can be unit-tested without rendering React — TtsProvider has no
// component-testing harness in this project.
export function migrateLegacyVoice(ttsVoice) {
  return typeof ttsVoice === 'number' ? null : ttsVoice;
}
