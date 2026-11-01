// Settings › ธีม: one compact row, Wave and Classic side by side. Switching
// takes effect at once — App.jsx re-renders the routes from settings.theme.
import themisBase from '../../assets/wave/themis-base.jpg';

const OPTIONS = [
  { id: 'wave', label: 'Wave' },
  { id: 'classic', label: 'Classic' },
];

export default function ThemePicker({ value, onChange }) {
  return (
    <div data-tour="settings-theme" className="my-2.5 flex items-center gap-3">
      <div className="font-display text-[17px] font-medium">ธีม</div>
      <div className="flex flex-1 gap-2">
        {OPTIONS.map(o => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              className={`tap-btn flex-1 min-w-0 flex items-center gap-2 rounded-xl p-1.5 border-2 ${on ? 'border-accent' : 'border-rule-soft dark:border-ink-soft'}`}
            >
              <div className={`theme-preview theme-preview-${o.id}`} aria-hidden="true">
                {o.id === 'wave' && <img src={themisBase} alt="" />}
              </div>
              <div className="font-ui text-[12.5px] font-semibold truncate">{o.label}{on ? ' ✓' : ''}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
