// Settings › ธีม: two preview cards, Classic and Wave. Switching takes effect
// at once — App.jsx re-renders the routes from settings.theme.
import themisBase from '../../assets/wave/themis-base.jpg';

const OPTIONS = [
  { id: 'classic', label: 'Classic' },
  { id: 'wave', label: 'Wave' },
];

export default function ThemePicker({ value, onChange }) {
  return (
    <div className="my-3">
      <div className="font-display text-[17px] font-medium mb-2">ธีม</div>
      <div className="flex gap-3">
        {OPTIONS.map(o => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              className={`tap-btn flex-1 rounded-xl p-2 text-center ${on ? 'border-2 border-accent' : 'border border-rule-soft dark:border-ink-soft'}`}
            >
              <div className={`theme-preview theme-preview-${o.id}`} aria-hidden="true">
                {o.id === 'wave' && <img src={themisBase} alt="" />}
              </div>
              <div className="font-ui text-[12px] mt-1.5">{o.label}{on ? ' ✓' : ''}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
