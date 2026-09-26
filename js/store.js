// Sauvegarde locale : l'historique et les points survivent au rechargement de la page.
const KEY = 'meshcaching';
export const MAX_POINTS = 2000;  // positions gardees (localStorage limite a ~5 Mo)

let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}

export const state = {
  lastSeq: saved.lastSeq ?? -1,     // compteur de paquets de la cible : s'il change, nouvelle detection
  prevRssi: saved.prevRssi ?? null, // RSSI de la detection precedente, pour la tendance
  hist: saved.hist || [],           // { t, r } : le graphique
  points: saved.points || [],       // { t, lat, lon, acc, r, snr } : la carte
  target: saved.target || null,     // prefixe du repeteur suivi
  base: saved.base || 'Plan',       // fond de carte choisi
};

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
