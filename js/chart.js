// Graphique du RSSI sur les 10 dernieres minutes
import { colorer } from './colors.js';

export const HIST_MS = 10 * 60 * 1000;

// Echelle adaptee aux valeurs affichees (+/- 5 dB, arrondi a 10, 30 dB au moins)
function range(rs) {
  if (!rs.length) return [-130, -40];
  const hi = Math.ceil((Math.max(...rs) + 5) / 10) * 10;
  const lo = Math.floor((Math.min(...rs) - 5) / 10) * 10;
  return [Math.min(lo, hi - 30), hi];
}

export function drawChart(c, hist) {
  const dpr = window.devicePixelRatio || 1;
  c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
  const x = c.getContext('2d'), W = c.width, H = c.height, now = Date.now();
  const rs = hist.map(p => p.r), [lo, hi] = range(rs);
  const xOf = t => W - (now - t) / HIST_MS * W;
  const yOf = r => H - (r - lo) / (hi - lo) * H;

  // Lignes de graduation, tous les 10 ou 20 dB
  x.font = (10 * dpr) + 'px sans-serif';
  x.strokeStyle = '#2c333d'; x.fillStyle = '#8b95a1'; x.lineWidth = dpr;
  const step = hi - lo > 60 ? 20 : 10;
  for (let r = Math.floor(lo / step) * step + step; r < hi; r += step) {
    x.beginPath(); x.moveTo(0, yOf(r)); x.lineTo(W, yOf(r)); x.stroke();
    x.fillText(r, 4 * dpr, yOf(r) - 3 * dpr);
  }
  if (!hist.length) return;

  // Courbe, puis un point colore par detection
  x.strokeStyle = '#8b95a1'; x.beginPath();
  hist.forEach((p, i) => i ? x.lineTo(xOf(p.t), yOf(p.r)) : x.moveTo(xOf(p.t), yOf(p.r)));
  x.stroke();
  const col = colorer(rs);
  for (const p of hist) {
    x.fillStyle = col(p.r);
    x.beginPath(); x.arc(xOf(p.t), yOf(p.r), 4 * dpr, 0, 7); x.fill();
  }
}
