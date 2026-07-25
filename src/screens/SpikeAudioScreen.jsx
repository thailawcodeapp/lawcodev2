// SPIKE ONLY — ไม่ใช่โค้ดจริงของแอป อยู่บน branch spike/background-audio เท่านั้น
//
// รอบ 1: เล่นต่อกัน 3 ไฟล์ตอนจอล็อกได้ ทั้ง HTML5 และ native plugin (ช่องว่าง 0s)
// รอบ 2: พอเว้นช่องว่าง 3 วินาที → track2 เริ่มแต่ currentTime ค้าง 0.0 ไม่เดิน
//
// สรุปกลไก: ตัวที่ตายไม่ใช่ "การสร้าง element ใหม่" แต่คือ **audio session ขาดตอน**
//   ไฟล์ถัดไปเริ่มทันที → session ยัง active ต่อเนื่อง    → เล่นได้
//   เงียบ 3 วินาที      → iOS ปิด session เพราะไม่มีเสียง → แอปเบื้องหลังเปิดใหม่ไม่ได้
//
// รอบ 3 (ไฟล์นี้): ทดสอบวิธีรักษา session ไม่ให้ขาด ทุกวิธีเว้นช่องว่างเท่ากันหมด
//   A  สร้าง element ใหม่ทุกครั้ง   — กลุ่มควบคุม (รู้แล้วว่าพัง)
//   B  ใช้ element เดิม สลับแค่ src — ถูกที่สุดถ้าได้ผล
//   C  เปิดเสียงเงียบวนลูปคลอตลอด   — session ไม่มีวันว่าง
//   D  native plugin               — ให้ native จัดการ session เอง
import { useRef, useState } from 'react';
import { NativeAudio } from '@capgo/native-audio';

const TRACKS = ['track1', 'track2', 'track3'];
const srcOf = (id) => `spike-audio/${id}.wav`;
const GAP_SEC = 3;

