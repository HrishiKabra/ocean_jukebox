export function registerServiceWorker(win = window) {
  if (!('serviceWorker' in win.navigator)) return;
  win.addEventListener('load', () => {
    win.navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
