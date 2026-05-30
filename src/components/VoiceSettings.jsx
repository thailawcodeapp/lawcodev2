import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';

// Voice / speed / pitch controls (#8). Reused in the player panel and Settings.
export default function VoiceSettings({ compact = false }) {
  const { rate, pitch, voice, setRate, setPitch, setVoice, getVoices } = useTts();
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const vs = await getVoices();
      if (alive) setVoices(vs);
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
      <Stepper label="ความเร็วเสียง" value={rate} onChange={setRate} />
      <Stepper label="ระดับเสียง (สูง–ต่ำ)" value={pitch} onChange={setPitch} />

      {voices.length > 0 && (
        <div className="py-2">
          <div className="font-serif text-[13px] text-ink dark:text-paper mb-1.5">เสียงพากย์</div>
          <select
            value={voice ?? ''}
            onChange={e => setVoice(e.target.value === '' ? null : e.target.value)}
            className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[12px] rounded-lg px-3 py-2 outline-none border border-rule-soft dark:border-ink-soft"
          >
            <option value="">อัตโนมัติ (ค่าเริ่มต้นระบบ)</option>
            {voices.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}{v.lang ? ` · ${v.lang}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {voices.length === 0 && (
        <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft py-1">
          ไม่พบเสียงพากย์ในเครื่อง — ดู "วิธีตั้งค่าเสียงอ่าน" ด้านล่าง
        </div>
      )}
    </div>
  );
}