export default function SpikeAudioScreen() {
  const [log, setLog] = useState([]);
  const [mode, setMode] = useState(null);
  const t0 = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef(null);
  const audioRef = useRef(null);   // element ที่เล่นไฟล์จริง
  const keepRef = useRef(null);    // element เสียงเงียบของวิธี C

  const say = (msg) => {
    const dt = t0.current ? ((Date.now() - t0.current) / 1000).toFixed(1) : '0.0';
    setLog((l) => [...l, `+${dt}s  ${msg}`]);
  };

  // onplaying ยิงได้ทั้งที่ไม่มีเสียงออกลำโพงจริง จึงต้องดู currentTime ซ้ำ
  const verify = (label, getTime) => {
    setTimeout(() => {
      if (cancelled.current) return;
      const t = getTime();
      say(`   ${label} currentTime=${t.toFixed(1)}s ${t > 0.3 ? '✅ เดินหน้า' : '❌ ไม่เดิน — session ตาย'}`);
    }, 1500);
  };

  const begin = (label) => {
    halt(true);
    cancelled.current = false;
    t0.current = Date.now();
    setMode(label);
    setLog([`▶︎ ${label} · ช่องว่าง ${GAP_SEC} วินาที`, '👉 ปิดจอเดี๋ยวนี้ ระหว่าง track 1 ยังเล่นอยู่']);
  };

  const gapThen = (fn) => {
    if (cancelled.current) return;
    say(`🤫 เงียบ ${GAP_SEC} วินาที (จำลองรอโหลด)...`);
    timer.current = setTimeout(fn, GAP_SEC * 1000);
  };

  // ── A: element ใหม่ทุกครั้ง (กลุ่มควบคุม) ────────────────────────────────
  const runNewElement = () => {
    begin('A · element ใหม่ทุกครั้ง');
    let i = 0;
    const step = () => {
      if (cancelled.current) return;
      if (i >= TRACKS.length) { say('✅ ครบทุกไฟล์'); return; }
      const id = TRACKS[i];
      const a = new Audio(srcOf(id));
      audioRef.current = a;
      a.onplaying = () => { say(`🔊 ${id} เริ่ม`); verify(id, () => a.currentTime); };
      a.onended = () => { say(`⏹️ ${id} จบ`); i += 1; gapThen(step); };
      a.onerror = () => say(`❌ ${id} error=${a.error?.code}`);
      say(`▶️ สั่งเล่น ${id}`);
      a.play().catch((e) => say(`❌ play() ปฏิเสธ: ${e.name}`));
    };
    step();
  };

  // ── B: ใช้ element เดิม สลับแค่ src ─────────────────────────────────────
  const runSameElement = () => {
    begin('B · element เดิม สลับ src');
    const a = new Audio();
    audioRef.current = a;
    let i = 0;
    a.onplaying = () => { say(`🔊 ${TRACKS[i]} เริ่ม`); verify(TRACKS[i], () => a.currentTime); };
    a.onended = () => {
      say(`⏹️ ${TRACKS[i]} จบ`);
      i += 1;
      if (i >= TRACKS.length) { say('✅ ครบทุกไฟล์'); return; }
      gapThen(() => {
        say(`▶️ สลับ src → ${TRACKS[i]}`);
        a.src = srcOf(TRACKS[i]);
        a.play().catch((e) => say(`❌ play() ปฏิเสธ: ${e.name}`));
      });
    };
    a.onerror = () => say(`❌ error=${a.error?.code}`);
    say(`▶️ สั่งเล่น ${TRACKS[0]}`);
    a.src = srcOf(TRACKS[0]);
    a.play().catch((e) => say(`❌ play() ปฏิเสธ: ${e.name}`));
  };

  // ── C: เสียงเงียบวนลูปคลอตลอด กัน session ว่าง ──────────────────────────
  const runKeepAlive = () => {
    begin('C · เสียงเงียบคลอตลอด');
    const k = new Audio('spike-audio/silence.wav');
    k.loop = true;
    k.volume = 0.01; // ไม่ใช้ 0 เพราะ iOS อาจถือว่าเงียบสนิท = ไม่มีเสียง
    keepRef.current = k;
    k.play()
      .then(() => say('🤫 เสียงเงียบเริ่มคลอแล้ว (วนลูป)'))
      .catch((e) => say(`⚠️ เสียงเงียบเริ่มไม่ได้: ${e.name}`));

    let i = 0;
    const step = () => {
      if (cancelled.current) return;
      if (i >= TRACKS.length) { say('✅ ครบทุกไฟล์'); return; }
      const id = TRACKS[i];
      const a = new Audio(srcOf(id));
      audioRef.current = a;
      a.onplaying = () => { say(`🔊 ${id} เริ่ม`); verify(id, () => a.currentTime); };
      a.onended = () => { say(`⏹️ ${id} จบ`); i += 1; gapThen(step); };
      a.onerror = () => say(`❌ ${id} error=${a.error?.code}`);
      say(`▶️ สั่งเล่น ${id}`);
      a.play().catch((e) => say(`❌ play() ปฏิเสธ: ${e.name}`));
    };
    step();
  };

  // ── D: native plugin ────────────────────────────────────────────────────
  const runNative = async () => {
    begin('D · native plugin');
    try {
      await NativeAudio.configure({ background: true, showNotification: true, focus: true });
      for (const id of TRACKS) {
        await NativeAudio.preload({ assetId: id, assetPath: srcOf(id), isUrl: false });
      }
      say('preload ครบ 3 ไฟล์');

      let i = 0;
      await NativeAudio.addListener('complete', () => {
        if (cancelled.current) return;
        say(`⏹️ ${TRACKS[i]} จบ`);
        i += 1;
        if (i >= TRACKS.length) { say('✅ ครบทุกไฟล์'); return; }
        gapThen(async () => {
          const id = TRACKS[i];
          say(`▶️ สั่งเล่น ${id}`);
          try {
            await NativeAudio.play({ assetId: id });
            say(`🔊 ${id} เริ่ม`);
            // plugin ไม่มี currentTime แบบ sync — ถามกลับหลัง 1.5 วิ
            setTimeout(async () => {
              if (cancelled.current) return;
              try {
                const r = await NativeAudio.getCurrentTime({ assetId: id });
                const t = r?.currentTime ?? 0;
                say(`   ${id} currentTime=${Number(t).toFixed(1)}s ${t > 0.3 ? '✅ เดินหน้า' : '❌ ไม่เดิน'}`);
              } catch { say(`   ${id} อ่าน currentTime ไม่ได้`); }
            }, 1500);
          } catch (e) { say(`❌ play() ล้มเหลว: ${e.message}`); }
        });
      });

      say(`▶️ สั่งเล่น ${TRACKS[0]}`);
      await NativeAudio.play({ assetId: TRACKS[0] });
      say(`🔊 ${TRACKS[0]} เริ่ม`);
    } catch (e) {
      say(`❌ ล้มเหลว: ${e.message}`);
    }
  };

  const halt = (quiet = false) => {
    cancelled.current = true;
    clearTimeout(timer.current);
    try { audioRef.current?.pause(); } catch {}
    try { keepRef.current?.pause(); } catch {}
    audioRef.current = null;
    keepRef.current = null;
    for (const id of TRACKS) NativeAudio.stop({ assetId: id }).catch(() => {});
    if (!quiet) say('หยุดแล้ว');
  };

  const Btn = ({ onClick, children, solid }) => (
    <button
      onClick={onClick}
      className={`w-full font-ui text-[12.5px] font-bold py-3 rounded-lg mb-1.5 ${
        solid ? 'bg-accent text-paper' : 'border-2 border-accent text-accent'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          SPIKE รอบ 3 — ไม่ใช่ฟีเจอร์จริง
        </div>
        <div className="font-display text-[24px] leading-none mt-1">กัน audio session ไม่ให้ขาด</div>
        <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft mt-1.5">
          ทุกวิธีเว้นช่องว่าง {GAP_SEC} วินาทีเท่ากัน · กดแล้ว<b>ปิดจอทันที</b>
        </div>
      </div>

      <div className="px-5 py-3 flex-shrink-0">
        <Btn onClick={runNewElement}>A · element ใหม่ (คุมกลุ่ม — คาดว่าพัง)</Btn>
        <Btn onClick={runSameElement} solid>B · element เดิม สลับ src</Btn>
        <Btn onClick={runKeepAlive} solid>C · เสียงเงียบคลอตลอด</Btn>
        <Btn onClick={runNative} solid>D · native plugin</Btn>
        <button
          onClick={() => halt(false)}
          className="w-full font-ui text-[12px] py-2 rounded-lg border border-rule-soft dark:border-ink-soft"
        >
          หยุด
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {mode && <div className="font-ui text-[10px] font-bold text-accent mb-1.5">{mode}</div>}
        <pre className="font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-words">
          {log.join('\n')}
        </pre>
      </div>
    </div>
  );
}
