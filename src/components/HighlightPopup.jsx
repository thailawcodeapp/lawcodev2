import { HIGHLIGHT_COLORS } from '../lib/highlights';

export default function HighlightPopup({ position, onSelect, onDismiss }) {
  if (!position) return null;

  return (
    <>
      {/* Invisible backdrop to dismiss */}
      <div className="fixed inset-0" style={{ zIndex: 25 }} onClick={onDismiss} />

      {/* Popup */}
      <div
        className="fixed bg-ink dark:bg-paper rounded-xl shadow-xl flex items-center gap-1 px-2 py-1.5"
        style={{
          zIndex: 26,
          left: Math.max(8, Math.min(position.x - 80, window.innerWidth - 168)),
          top: Math.max(8, position.y - 50),
        }}
      >
        {HIGHLIGHT_COLORS.map(color => (
          <button
            key={color.id}
            onClick={() => onSelect(color.id)}
            className="w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform"
            style={{ background: color.bg, borderColor: color.border }}
            aria-label={color.label}
          />
        ))}
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center text-paper dark:text-ink opacity-50 hover:opacity-100 ml-0.5"
          aria-label="ยกเลิก"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
