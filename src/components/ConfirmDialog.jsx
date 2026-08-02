// In-app replacement for window.confirm().
//
// In an Android WebView the native confirm() dialog is a system AlertDialog
// captioned with the page's origin — it announced "localhost says:" over a
// letterpress-styled app, and it was the single strongest tell that this is a
// web view rather than a native app. Same shape as ProGateModal so the two
// read as one family.
export default function ConfirmDialog({
  title, body, confirmLabel = 'ลบ', cancelLabel = 'ยกเลิก', destructive = true,
  onConfirm, onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative bg-paper dark:bg-dark-bg rounded-2xl shadow-2xl p-5 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-[17px] font-medium italic">{title}</div>
        {body && (
          <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-1.5 leading-snug">
            {body}
          </div>
        )}
        <button
          onClick={onConfirm}
          className={`tap-btn mt-4 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg ${
            destructive ? 'bg-accent text-paper' : 'bg-ink dark:bg-paper text-paper dark:text-ink'
          }`}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="tap-btn mt-2 w-full font-ui text-[11px] py-2 text-ink-soft dark:text-rule-soft"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
