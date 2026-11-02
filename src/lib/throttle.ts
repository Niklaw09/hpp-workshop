/** Calls `fn` at most once per `ms`, always delivering the latest value last. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: number | undefined;
  let latest: A;
  return (...args: A) => {
    latest = args;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) { last = Date.now(); fn(...latest); return; }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { last = Date.now(); fn(...latest); }, wait);
  };
}
