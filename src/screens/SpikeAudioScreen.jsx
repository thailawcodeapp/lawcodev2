// SPIKE ONLY — ไม่ใช่โค้ดจริงของแอป อยู่บน branch spike/background-audio เท่านั้น
//
// รอบ 1-3 (จบแล้ว): เรื่อง background audio ได้ข้อสรุปว่าใช้ @capgo/native-audio
//
// รอบ 4 (ไฟล์นี้): ทดสอบสมมติฐานข้อสุดท้ายของเฟส 1 —
//   "แปลงช่องว่างในตัวบทเป็นจุลภาคก่อนส่งเข้า TTS จะทำให้เว้นวรรคดีขึ้นจริงไหม"
//
// สิ่งที่ต้องพิสูจน์มี 2 อย่าง ไม่ใช่อย่างเดียว:
//   1. เสียงดีขึ้นจริงไหม — ฟังด้วยหู
//   2. ข้อความไม่ถูกทำให้เพี้ยน — ดูด้วยตา จึงแสดงข้อความเต็มทั้งสามแบบ
//      พร้อมนับ "อักษรจริง" (ตัดช่องว่างและจุลภาคออก) เทียบกับต้นฉบับ
//      ถ้าตัวเลขตรงกัน แปลว่าไม่มีคำไหนหาย เปลี่ยน หรือสลับที่
//
// ตัวบทโหลดสดจาก /data/*.json ด้วย fetch — อ่านอย่างเดียว ไม่มีการเขียนกลับ
import { useEffect, useState } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// ── กฎที่จะทดสอบ (สำเนาไว้ใน spike ยังไม่ใส่ลง src/lib จริง) ────────────────
//
// ruleSlash ใช้ whitelist ไม่ใช่ blacklist: แปลงเฉพาะบริบทที่รู้แน่ว่าเป็นเลขมาตรา
// เพราะการไล่ยกเว้นทีละเคสเดาไม่มีวันครบ ตรวจกับตัวบททั้งหมดแล้วได้ 435 จุดที่เป็น
// เลขมาตราจริง และข้าม 1 จุดที่เป็นเศษส่วนจริง (ม.968 "ร้อยละ 1/6" = อัตราส่วนลด
// ตั๋วเงิน ซึ่ง TTS อ่าน "เศษหนึ่งส่วนหก" อยู่แล้วและตรงความหมาย)
// ฝั่งซ้ายรับคำต่อท้ายไทยด้วย เพราะมี "มาตรา 172 ทวิ/1" ที่ regex เลขล้วนจับไม่ได้
const SLASH_RE = /(\d+(?:\s*[฀-๿]+)?)\/(\d+)/g;
const ruleSlash = (t) =>
  t.replace(SLASH_RE, (full, a, b, off, str) => {
    const inParen = str[off - 1] === '(' && str[off + full.length] === ')';
    const afterMaatra = /มาตรา[\s฀-๿]{0,8}$/.test(str.slice(Math.max(0, off - 20), off));
    return inParen || afterMaatra ? `${a} ทับ ${b}` : full;
  });

// ruleComma ต้องเก็บกวาดสองจุดที่การแทนช่องว่างทื่อ ๆ ทำพัง:
//   "มาตรา 420"  → "มาตรา, 420"   ทำให้อ่านสะดุดกลางชื่อมาตรา
//   "193 ทับ 30" → "193, ทับ, 30" เพราะ ruleSlash ใส่ช่องว่างรอบ "ทับ" ไว้ก่อนหน้า
const ruleComma = (t) =>
  t
    .replace(/[  ]+/g, ', ')
    .replace(/(,\s*){2,}/g, ', ')
    .replace(/มาตรา,\s*/g, 'มาตรา ')
    .replace(/,?\s*ทับ,?\s*/g, ' ทับ ');

const VARIANTS = [
  { key: 'raw',   label: '1 · ดิบ (ตัวบทเดิม)', fn: (t) => t },
  { key: 'slash', label: '2 · + ทับ',           fn: (t) => ruleSlash(t) },
  { key: 'both',  label: '3 · + ทับ + จุลภาค',   fn: (t) => ruleComma(ruleSlash(t)) },
];

const SAMPLES = [
  { book: 'civil-th',    num: '420',    note: '9 ช่องว่าง — เคสหนักสุด' },
  { book: 'civil-th',    num: '193/30', note: 'มีเลข /' },
  { book: 'criminal-th', num: '288',    note: 'อาญา' },
];

// นับเฉพาะอักษรจริง ตัดช่องว่างและจุลภาคออก — ใช้พิสูจน์ว่าเนื้อหาไม่เปลี่ยน
const letters = (t) => t.replace(/[\s,]/g, '');

export default function SpikeAudioScreen() {
  const [texts, setTexts] = useState({});
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const out = {};
        for (const s of SAMPLES) {
          const r = await fetch(`/data/${s.book}.json`);
          const j = await r.json();
          const found = (j.sections || []).find((x) => String(x.number) === s.num);
          out[s.num] = found ? (found.text || '').split(/\n+/)[0].trim() : '(ไม่พบมาตรานี้)';
        }
        setTexts(out);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  const cur = SAMPLES[sel];
  const raw = texts[cur.num] || '';

  const speak = async (fn) => {
    try {
      await TextToSpeech.stop();
      await TextToSpeech.speak({
        text: fn(raw), lang: 'th-TH', rate: 1.0, pitch: 1.0, category: 'playback',
      });
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          SPIKE รอบ 4 — ไม่ใช่ฟีเจอร์จริง
        </div>
        <div className="font-display text-[24px] leading-none mt-1">จุลภาคช่วยจริงไหม</div>
        <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft mt-1.5">
          ฟังเทียบ 3 แบบจากตัวบทจริง · ข้อความโหลดสดจากไฟล์ ไม่มีการเขียนกลับ
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {err && <div className="font-mono text-[11px] text-accent mb-2">error: {err}</div>}

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {SAMPLES.map((s, i) => (
            <button
              key={s.num}
              onClick={() => setSel(i)}
              className={`font-ui text-[12px] font-bold py-2.5 rounded-lg ${
                i === sel ? 'bg-accent text-paper' : 'border border-rule-soft dark:border-ink-soft'
              }`}
            >
              ม.{s.num}
            </button>
          ))}
        </div>
        <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mb-3">{cur.note}</div>

        {VARIANTS.map((v) => {
          const out = v.fn(raw);
          const same = letters(out) === letters(raw);
          return (
            <div key={v.key} className="mb-3 border border-rule dark:border-ink-soft rounded-lg p-3">
              <button
                onClick={() => speak(v.fn)}
                className="w-full font-ui text-[12.5px] font-bold py-2.5 rounded-lg bg-accent text-paper mb-2"
              >
                ▶︎ {v.label}
              </button>
              <div className="font-serif text-[12px] leading-[1.75] break-words">{out}</div>
              <div className="font-ui text-[10px] mt-2 flex justify-between gap-2">
                <span className="text-ink-soft dark:text-rule-soft">
                  จุลภาค {(out.match(/,/g) || []).length} · อักษรจริง {letters(out).length}
                </span>
                <span style={{ color: same ? '#2d8c4a' : '#a93225', fontWeight: 700 }}>
                  {same ? '✓ เนื้อหาตรงต้นฉบับ' : '✗ เนื้อหาเปลี่ยน!'}
                </span>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => TextToSpeech.stop().catch(() => {})}
          className="w-full font-ui text-[12px] py-2 rounded-lg border border-rule-soft dark:border-ink-soft mb-6"
        >
          หยุด
        </button>
      </div>
    </div>
  );
}
