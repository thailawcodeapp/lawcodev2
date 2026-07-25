// SPIKE ONLY — ไม่ใช่โค้ดจริงของแอป อยู่บน branch spike/background-audio เท่านั้น
//
// รอบ 1 (ผ่านแล้ว): เล่นไฟล์ต่อกัน 3 ไฟล์ตอนจอล็อกได้ ทั้ง HTML5 และ native plugin
//                   → เลือก HTML5 และปุ่มควบคุมบนหน้าล็อกขึ้นให้เอง
//
// รอบ 2 (ไฟล์นี้): รอบแรกใช้ไฟล์ที่ฝังมากับแอป จึงเล่นต่อทันทีไม่มีช่วงเงียบ
//   ของจริงต้องโหลดไฟล์จาก R2 ก่อน = มีช่วงเงียบคั่น ถ้าเงียบนานพอ iOS จะ
//   suspend แอปแล้วเสียงตายกลางคัน — ซึ่งจะเกิดกับผู้ใช้เน็ตช้าเป็นประจำ
//
// คำถามที่ต้องตอบ: เงียบได้นานสุดกี่วินาทีก่อนเสียงตาย
//   ตัวเลขนั้นคือ budget ที่ระบบโหลดล่วงหน้าต้องทำให้ได้
//
// วิธีทดสอบ: เลือกช่องว่าง → กดเริ่ม → ปิดจอ → ฟังว่าครบ 3 ไฟล์ไหม
import { useRef, useState } from 'react';

const TRACKS = ['track1', 'track2', 'track3'];
const srcOf = (id) => `spike-audio/${id}.wav`;
const GAPS = [0, 3, 10, 30];

export default function SpikeAudioScreen() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const t0 = useRef(0);
  const audioRef = useRef(null);
  const cancelled = useRef(false);
  const timer = useRef(null);

  const say = (msg) => {
    const dt = t0.current ? ((Date.now() - t0.current) / 1000).toFixed(1) : '0.0';
    setLog((l) => [...l, `+${dt}s  ${msg}`]);
  };

  // เล่น 3 ไฟล์ โดยเว้นช่วงเงียบ gapSec วินาทีระหว่างไฟล์ (จำลองเวลารอโหลด)
  const run = (gapSec, loopMinutes = 0) => {
    halt(true);
    cancelled.current = false;
    t0.current = Date.now();
    setRunning(true);
    const until = loopMinutes ? Date.now() + loopMinutes * 60000 : 0;
    setLog([
      `▶︎ ช่องว่างระหว่างไฟล์ ${gapSec} วินาที${loopMinutes ? ` · วนยาว ${loopMinutes} นาที` : ''}`,
      '👉 ปิดจอเดี๋ยวนี้ ระหว่าง track 1 ยังเล่นอยู่',
    ]);

    let i = 0;
    const step = () => {
      if (cancelled.current) return;
      if (i >= TRACKS.length) {
        if (until && Date.now() < until) {
          i = 0;
          say(`🔁 วนรอบใหม่ (เหลือ ${Math.round((until - Date.now()) / 60000)} นาที)`);
        } else {
          say('✅ จบครบทุกไฟล์ — เสียงไม่ตาย');
          setRunning(false);
          return;
        }
      }
      const id = TRACKS[i];
      const a = new Audio(srcOf(id));
      audioRef.current = a;

      // onplaying ยิงเมื่อเริ่มเล่น แต่ยิงได้ทั้งที่ไม่มีเสียงออกลำโพงจริง
      // จึงเช็ค currentTime ซ้ำอีก 1.5 วิ ว่าเดินหน้าจริงไหม
      a.onplaying = () => {
        say(`🔊 ${id} เริ่มเล่น`);
        setTimeout(() => {
          if (!cancelled.current && audioRef.current === a) {
            const t = a.currentTime;
            say(`   ${id} currentTime=${t.toFixed(1)}s ${t > 0.3 ? '(เดินหน้าปกติ)' : '⚠️ ไม่เดิน'}`);
          }
        }, 1500);
      };
      a.onended = () => {
        say(`⏹️ ${id} จบ`);
        i += 1;
        if (gapSec > 0 && !cancelled.current) {
          say(`🤫 เงียบ ${gapSec} วินาที (จำลองรอโหลด)...`);
          timer.current = setTimeout(step, gapSec * 1000);
        } else {
          step();
        }
      };
      a.onerror = () => say(`❌ ${id} error code=${a.error?.code}`);

      say(`▶️ สั่งเล่น ${id}`);
      a.play()
        .then(() => say('   play() ผ่าน'))
        .catch((e) => {
          say(`❌ play() ถูกปฏิเสธ: ${e.name} — ${e.message}`);
          say('🛑 น่าจะโดน iOS suspend ไปแล้ว');
          setRunning(false);
        });
    };
    step();
  };

  const halt = (quiet = false) => {
    cancelled.current = true;
    clearTimeout(timer.current);
    try { audioRef.current?.pause(); } catch {}
    audioRef.current = null;
    setRunning(false);
    if (!quiet) say('หยุดแล้ว');
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          SPIKE รอบ 2 — ไม่ใช่ฟีเจอร์จริง
        </div>
        <div className="font-display text-[24px] leading-none mt-1">ช่วงเงียบนานแค่ไหนถึงตาย</div>
        <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft mt-1.5">
          จำลองเวลารอโหลดไฟล์ · เลือกช่องว่างแล้ว<b>ปิดจอทันที</b>
        </div>
      </div>

      <div className="px-5 py-3 flex-shrink-0">
        <div className="font-ui text-[10px] font-bold text-ink-soft dark:text-rule-soft mb-1.5">
          ช่องว่างระหว่างไฟล์
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {GAPS.map((g) => (
            <button
              key={g}
              onClick={() => run(g)}
              className="font-ui text-[13px] font-bold py-3 rounded-lg bg-accent text-paper"
            >
              {g}s
            </button>
          ))}
        </div>
        <button
          onClick={() => run(3, 10)}
          className="w-full font-ui text-[12px] font-bold py-2.5 rounded-lg border-2 border-accent text-accent mb-1.5"
        >
          ทดสอบยาว 10 นาที (ช่องว่าง 3s)
        </button>
        <button
          onClick={() => halt(false)}
          className="w-full font-ui text-[12px] py-2 rounded-lg border border-rule-soft dark:border-ink-soft"
        >
          หยุด
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="font-ui text-[10px] font-bold text-accent mb-1.5">
          {running ? '● กำลังทดสอบ' : '○ ว่าง'}
        </div>
        <pre className="font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-words">
          {log.join('\n')}
        </pre>
      </div>
    </div>
  );
}
