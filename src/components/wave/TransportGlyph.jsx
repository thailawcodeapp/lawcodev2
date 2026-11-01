// ▶ / ■ for Wave's round buttons. Text glyphs sit at a different height in
// every font, so these are drawn; the triangle is shifted right of the box
// centre so it looks centred in a circle (its visual weight is on the left).
export default function TransportGlyph({ stopping, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {stopping
        ? <rect x="6" y="6" width="12" height="12" rx="2" />
        : <path d="M8.5 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7l-10.6-6.8A1 1 0 0 0 8.5 5.2z" />}
    </svg>
  );
}
