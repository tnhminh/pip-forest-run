// Thin wrappers over native capabilities that degrade gracefully on the web.
import { save, persist } from './save.js';

const N = () => (window.PipNative && window.PipNative.isNative ? window.PipNative : null);
export const isNative = () => !!N();
export const platformName = () => (N() ? N().platform : 'web');

// ---------- analytics ----------
// Swap the body of `track` for Firebase / GameAnalytics when you add one.
const log = [];
export function track(event, params = {}) {
  log.push({ t: Date.now(), event, ...params });
  if (log.length > 200) log.shift();
  if (window.__PIP_DEBUG) console.debug('[track]', event, params);
}

// ---------- haptics ----------
export function haptic(kind) {
  if (!save.settings.haptics) return;
  const n = N();
  if (n) {
    try {
      if (kind === 'heavy') n.Haptics.impact({ style: n.ImpactStyle.Heavy });
      else if (kind === 'success') n.Haptics.notification({ type: n.NotificationType.Success });
      else n.Haptics.impact({ style: n.ImpactStyle.Light });
    } catch (e) {}
  } else if (navigator.vibrate) {
    try { navigator.vibrate(kind === 'heavy' ? 60 : 15); } catch (e) {}
  }
}

// ---------- local notifications (daily reward reminder) ----------
const NOTIF_ID = 7001;
export async function scheduleDailyReminder() {
  const n = N(); if (!n) return;
  try {
    let perm = await n.LocalNotifications.checkPermissions();
    if (perm.display !== 'granted' && !save.notifAsked) {
      save.notifAsked = true; persist();
      perm = await n.LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return;
    await n.LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
    const at = new Date(); at.setDate(at.getDate() + 1); at.setHours(18, 30, 0, 0);
    await n.LocalNotifications.schedule({ notifications: [{
      id: NOTIF_ID, title: 'Your daily acorns are ready',
      body: 'Pip found a new gift on the trail. Keep your streak going!',
      schedule: { at, allowWhileIdle: true },
    }] });
  } catch (e) { console.warn('[notif]', e); }
}

// ---------- app lifecycle ----------
export function onAppEvents({ back, pause }) {
  const n = N();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  if (!n) return;
  try {
    n.App.addListener('backButton', () => { if (!back()) n.App.minimizeApp(); });
    n.App.addListener('pause', pause);
  } catch (e) {}
}

export async function nativeChrome() {
  const n = N(); if (!n) return;
  try { await n.StatusBar.hide(); } catch (e) {}
  try { await n.SplashScreen.hide(); } catch (e) {}
}
