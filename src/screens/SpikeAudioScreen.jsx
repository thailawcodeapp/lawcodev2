// SPIKE ONLY — ไม่ใช่โค้ดจริงของแอป อยู่บน branch spike/background-audio เท่านั้น
//
// พิสูจน์ความเสี่ยง R2 ของ docs/superpowers/specs/2026-07-25-ios-tts-quality-design.md:
// "เล่นไฟล์เสียงต่อเนื่องหลายไฟล์ตอนปิดจอ iPhone ได้หรือไม่"
//
// Apple Developer Forums รายงานว่า HTML5 <audio> ใน WKWebView เริ่มไฟล์ใหม่
// ตอนจอล็อกไม่ได้ ทดสอบ 2 วิธีเทียบกันเพื่อยืนยันบน iOS เวอร์ชันปัจจุบัน:
//   A = HTML5 Audio (วิธีที่ spec เดิมเสนอ)
//   B = @capgo/native-audio (native AVAudioPlayer, ทางแก้ที่เสนอ)
//
// วิธีทดสอบ: กดเริ่ม → ปิดจอทันทีระหว่าง track 1 → ฟังว่า track 2/3 ดังไหม
// → เปิดจอกลับมาอ่าน log ว่าเกิดอะไรขึ้นบ้าง
import { useEffect, useRef, useState } from 'react';
import { NativeAudio } from '@capgo/native-audio';

const TRACKS = ['track1', 'track2', 'track3'];
const srcOf = (id) => `spike-audio/${id}.wav`;

export default function SpikeAudioScreen() {
  const [log, setLog] = useState([]);
  const [mode, setMode] = useState(null);
  const t0 = useRef(0);
  const htmlAudio = useRef(null);
  const idx = useRef(0);
  const cancelled = useRef(false);

  const say = (msg) => {
    const dt = t0.current ? ((Date.now() - t0.current) / 1000).toFixed(1) : '0.0';
    setLog((l) => [...l, `+${dt}s  ${msg}`]);
  };

  useEffect(() => () => { cancelled.current = true; }, []);

  // ── A: HTML5 Audio ────────────────────────────────────────────────────────
  const runHtml5 = async () => {
    reset('A · HTML5 Audio');
    const playAt = (i) => {
      if (cancelled.current || i >= TRACKS.length) {
        if (i >= TRACKS.length) say('✅ จบครบ 3 ไฟล์');
        return;
      }
      say(`▶️ สั่งเล่น ${TRACKS[i]}`);
      const a = new Audio(srcOf(TRACKS[i]));
      htmlAudio.current = a;
      a.onplaying = () => say(`🔊 ${TRACKS[i]} เริ่มดังจริง`);
      a.onended = () => { say(`⏹️ ${TRACKS[i]} จบ`); playAt(i + 1); };
      a.onerror = () => say(`❌ ${TRACKS[i]} error: ${a.error?.code}`);
      a.play()
        .then(() => say(`   play() ผ่าน`))
        .catch((e) => say(`❌ play() ถูกปฏิเสธ: ${e.name}`));
    };
    playAt(0);
  };

  // ── B: native plugin ──────────────────────────────────────────────────────
  const runNative = async () => {
    reset('B · @capgo/native-audio');
    try {
      await NativeAudio.configure({
        background: true,      // เล่นต่อเมื่อแอปอยู่เบื้องหลัง
        showNotification: true, // Now Playing บนหน้าล็อก
        focus: true,
      });
      say('configure() ผ่าน (background + notification)');

      for (const id of TRACKS) {
        await NativeAudio.preload({
          assetId: id,
          assetPath: srcOf(id),
          isUrl: false,
        });
      }
      say('preload ครบ 3 ไฟล์');

      idx.current = 0;
      await NativeAudio.addListener('complete', ({ assetId }) => {
        say(`⏹️ ${assetId} จบ`);
        idx.current += 1;
        if (idx.current >= TRACKS.length) { say('✅ จบครบ 3 ไฟล์'); return; }
        const next = TRACKS[idx.current];
        say(`▶️ สั่งเล่น ${next}`);
        NativeAudio.play({ assetId: next })
          .then(() => say(`   play() ผ่าน`))
          .catch((e) => say(`❌ play() ล้มเหลว: ${e.message}`));
      });

      say(`▶️ สั่งเล่น ${TRACKS[0]}`);
      await NativeAudio.play({ assetId: TRACKS[0] });
      say('   play() ผ่าน');
    } catch (e) {
      say(`❌ ล้มเหลว: ${e.message}`);
    }
  };

  const reset = (label) => {
    cancelled.current = false;
    t0.current = Date.now();
    setMode(label);
    setLog([`เริ่มทดสอบ ${label}`, '👉 ปิดจอเดี๋ยวนี้ ระหว่าง track 1 ยังเล่นอยู่']);
  };

  const stopAll = async () => {
    cancelled.current = true;
    try { htmlAudio.current?.pause(); } catch {}
    for (const id of TRACKS) { try { await NativeAudio.stop({ assetId: id }); } catch {} }
    say('หยุดทั้งหมดแล้ว');
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          SPIKE — ไม่ใช่ฟีเจอร์จริง
        </div>
        <div className="font-display text-[26px] leading-none mt-1">ทดสอบเสียงตอนปิดจอ</div>
        <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft mt-1.5">
          กดปุ่มแล้ว<b>ปิดจอทันที</b> · ต้องได้ยิน track 2 และ 3 ต่อเนื่อง
        </div>
      </div>

      <div className="px-5 py-3 flex flex-col gap-2 flex-shrink-0">
        <button onClick={runHtml5}
          className="w-full font-ui text-[13px] font-bold py-3 rounded-lg border-2 border-accent text-accent">
          A · ทดสอบ HTML5 Audio
        </button>
        <button onClick={runNative}
          className="w-full font-ui text-[13px] font-bold py-3 rounded-lg bg-accent text-paper">
          B · ทดสอบ Native Plugin
        </button>
        <button onClick={stopAll}
          className="w-full font-ui text-[12px] py-2 rounded-lg border border-rule-soft dark:border-ink-soft">
          หยุด / ล้าง
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {mode && (
          <div className="font-ui text-[10px] font-bold text-accent mb-1.5 tracking-wide">{mode}</div>
        )}
        <pre className="font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-words">
          {log.join('\n')}
        </pre>
      </div>
    </div>
  );
}
