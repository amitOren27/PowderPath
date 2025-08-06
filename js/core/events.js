
export function on(event, handler, target = document) {
  target.addEventListener(event, handler);
  return () => target.removeEventListener(event, handler);
}

export function emit(event, detail, target = document) {
  target.dispatchEvent(new CustomEvent(event, { detail }));
}