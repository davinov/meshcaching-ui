// Niveau "chaud / froid" en fonction du RSSI (grand affichage)
export function level(r) {
  if (r > -70)  return ['Brûlant', '#c0392b'];
  if (r > -85)  return ['Chaud',   '#e67e22'];
  if (r > -100) return ['Tiède',   '#b7950b'];
  if (r > -112) return ['Froid',   '#2471a3'];
  return ['Glacial', '#6c3483'];
}

// Degrade relatif pour le graphique et la carte, avec les couleurs des niveaux :
// du plus faible (froid) au plus fort (chaud) des valeurs affichees.
// (meme degrade dans style.css, pour la legende de la carte)
const RAMP = ['#6c3483', '#2471a3', '#b7950b', '#e67e22', '#c0392b']
  .map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)));

function ramp(k) {
  k = Math.min(1, Math.max(0, k)) * (RAMP.length - 1);
  const i = Math.min(Math.floor(k), RAMP.length - 2), f = k - i;
  return 'rgb(' + RAMP[i].map((c, j) => Math.round(c + (RAMP[i + 1][j] - c) * f)) + ')';
}

// Renvoie une fonction RSSI -> couleur, calee sur le min et le max de rs
export function colorer(rs) {
  const lo = Math.min(...rs), hi = Math.max(...rs);
  return r => ramp(hi > lo ? (r - lo) / (hi - lo) : 1);
}
