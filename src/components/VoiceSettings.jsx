import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';
import { isAudioEnabled, VOICE_ORDER, VOICE_LABELS } from '../lib/audioManifest';
import BottomSheet from './BottomSheet';

const AUTO_LABEL = 'อัตโนมัติ (ค่าเริ่มต้นระบบ)';

const SAMPLE_TEXT = 'มาตรา ๑ ทดสอบเสียงอ่านประมวลกฎหมาย เสียงดังนี้ครับ';

// Criminal section 59 ¶0 — the same real rendered paragraph the home card
// previews, so the premium button plays an actual file.
const PREMIUM_SECTION_ID = 'cr-59';
const PREMIUM_PARA_INDEX = 0;
const PREMIUM_TEXT =
  'มาตรา 59 บุคคลจะต้องรับผิดในทางอาญาก็ต่อเมื่อได้กระทำโดยเจตนา ' +
  'เว้นแต่จะได้กระทำโดยประมาท';

const TransportGlyph = ({ stopping }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    {stopping ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <path d="M8 5v14l11-7z" />}
  </svg>
);

// Voice / speed / pitch controls (#8). Reused in the player panel and Settings.
export default function VoiceSettings({ compact = false, showTest = false }) {
  const {
    rate, pitch, voice, setRate, setPitch, setVoice, getVoices,
    audioVoice, setAudioVoice,
    toggleSampleFile, toggleSampleDevice, samplePlayingKind,
  } = useTts();
  const [voices, setVoices] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const vs = await getVoices();
      if (alive) { setVoices(vs); setLoaded(true); }
    };
    load();
    // Web populates voices asynchronously
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => { alive = false; };
  }, [getVoices]);

  const Stepper = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <div className="font-serif text-[13px] text-ink dark:text-paper">{label}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0.5, Math.round((value - 0.1) * 10) / 10))}
          className="w-7 h-7 rounded-full border border-rule-soft dark:border-ink-soft font-ui text-[15px] leading-none flex items-center justify-center text-ink dark:text-paper hover:bg-paper-dk dark:hover:bg-dark-card"
        >−</button>
        <div className="font-ui text-[12px] font-bold tabular-nums w-9 text-center text-ink dark:text-paper">
          {value.toFixed(1)}x
        </div>
        <button
          onClick={() => onChange(Math.min(2.0, Math.round((value + 0.1) * 10) / 10))}
          className="w-7 h-7 rounded-full border border-rule-soft dark:border-ink-soft font-ui text-[15px] leading-none flex items-center justify-center text-ink dark:text-paper hover:bg-paper-dk dark:hover:bg-dark-card"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className={compact ? '' : 'px-1'}>
      {/* First, because it is the voice heard essentially all of the time —
          speed, pitch and the device-voice picker below are things most people
          never touch. Putting it here also does the work of explaining the
          one below it: read in this order, "เสียงสำรองในเครื่อง" is plainly
          the fallback rather than a competing choice.

          Hidden entirely when the feature is off: with no AUDIO_BASE_URL there
          are no files to choose between, and the device voice speaks
          everything regardless of what this said. */}
      {isAudioEnabled() && (
        <div className="py-2">
          {/* Not "เสียงอ่าน": that is the enclosing group's own title, and the
              two stacked read as a heading repeated by mistake. "หลัก" also
              pairs with the "สำรอง" below, which is the distinction this whole
              block exists to draw. */}
          <div className="font-serif text-[13px] text-ink dark:text-paper mb-1.5">เสียงหลัก</div>
          <div className="grid grid-cols-3 gap-2">
            {VOICE_ORDER.map((v) => {
              const on = audioVoice === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAudioVoice(v)}
                  aria-pressed={on}
                  className={`tap-btn hit-44 rounded-lg px-3 py-2 text-left border ${
                    on
                      ? 'border-accent bg-accent/5 text-ink dark:text-paper'
                      : 'border-rule-soft dark:border-ink-soft bg-card dark:bg-dark-card text-ink dark:text-paper'
                  }`}
                >
                  {/* The name in the app's own accent red, selected or not:
                      these are people's names, and reading them as names
                      rather than as button text is what makes the three
                      cards scan as a cast list instead of a settings row. */}
                  <div className={`font-ui text-[12px] text-accent ${on ? 'font-bold' : ''}`}>
                    {VOICE_LABELS[v]?.name ?? v}
                  </div>
                  <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-0.5">
                    {VOICE_LABELS[v]?.note}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Stepper label="ความเร็วเสียง" value={rate} onChange={setRate} />
      <Stepper label="ระดับเสียง (สูง–ต่ำ)" value={pitch} onChange={setPitch} />

      {/* One stable row, always mounted, so opening Settings never swaps this
          block in/out — that swap (empty-state text <-> control) was the
          flicker. Only its label and enabled state change once voices load. */}
      <div className="py-2">
        {/* Renamed from "เสียงพากย์", which was accurate when it was the only
            voice in the app and became misleading the moment it was not. The
            word "สำรอง" states its role before anyone reads the line under
            it — which matters, because a caption at this size is the first
            thing skipped. */}
        <div className="font-serif text-[13px] text-ink dark:text-paper">เสียงสำรองในเครื่อง</div>
        <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mb-1.5 mt-0.5">
          ใช้เมื่อเล่นเสียงหลักไม่ได้
        </div>
        <button
          type="button"
          disabled={voices.length === 0}
          onClick={() => setPickerOpen(true)}
          className="tap-btn hit-44 w-full flex items-center justify-between gap-2 bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[12px] rounded-lg px-3 py-2 border border-rule-soft dark:border-ink-soft text-left disabled:opacity-60"
        >
          <span className="truncate">
            {!loaded ? 'กำลังโหลด…' : voices.length === 0 ? 'ไม่พบเสียงพากย์ในเครื่อง' : (
              voice == null ? AUTO_LABEL : (() => {
                const v = voices.find(x => x.id === voice);
                return v ? `${v.name}${v.lang ? ` · ${v.lang}` : ''}` : AUTO_LABEL;
              })()
            )}
          </span>
          <span className="text-ink-soft dark:text-rule-soft flex-shrink-0">▾</span>
        </button>
        {loaded && voices.length === 0 && (
          <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft pt-1">
            ดู "วิธีตั้งค่าเสียงสำรอง" ด้านล่าง
          </div>
        )}
      </div>

      {pickerOpen && (
        <BottomSheet height="60%" onClose={() => setPickerOpen(false)}>
          <div className="px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft flex-shrink-0">
            <div className="font-display text-[16px] font-medium text-ink dark:text-paper">เลือกเสียงพากย์</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => { setVoice(null); setPickerOpen(false); }}
              className="tap-row w-full text-left flex items-center justify-between gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid var(--rule-hair)' }}
            >
              <span className="font-serif text-[13px] text-ink dark:text-paper">{AUTO_LABEL}</span>
              {voice == null && <span className="text-accent">✓</span>}
            </button>
            {voices.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => { setVoice(v.id); setPickerOpen(false); }}
                className="tap-row w-full text-left flex items-center justify-between gap-3 px-5 py-3"
                style={{ borderBottom: '1px solid var(--rule-hair)' }}
              >
                <span className="font-serif text-[13px] text-ink dark:text-paper">
                  {v.name}{v.lang ? ` · ${v.lang}` : ''}
                </span>
                {voice === v.id && <span className="text-accent">✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {showTest && (
        <div className="mt-1 space-y-2">
          {/* Two buttons so the difference is audible side by side: the premium
              voice needs the network the first time, the device voice never
              does. Only shown when the feature is on; otherwise the single
              device-voice button is all there is to test. */}
          {isAudioEnabled() && (
            <button
              onClick={() => toggleSampleFile(PREMIUM_SECTION_ID, PREMIUM_PARA_INDEX, PREMIUM_TEXT)}
              className="tap-btn w-full flex items-center justify-center gap-2 font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper"
            >
              <TransportGlyph stopping={samplePlayingKind === 'audio'} />
              {samplePlayingKind === 'audio' ? 'หยุด' : 'ทดสอบเสียงหลัก (ใช้เน็ตครั้งแรก)'}
            </button>
          )}
          <button
            onClick={() => toggleSampleDevice(SAMPLE_TEXT)}
            className="tap-btn w-full flex items-center justify-center gap-2 font-ui text-[12px] font-bold py-2.5 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
          >
            <TransportGlyph stopping={samplePlayingKind === 'device'} />
            {samplePlayingKind === 'device' ? 'หยุด' : 'ทดสอบเสียงในเครื่อง'}
          </button>
        </div>
      )}
    </div>
  );
}
