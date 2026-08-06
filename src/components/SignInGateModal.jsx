// The gate for a subscriber who already paid but is blocked by sign-in or
// the device cap — as opposed to ProGateModal, which sells Pro to someone
// who has not bought it. Same visual family (ConfirmDialog/ProGateModal).
import { useNavigate } from 'react-router-dom';
import { gateContentFor } from '../lib/proAccessCopy';
import SignInButtons from './SignInButtons';

export default function SignInGateModal({ state, feature, onClose }) {
  const navigate = useNavigate();
  const content = gateContentFor(state, feature);
  if (!content || content.kind === 'buy') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative bg-paper dark:bg-dark-bg rounded-2xl shadow-2xl p-5 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-[18px] font-medium italic">{content.title}</div>
        <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-1.5 leading-snug">
          {content.body}
        </div>

        {content.kind === 'signin' && (
          <div className="mt-4">
            <SignInButtons onSignedIn={onClose} onError={() => {}} />
          </div>
        )}

        {content.kind === 'device-slot' && (
          <button
            onClick={() => { onClose?.(); navigate('/settings'); }}
            className="tap-btn hit-44 mt-4 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper"
          >
            จัดการอุปกรณ์
          </button>
        )}

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
