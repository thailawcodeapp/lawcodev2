// Long-press detection for a button that also has an ordinary tap action.
//
// Two signals can mean "long press" in an Android WebView: our own timer,
// and the `contextmenu` event Chrome fires after its own long-press delay.
// Either one fires onLongPress, once per press. Chrome may also send
// pointercancel when it takes the touch over for the context menu, so a
// cancel only stops the timer and never undoes a long press already seen.
//
// After a long press, the click that may follow the release is swallowed;
// the flag is cleared on the next pointerdown rather than on that click,
// because the click does not always arrive, and a flag left set would
// swallow the next ordinary tap.
export const LONG_PRESS_MS = 600;

export function createLongPress({ onLongPress, onTap, ms = LONG_PRESS_MS }) {
  let timer = null;
  let fired = false;

  const stop = () => { clearTimeout(timer); timer = null; };
  const fire = () => {
    stop();
    if (fired) return;
    fired = true;
    onLongPress();
  };

  return {
    onPointerDown: () => {
      fired = false;
      stop();
      timer = setTimeout(fire, ms);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => {
      e?.preventDefault?.();
      fire();
    },
    onClick: () => {
      if (fired) return;
      onTap();
    },
  };
}
