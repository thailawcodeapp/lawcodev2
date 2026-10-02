// One explanation for every Pro-gated action.
//
// The app had three different walls. The bookmarks screen explained itself and
// offered a way through; the listen screen explained itself but only told the
// user where to go, ending the flow at its most interested moment; the reader
// silently navigated to Settings when a free user tapped highlight or
// bookmark, which lost their reading position with no explanation at all.
//
// This is the listen screen's dialog, given a button that actually goes.
import { useNavigate } from 'react-router-dom';

export default function ProGateModal({ title, body, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative bg-paper dark:bg-dark-bg rounded-2xl shadow-2xl p-5 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-[18px] font-medium italic">{title}</div>
        <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-1.5 leading-snug">
          {body}
        </div>
        <button
          onClick={() => { onClose?.(); navigate('/settings'); }}
          className="tap-btn mt-4 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper"
        >
          ดูแพ็กเกจ Pro
        </button>
        <button
          onClick={onClose}
          className="tap-btn mt-2 w-full font-ui text-[11px] py-2 text-ink-soft dark:text-rule-soft"
        >
          ไว้ก่อน
        </button>
      </div>
    </div>
  );
}
