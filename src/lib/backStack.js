// Android's back button, for screens with layers of their own (a sheet, a
// folders view, a table of contents drilled into). The newest handler is
// asked first; it returns true when it closed or went up something, and only
// when every handler declines does the app navigate away.
const handlers = [];

export function pushBack(fn) {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i !== -1) handlers.splice(i, 1);
  };
}

export function runBack() {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}
