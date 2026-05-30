import { useNavigate } from 'react-router-dom';

export default function Header({ title, onBack, rightSlot, borderBottom = true }) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <div
      className={[
        'flex items-center justify-between px-5 py-2.5 flex-shrink-0',
        borderBottom ? 'border-b border-rule dark:border-ink-soft' : '',
      ].join(' ')}
    >
      <button
        onClick={handleBack}
        className="text-ink dark:text-paper -ml-1 p-1 touch-target"
        aria-label="Back"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>

      <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-ink dark:text-paper text-center flex-1 px-2">
        {title}
      </div>

      <div className="flex items-center gap-3">
        {rightSlot || <div className="w-6" />}
      </div>
    </div>
  );
}

export function SearchIcon({ onClick, className = '' }) {
  return (
    <button onClick={onClick} className={`text-ink dark:text-paper ${className}`} aria-label="Search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}

export function BookmarkIcon({ active, onClick }) {
  return (
    <button onClick={onClick} className="text-ink dark:text-paper" aria-label={active ? 'Remove bookmark' : 'Bookmark'}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7">
        <path d="M5 4h11l3 3v13a1 1 0 0 1-1.5.87L12 18l-5.5 2.87A1 1 0 0 1 5 20Z" />
      </svg>
    </button>
  );
}
