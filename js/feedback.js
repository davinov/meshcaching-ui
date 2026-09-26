// Retours pour chercher sans regarder l'ecran : bip, vibration, ecran allume.
let audio = null;

// L'audio d'un navigateur ne peut demarrer qu'apres un geste de l'utilisateur
export function unlockAudio() {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
}

// Bip dont la hauteur monte avec le RSSI (-120 dBm grave -> -50 dBm aigu)
export function beep(r) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  const k = Math.min(1, Math.max(0, (r + 120) / 70));
  o.frequency.value = 300 + k * 1200;
  g.gain.setValueAtTime(0.25, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
  o.connect(g); g.connect(audio.destination);
  o.start(); o.stop(audio.currentTime + 0.25);
}

// Trois petites vibrations quand c'est chaud, une longue sinon
export function buzz(r) {
  if (navigator.vibrate) navigator.vibrate(r > -85 ? [80, 60, 80, 60, 80] : [200]);
}

// Ecran allume pendant la chasse : le navigateur relache le verrou des que
// la page est cachee, on le reprend quand elle revient au premier plan.
export const canKeepAwake = 'wakeLock' in navigator;
let lock = null, wanted = false;

export function keepAwake(on) {
  wanted = on;
  refreshLock();
}

async function refreshLock() {
  if (!canKeepAwake || document.hidden) return;
  if (!wanted) { if (lock) lock.release(); lock = null; return; }
  if (!lock || lock.released) try { lock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', refreshLock);
