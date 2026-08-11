import { useState } from 'react';
import { audioIssues, clearAudioIssues, formatAudioIssues } from '../lib/audioLog';

// Shows why paragraphs fell back to the device voice.
//
// It exists because the failure it diagnoses happens with the screen off, on
// a phone, away from a computer. Reading it over `adb logcat` means USB
// debugging, a cable and sitting at a desk while trying to reproduce something
// that needs the screen to be off for minutes; reading it here means unlocking
// the phone afterwards. The console.warn in audioLog.js keeps the logcat route
// open for anyone who prefers it.
//
// Hidden entirely when nothing has failed — which for almost everyone is
// always. This is not a feature, it is an instrument, and an instrument
// reading zero should not take up a row.
export default function AudioIssueLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(() => audioIssues());
  const [copied, setCopied] = useState(false);

  if (!entries.length) return null;

  const copy = async () => {
    const text = formatAudioIssues(entries);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // A WebView that refuses clipboard access is not a dead end: the text is
      // on screen below and can be selected by hand. Saying so beats a button
      // that silently does nothing.
      setCopied(false);
      setOpen(true);
    }
  };

  return (
    <div style={{ borderTop: '1px dotted var(--rule-hair)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="tap-row w-full flex items-center justify-between py-2.5 pl-4"
      >
        <span className="font-serif text-[14px] text-ink dark:text-paper">
          บันทึกปัญหาเสียง ({entries.length})
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div className="pl-4 pr-1 pb-3">
          <div className="font-serif text-[12px] text-ink-soft dark:text-rule-soft leading-relaxed mb-2">
            ย่อหน้าที่เล่นเสียงหลักไม่ได้ และเปลี่ยนไปใช้เสียงในเครื่องแทน
            <br />
            <span className="opacity-80">
              visible=false คือตอนนั้นแอปไม่ได้อยู่บนหน้าจอ · online=true คือ WebView มองว่ายังต่อเน็ตอยู่
            </span>
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={copy}
              className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
            >
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
            </button>
            <button
              onClick={() => { clearAudioIssues(); setEntries([]); }}
              className="tap-btn font-ui text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rule dark:border-ink-soft text-accent"
            >
              ล้าง
            </button>
          </div>

          {/* Selectable, and scrollable in its own box: the lines are long and
              the page must not scroll sideways because of them. */}
          <pre
            className="font-ui text-[10px] leading-relaxed text-ink dark:text-paper bg-card dark:bg-dark-card rounded-lg p-2 overflow-x-auto"
            style={{ userSelect: 'text', maxHeight: 260, overflowY: 'auto' }}
          >
            {formatAudioIssues(entries)}
          </pre>
        </div>
      )}
    </div>
  );
}
