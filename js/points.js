// Gestion des points enregistres (plein ecran par-dessus la page, pour ne pas
// couper la liaison avec le boitier) : liste, suppression, export / import JSON.
import { $, fmtWhen } from './util.js';
import { colorer } from './colors.js';
import { state, save, MAX_POINTS } from './store.js';

let onChange = () => {};
const msg = t => { $('ptsMsg').textContent = t; };

// onChange(fit) : les points ont change, la carte doit etre redessinee
export function initPoints(changed) {
  onChange = changed;
  $('manage').addEventListener('click', () => { msg(''); render(); $('pts').showModal(); });
  $('ptsClose').addEventListener('click', () => $('pts').close());
  $('exp').addEventListener('click', exportPoints);
  $('imp').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', importPoints);
}

// Nouveau point enregistre pendant que la liste est ouverte
export function refreshPoints() {
  if ($('pts').open) render();
}

function commit(fit) {
  save(); render(); onChange(fit);
}

function render() {
  const { points } = state;
  $('ptsN').textContent = '(' + points.length + ')';
  const col = colorer(points.map(p => p.r));
  $('ptsList').replaceChildren(...points.slice().reverse().map(p => {  // les plus recents en haut
    const li = document.createElement('li');
    // Que des nombres (verifies a l'import) et une date formatee : pas d'injection possible
    li.innerHTML = '<i style="background:' + col(p.r) + '"></i><div><b>' + Math.round(p.r) + ' dBm</b> · SNR '
      + p.snr.toFixed(1) + ' · ±' + p.acc + ' m<small>' + fmtWhen(p.t) + ' · '
      + p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + '</small></div><button>Supprimer</button>';
    li.querySelector('button').addEventListener('click', () => remove(p));
    return li;
  }));
}

function remove(p) {
  if (!confirm('Supprimer le point du ' + fmtWhen(p.t) + ' (' + Math.round(p.r) + ' dBm) ?')) return;
  state.points = state.points.filter(q => q !== p);
  commit(false);
}

function exportPoints() {
  const { target, points } = state;
  const data = { app: 'meshcaching', target, exported: new Date().toISOString(), points };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = 'meshcaching-' + (target || 'points') + '-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Fichier venu d'ailleurs : on ne garde que des points aux champs numeriques valides
const num = v => typeof v === 'number' && isFinite(v);
const valid = p => p && num(p.t) && num(p.lat) && num(p.lon) && num(p.r)
  && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const clean = p => ({ t: p.t, lat: p.lat, lon: p.lon, acc: num(p.acc) ? Math.round(p.acc) : 0,
                      r: p.r, snr: num(p.snr) ? p.snr : 0 });

async function importPoints(e) {
  const f = e.target.files[0];
  e.target.value = '';  // pour pouvoir reimporter le meme fichier
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (err) { msg('Fichier illisible (JSON attendu)'); return; }
  const list = Array.isArray(d) ? d : (d && Array.isArray(d.points) ? d.points : []);
  const good = list.filter(valid).map(clean);
  if (!good.length) { msg('Aucun point valide dans ce fichier'); return; }
  if (d.target && state.target && d.target !== state.target
      && !confirm('Ces points viennent du répéteur ' + d.target + ', la cible actuelle est ' + state.target + '. Importer quand même ?')) return;

  // Fusion sans doublons (meme heure et meme lieu), dans l'ordre chronologique
  const key = p => p.t + ',' + p.lat + ',' + p.lon, seen = new Set(state.points.map(key));
  const added = good.filter(p => !seen.has(key(p)) && seen.add(key(p)));
  state.points = [...state.points, ...added].sort((a, b) => a.t - b.t).slice(-MAX_POINTS);
  commit(true);

  const dup = good.length - added.length, bad = list.length - good.length;
  msg(added.length + ' point(s) importé(s)'
      + (dup ? ', ' + dup + ' déjà présent(s)' : '')
      + (bad ? ', ' + bad + ' invalide(s) ignoré(s)' : ''));
}
