// The app's one bottom sheet.
//
// There were three copies of this — the play queue, the folder manager and the
// folder editor — each with its own drag-to-dismiss implementation. They had
// drifted: the folder editor bound touch handlers but no mouse handlers, so it
// could not be dragged shut in a desktop preview at all, and every copy popped
// into place fully formed because the only transition any of them declared was
// on the drag itself. Nothing animated on the way in.
//
// Centralising the drag logic (unchanged — same 100px threshold, same 200ms
// settle) means the entrance only had to be written once: the panel starts a
// full height below the fold and the backdrop starts transparent, then both
// settle together on the next frame.
import { useState } from 'react';

const DISMISS_PX = 100;   // drag further than this and the sheet closes
const SETTLE_MS = 220;

export default function BottomSheet({ height = '80%', onClose, children }) {
  const [drag, setDrag] = useState({ y: 0, active: false, startY: 0 });

  const start = (y) => setDrag({ y: 0, active: true, startY: y });
  const move = (y) => setDrag(d => (d.active ? { ...d, y: Math.max(0, y - d.startY) } : d));
  const end = () => {
    if (!drag.active) return;
    if (drag.y > DISMISS_PX) onClose?.();
    else setDrag({ y: 0, active: false, startY: 0 });
  };

  // Spread onto whatever the caller wants to be draggable — normally its
  // header. The grab handle below already carries them.
  const dragHandlers = {
    onTouchStart: (e) => start(e.touches[0].clientY),
    onTouchMove: (e) => move(e.touches[0].clientY),
    onTouchEnd: end,
    onMouseDown: (e) => start(e.clientY),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
      onMouseMove={drag.active ? (e) => move(e.clientY) : undefined}
      onMouseUp={drag.active ? end : undefined}
    >
      <div
        className="sheet-backdrop absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
      />

      <div
        className="sheet-rise relative w-full bg-paper dark:bg-dark-bg rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          // Reserve the status bar and the device nav inset, and cap the height
          // so the sheet can never overflow the visible area (v8 #7).
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 16px)',
          height,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          // The entrance is the .sheet-rise animation; this transform only
          // carries the drag, and takes over once the animation ends.
          transform: `translateY(${drag.y}px)`,
          transition: drag.active ? 'none' : `transform ${SETTLE_MS}ms cubic-bezier(.22,.61,.36,1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab select-none flex-shrink-0"
          {...dragHandlers}
        >
          <div className="w-12 h-1.5 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        {typeof children === 'function' ? children({ dragHandlers }) : children}
      </div>
    </div>
  );
}
