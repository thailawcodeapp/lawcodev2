// Transient one-line messages.
//
// Exists because several primary actions used to fail silently: playSelected,
// playLeaf, playGroup and the home screen's listen button all guard with
// `if (items.length)` and no else, so tapping them with nothing selected did
// literally nothing and read as a broken button.
//
// Deliberately not a context: the callers are plain event handlers, some of
// them deep inside modals, and threading a provider through all of them buys
// nothing. A module-level subscription keeps the call site to one import.

const listeners = new Set();

/** Show a message. Safe to call from anywhere, including outside React. */
export function showToast(message) {
  if (!message) return;
  for (const fn of listeners) fn(message);
}

/** Subscribe a host component. Returns an unsubscribe function. */
export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
