// SPIKE ONLY — ไม่ใช่โค้ดจริงของแอป อยู่บน branch spike/background-audio เท่านั้น
//
// รอบ 1-4 (จบแล้ว): เลือก @capgo/native-audio, ยืนยันเล่นตอนปิดจอได้, กฎ "ทับ",
//   ตัดกฎจุลภาค — ทั้งหมดปิดไปแล้วและ merge ลง cloud-sync เป็นเฟส 1
//
// รอบ 5 (ไฟล์นี้): เกตของเฟส 3 — ปิด 2 ความเสี่ยงสุดท้ายก่อนลงทุน render 6,770 ไฟล์
//   A. เล่นต่อเนื่องหลายสิบนาที (spike ก่อนหน้ายาวสุด ~40 วินาที)
//   B. session handoff — สลับ native-audio ↔ TTS กลางเพลย์ลิสต์ โดยไม่แย่ง
//      audio session กัน (ตอนถอยไป fallback เมื่อไฟล์เสียงหาย)
//
// ใช้ไฟล์ Gacrux (Chirp3-HD) จริงจาก pilot 10 ไฟล์ = เพลย์ลิสต์ ~7 นาที/รอบ
// ยังยืนยัน MP3 ว่าเล่นได้ด้วย (เฟส 3 จะ render เป็น MP3) — ปิด 3 เรื่องด้วยหินก้อนเดียว
import { useRef, useState } from 'react';
import { NativeAudio } from '@capgo/native-audio';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const TRACKS = Array.from({ length: 10 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
const srcOf = (id) => `spike-audio/${id}.mp3`;

export default function SpikeAudioScreen() {
  const [log, setLog] = useState([]);
  const [mode, setMode] = useState(null);
  const t0 = useRef(0);
  const cancelled = useRef(false);
  const idx = useRef(0);
  const listener = useRef(null);
  const preloaded = useRef(false);
  const heartbeat = useRef(null);

  const say = (msg) => {
    const dt = t0.current ? ((Date.now() - t0.current) / 1000).toFixed(0) : '0';
    setLog((l) => [...l, `+${dt}s  ${msg}`]);
  };

  async function ensurePreloaded() {
    await NativeAudio.configure({ background: true, showNotification: true, focus: true });
    if (preloaded.current) return;
    for (const id of TRACKS) {
      await NativeAudio.preload({ assetId: id, assetPath: srcOf(id), isUrl: false });
    }
    preloaded.current = true;
  }

  const begin = (label) => {
    stopAll(true);
    cancelled.current = false;
    t0.current = Date.now();
    idx.current = 0;
    setMode(label);
    setLog([`▶︎ ${label}`, '👉 ปิดจอ iPhone แล้วฟังยาว ๆ — กลับมาอ่าน log ทีหลัง']);
  };

  // ── A: เล่นต่อเนื่องยาว วนจนครบ targetMin นาที ────────────────────────────
  const runLong = async (targetMin) => {
    begin(`A · เล่นยาว ${targetMin} นาที (วน)`);
    try {
      await ensurePreloaded();
      say(`preload ครบ ${TRACKS.length} ไฟล์`);
      const until = Date.now() + targetMin * 60000;

      listener.current = await NativeAudio.addListener('complete', async ({ assetId }) => {
        if (cancelled.current) return;
        say(`⏹️ ${assetId} จบ`);
        idx.current += 1;
        if (idx.current >= TRACKS.length) {
          idx.current = 0;
          if (Date.now() >= until) { say(`✅ ครบ ${targetMin} นาที — เสียงไม่ตาย`); stopAll(false); return; }
          say(`🔁 วนรอบใหม่ (เหลือ ${Math.ceil((until - Date.now()) / 60000)} นาที)`);
        }
        playCurrent();
      });

      // heartbeat ทุก 30 วิ: อ่าน currentTime ของแทร็กที่กำลังเล่น
      // ถ้าเลขไม่เดินแต่ยังไม่ถึง complete = session ตายเงียบ ๆ
      heartbeat.current = setInterval(async () => {
        if (cancelled.current) return;
        try {
          const id = TRACKS[idx.current];
          const { currentTime } = await NativeAudio.getCurrentTime({ assetId: id });
          say(`   ♥ ${id} t=${Number(currentTime).toFixed(1)}s`);
        } catch { say('   ♥ อ่าน currentTime ไม่ได้'); }
      }, 30000);

      playCurrent();
    } catch (e) { say(`❌ ${e.message}`); }
  };

  const playCurrent = () => {
    const id = TRACKS[idx.current];
    say(`▶️ ${id}`);
    NativeAudio.play({ assetId: id }).catch((e) => {
      say(`❌ play(${id}) ล้มเหลว: ${e.message} — session อาจตาย`);
      stopAll(false);
    });
  };

  // ── B: session handoff — native → TTS → native → TTS → native ────────────
  // จำลองการถอยไป fallback: เล่นไฟล์เสียง แล้วแทรกด้วย TTS (เหมือนไฟล์หาย)
  // แล้วกลับมาเล่นไฟล์ต่อ ต้องได้ยินเสียงครบทุกช่วง ไม่มีใครแย่ง session ใคร
  const runHandoff = async () => {
    begin('B · สลับ native ↔ TTS');
    try {
      await ensurePreloaded();
      say('เริ่ม: native → TTS → native → TTS → native');

      const speakTts = async (n) => {
        if (cancelled.current) return;
        say(`🗣️ TTS #${n} (fallback จำลอง)`);
        try {
          await TextToSpeech.speak({
            text: `นี่คือเสียงสังเคราะห์ในเครื่อง ลำดับที่ ${n} ทดสอบการสลับกับไฟล์เสียง`,
            lang: 'th-TH', rate: 1.0, pitch: 1.0, category: 'playback',
          });
          say(`   TTS #${n} จบ`);
        } catch (e) { say(`❌ TTS #${n}: ${e.message}`); }
      };

      const playNative = (id) => new Promise((resolve) => {
        say(`▶️ native ${id}`);
        let done = false;
        NativeAudio.addListener('complete', ({ assetId }) => {
          if (assetId === id && !done) { done = true; say(`⏹️ native ${id} จบ`); resolve(); }
        }).then((h) => { listener.current = h; });
        NativeAudio.play({ assetId: id }).catch((e) => { say(`❌ native ${id}: ${e.message}`); resolve(); });
        // กันค้าง: p05 สั้น ถ้าเกิน 40 วิยังไม่ complete ถือว่าเงียบ
        setTimeout(() => { if (!done) { done = true; say(`⚠️ native ${id} ไม่ complete ใน 40s — น่าจะเงียบ`); resolve(); } }, 40000);
      });

      await playNative('p05'); if (cancelled.current) return;
      await speakTts(1);       if (cancelled.current) return;
      await playNative('p06'); if (cancelled.current) return;
      await speakTts(2);       if (cancelled.current) return;
      await playNative('p07'); if (cancelled.current) return;
      say('✅ จบครบ — ฟังว่าได้ยินเสียงทุกช่วงไหม (ทั้งไฟล์และ TTS)');
    } catch (e) { say(`❌ ${e.message}`); }
  };

  const stopAll = (quiet = false) => {
    cancelled.current = true;
    clearInterval(heartbeat.current);
    try { listener.current?.remove?.(); } catch {}
    listener.current = null;
    for (const id of TRACKS) NativeAudio.stop({ assetId: id }).catch(() => {});
    TextToSpeech.stop().catch(() => {});
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
          SPIKE รอบ 5 — เกตเฟส 3
        </div>
        <div className="font-display text-[23px] leading-none mt-1">เล่นยาว + สลับ TTS</div>
        <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft mt-1.5">
          ไฟล์ Gacrux จริง 10 ไฟล์ · กดแล้ว<b>ปิดจอฟังยาว ๆ</b>
        </div>
      </div>

      <div className="px-5 py-3 flex-shrink-0">
        <Btn onClick={() => runLong(15)} solid>A · เล่นยาว 15 นาที (วน)</Btn>
        <Btn onClick={() => runLong(2)}>A′ · เล่นสั้น 2 นาที (ลองก่อน)</Btn>
        <Btn onClick={runHandoff} solid>B · สลับ native ↔ TTS</Btn>
        <button
          onClick={() => stopAll(false)}
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
