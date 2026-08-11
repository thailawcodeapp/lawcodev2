import { useState } from 'react';
import {
  audioIssues, clearAudioIssues, formatAudioIssues,
  heartbeats, clearHeartbeats, formatHeartbeats,
  timerHeartbeats, clearTimerHeartbeats, formatTimerHeartbeats,
} from '../lib/audioLog';

// Shows why paragraphs fell back to the device voice, and — separately — two
// independent kinds of proof for whether the JavaScript driving playback was
// still running when the audio stopped.
//
// All three exist because the failures they diagnose happen with the screen
// off, on a phone, away from a computer. Reading them over `adb logcat` means
// USB debugging, a cable and sitting at a desk while trying to reproduce
// something that needs the screen off for a while; reading them here means
// unlocking the phone afterwards. The console.warn in audioLog.js keeps the
// logcat route open for anyone who prefers it.
//
// The two heartbeats are the load-bearing pair now. A foreground service and
// a wake lock were built on the theory that Android was cutting the process
// off from the network or letting the CPU sleep; a near-silent looping tone
// was tried on the theory that the WebView itself was being throttled for
// looking silent. None of the three changed WHEN playback stopped — a device
// test then found the actual shape of the failure: a fixed ~60 seconds after
// LEAVING the app, screen off or not, regardless of how many paragraphs that
// covered. A fixed wall-clock point, not a fixed amount of work, rules out
// every one of those three theories at once.
//
// The per-paragraph heartbeat (below, "ลูปเล่นเสียง") cannot tell two very
// different failures apart: the JS engine itself stopping, and the loop being
// stuck awaiting a promise that never settles. Both look identical to it —
// no new paragraph pulse either way. The timer heartbeat ("ตัวจับเวลา"), a
// plain setInterval owing nothing to the loop, is what tells them apart: if
// it keeps landing every ~5 seconds right through the silence, the engine was
// never the problem — something specific down in the native audio pipeline
// is. If it stops at the same moment the loop's own pulses do, the engine
// itself stopped, and the fix has to be architectural, not a promise fix.
//
// Hidden entirely when all three are empty — which for almost everyone is
// always. This is not a feature, it is an instrument, and an instrument
// reading zero should not take up a row.
export default function AudioIssueLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(() => audioIssues());
  const [pulses, setPulses] = useState(() => heartbeats());
  const [timerPulses, setTimerPulses] = useState(() => timerHeartbeats());
  // Which block's button last said "copied" — the lists are copied
  // independently, so one shared boolean would light up the wrong button.
  const [copied, setCopied] = useState(null);

  if (!entries.length && !pulses.length && !timerPulses.length) return null;

  const copy = async (kind, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // A WebView that refuses clipboard access is not a dead end: the text is
      // on screen below and can be selected by hand. Saying so beats a button
      // that silently does nothing.
      setCopied(null);
      setOpen(true);
    }
  };

  const lastPulse = pulses[0];
  const lastTimerPulse = timerPulses[0];

  return (
    <div style={{ borderTop: '1px dotted var(--rule-hair)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="tap-row w-full flex items-center justify-between py-2.5 pl-4"
      >
        <span className="font-serif text-[14px] text-ink dark:text-paper">
          บันทึกปัญหาเสียง{entries.length ? ` (${entries.length})` : ''}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div className="pl-4 pr-1 pb-3">
          {(pulses.length > 0 || timerPulses.length > 0) && (
            <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft leading-relaxed mb-3">
              เทียบเวลาล่าสุดของสองตัวนี้ตอนเสียงเงียบ:
              <br />
              ถ้า <span className="font-semibold text-ink dark:text-paper">ตัวจับเวลา</span> ยังเดินต่อหลังเสียงเงียบ
              แต่ <span className="font-semibold text-ink dark:text-paper">ลูปเล่นเสียง</span> หยุดก่อน
              — แปลว่าแอปยังทำงานอยู่ แต่เครื่องเล่นเสียงติดค้าง
              <br />
              ถ้าทั้งสองหยุดพร้อมกัน — แปลว่าตัวแอปเองหยุดทำงานไปเลย
            </div>
          )}

          {timerPulses.length > 0 && (
            <div className="mb-4">
              <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft leading-relaxed mb-2">
                ตัวจับเวลา (ทุก 5 วิ) ล่าสุด:{' '}
                <span className="font-semibold text-ink dark:text-paper">
                  {new Date(lastTimerPulse.at).toLocaleString('th-TH')}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => copy('timer', formatTimerHeartbeats(timerPulses))}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
                >
                  {copied === 'timer' ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                </button>
                <button
                  onClick={() => { clearTimerHeartbeats(); setTimerPulses([]); }}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-accent"
                >
                  ล้าง
                </button>
              </div>
              <pre
                className="font-ui text-[10px] leading-relaxed text-ink dark:text-paper bg-card dark:bg-dark-card rounded-lg p-2 overflow-x-auto"
                style={{ userSelect: 'text', maxHeight: 140, overflowY: 'auto' }}
              >
                {formatTimerHeartbeats(timerPulses)}
              </pre>
            </div>
          )}

          {pulses.length > 0 && (
            <div className="mb-4">
              <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft leading-relaxed mb-2">
                ลูปเล่นเสียง (ต่อย่อหน้า) ล่าสุด:{' '}
                <span className="font-semibold text-ink dark:text-paper">
                  {new Date(lastPulse.at).toLocaleString('th-TH')}
                </span>
                {lastPulse.sectionId && ` (${lastPulse.sectionId}¶${lastPulse.paraIndex ?? '?'})`}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => copy('heartbeat', formatHeartbeats(pulses))}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
                >
                  {copied === 'heartbeat' ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                </button>
                <button
                  onClick={() => { clearHeartbeats(); setPulses([]); }}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-accent"
                >
                  ล้าง
                </button>
              </div>
              <pre
                className="font-ui text-[10px] leading-relaxed text-ink dark:text-paper bg-card dark:bg-dark-card rounded-lg p-2 overflow-x-auto"
                style={{ userSelect: 'text', maxHeight: 180, overflowY: 'auto' }}
              >
                {formatHeartbeats(pulses)}
              </pre>
            </div>
          )}

          {entries.length > 0 && (
            <div>
              <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft leading-relaxed mb-2">
                ย่อหน้าที่เล่นเสียงหลักไม่ได้ และเปลี่ยนไปใช้เสียงในเครื่องแทน
                <br />
                <span className="opacity-80">
                  visible=false คือตอนนั้นแอปไม่ได้อยู่บนหน้าจอ · online=true คือ WebView มองว่ายังต่อเน็ตอยู่
                </span>
              </div>

              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => copy('issues', formatAudioIssues(entries))}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
                >
                  {copied === 'issues' ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                </button>
                <button
                  onClick={() => { clearAudioIssues(); setEntries([]); }}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-accent"
                >
                  ล้าง
                </button>
              </div>

              {/* Selectable, and scrollable in its own box: the lines are long
                  and the page must not scroll sideways because of them. */}
              <pre
                className="font-ui text-[10px] leading-relaxed text-ink dark:text-paper bg-card dark:bg-dark-card rounded-lg p-2 overflow-x-auto"
                style={{ userSelect: 'text', maxHeight: 260, overflowY: 'auto' }}
              >
                {formatAudioIssues(entries)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
