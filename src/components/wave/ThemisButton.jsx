// Lady Justice from the app icon is Wave's play button (spec 3.2). Paused,
// the headphones hang from the hook in her raised hand. Playing, they fly up
// in an arc and settle on her head — the cut-out pair hands over to the photo
// of her wearing them — then gold sound rings spread from her ears.
//
// The element stays mounted while playback starts and stops, so toggling the
// `on` class is what runs the CSS transitions in wave.css.
import themisBase from '../../assets/wave/themis-base.jpg';
import themisOn from '../../assets/wave/themis-on.jpg';
import headphones from '../../assets/wave/headphones.png';

const Play = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const Pause = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);

export default function ThemisButton({ playing, still, disabled, label, onPress }) {
  return (
    <button
      type="button"
      className={`wv-themis${still ? ' is-still' : ''}`}
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
    >
      <span className={`wv-themis-img${playing ? ' on' : ''}`}>
        <img className="wv-base" src={themisBase} alt="" draggable="false" />
        <img className="wv-on" src={themisOn} alt="" draggable="false" />
        {!still && (
          <span className="wv-fly" aria-hidden="true">
            <span className="wv-fx"><span className="wv-fy"><span className="wv-fs">
              <img src={headphones} alt="" draggable="false" />
            </span></span></span>
          </span>
        )}
        {!still && (
          <svg className="wv-waves" viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="#E9BE64" strokeWidth="2.2" strokeLinecap="round">
            <path d="M136 48 Q145 60 136 72" /><path d="M143 41 Q156 60 143 79" />
            <path d="M55 48 Q46 60 55 72" /><path d="M48 41 Q35 60 48 79" />
          </svg>
        )}
      </span>
      <span className="wv-badge" aria-hidden="true">{playing ? <Pause /> : <Play />}</span>
    </button>
  );
}
