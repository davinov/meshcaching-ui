// Page principale : relie la liaison avec le boitier, l'affichage, le GPS et la carte.
import { $, fmtAge } from './util.js';
import { state, save, MAX_POINTS } from './store.js';
import { level } from './colors.js';
import { drawChart, HIST_MS } from './chart.js';
import * as link from './link.js';
import * as geo from './geo.js';
import * as map from './map.js';
import { initPoints, refreshPoints } from './points.js';
import { unlockAudio, beep, buzz, canKeepAwake, keepAwake } from './feedback.js';

const POLL_MS = 1000;       // on demande l'etat au boitier chaque seconde ("j")
const SILENT_MS = 3500;     // sans reponse depuis ce temps : on le signale
const FIX_MAX_AGE = 30000;  // position trop vieille pour noter un point
const PKT_MAX_AGE = 15;     // paquet trop vieux (s) pour noter un point

let here = null, devName = '', lastJson = 0, logLines = [];

function setConn(text, off) {
  $('conn').textContent = text;
  $('conn').className = off ? 'off' : '';
}

// --- Liaison ---
link.initLink({
  line(l) {
    if (l[0] === '{') {
      let s;
      try { s = JSON.parse(l); } catch (e) { return; }  // ligne abimee : la suivante arrive dans 1 s
      onStatus(s);
      return;
    }
    // Le reste est du texte pour humains : on garde les dernieres lignes
    logLines = [...logLines, l].slice(-6);
    $('log').textContent = logLines.join('\n');
  },
  state(s, { name, err, canReconnect }) {
    if (s === 'connecting') { setConn('connexion…'); return; }
    if (s === 'connected') {
      devName = name; lastJson = Date.now();
      setConn('connecté · ' + name);
      $('link').hidden = true;
      link.send('j');
      return;
    }
    setConn('déconnecté', true);  // 'lost' ou 'idle' : l'historique reste
    if (s === 'idle') return;
    $('ping').disabled = true;
    $('link').hidden = false;
    $('bRec').hidden = !canReconnect;
    $('linkMsg').textContent = err ? 'Erreur : ' + (err.message || err) : '';
  },
});

$('bBle').hidden = !link.canBle;
$('bSer').hidden = !link.canSerial;
if (!link.canBle && !link.canSerial)
  $('linkMsg').textContent = 'Ce navigateur ne sait parler ni Bluetooth ni USB : utilisez Chrome (Android ou ordinateur) ou Edge.';
const connectFrom = fn => () => { $('linkMsg').textContent = ''; fn(); };
$('bBle').addEventListener('click', connectFrom(link.connectBle));
$('bSer').addEventListener('click', connectFrom(link.connectSerial));
$('bRec').addEventListener('click', connectFrom(link.reconnect));

// Chaque seconde : demande d'etat, et alerte si le boitier ne repond plus
function tick() {
  if (link.isConnected()) {
    link.send('j');
    if (Date.now() - lastJson > SILENT_MS) setConn('pas de réponse · ' + devName, true);
  }
  redrawChart();
}

// --- Etat du boitier : {"target","has","rssi","snr","age","why","seq","rx","pingWait"} ---
function onStatus(s) {
  lastJson = Date.now();
  setConn('connecté · ' + devName);
  $('target').textContent = s.target;
  if (state.target !== s.target) newTarget(s.target);
  $('rx').textContent = s.rx;
  $('count').textContent = s.seq;
  if (s.has) {
    showSignal(s);
    if (s.seq !== state.lastSeq) onDetection(s);
  }
  $('ping').disabled = s.pingWait > 0;
  $('ping').textContent = s.pingWait > 0 ? 'Ping possible dans ' + s.pingWait + ' s' : 'Ping le répéteur';
  redrawChart();
}

// Nouveau repeteur cible : l'historique de l'ancien ne veut plus rien dire
function newTarget(t) {
  if (state.target) {
    state.hist = []; state.points = []; state.prevRssi = null;
    map.drawPoints(state.points);
  }
  state.target = t;
  save();
}

function showSignal(s) {
  const [name, color] = level(s.rssi);
  $('rssi').innerHTML = Math.round(s.rssi) + '<small> dBm</small>';
  $('lvl').textContent = name;
  $('big').style.background = color;
  $('snr').textContent = s.snr.toFixed(1);
  $('age').textContent = fmtAge(s.age);
  $('age').className = s.age > 120 ? 'stale' : '';
  $('why').textContent = 'dernière détection : ' + s.why;
}

// Nouveau paquet du repeteur (pas de tendance ni d'alerte au tout premier affichage)
function onDetection(s) {
  if (state.lastSeq >= 0) {
    if (state.prevRssi !== null) {
      const d = Math.round(s.rssi - state.prevRssi);
      $('trend').textContent = d > 0 ? '▲ +' + d + ' dB, plus chaud' : d < 0 ? '▼ ' + d + ' dB, plus froid' : '= stable';
    }
    if ($('vib').checked) buzz(s.rssi);
    if ($('beep').checked) beep(s.rssi);
  }
  state.hist.push({ t: Date.now() - s.age * 1000, r: s.rssi });
  state.prevRssi = s.rssi;
  state.lastSeq = s.seq;
  recordPoint(s);
  save();
}

// On note ou l'on etait a chaque paquet du repeteur, si le paquet et la
// position sont recents (sinon le point serait faux).
function recordPoint(s) {
  if (!here || Date.now() - here.t > FIX_MAX_AGE || s.age > PKT_MAX_AGE) return;
  state.points.push({ t: Date.now() - s.age * 1000, lat: here.lat, lon: here.lon,
                      acc: Math.round(here.acc), r: s.rssi, snr: s.snr });
  if (state.points.length > MAX_POINTS) state.points.shift();
  map.drawPoints(state.points);
  refreshPoints();
}

function redrawChart() {
  state.hist = state.hist.filter(p => Date.now() - p.t < HIST_MS);
  drawChart($('chart'), state.hist);
}

$('ping').addEventListener('click', () => {
  if (!link.isConnected()) return;
  $('ping').disabled = true;
  link.send('p');
  $('pingMsg').textContent = 'Ping envoyé, réponse attendue sous 10 s…';
});

// --- Options ---
$('beep').addEventListener('change', e => { if (e.target.checked) { unlockAudio(); beep(-85); } });
$('awake').parentElement.hidden = !canKeepAwake;
$('awake').addEventListener('change', e => keepAwake(e.target.checked));
keepAwake($('awake').checked);

// --- GPS et carte ---
function onFix(fix) {
  here = fix;
  $('geoMsg').textContent = 'Position à ±' + Math.round(here.acc) + ' m · ' + state.points.length + ' points';
  map.drawHere(here);
}
const onGeoError = e => { $('geoMsg').textContent = 'GPS indisponible : ' + e.message; };

function locate() {
  if (!geo.hasGeo) return;
  $('geoMsg').textContent = 'Recherche de la position précise…';
  geo.freshPosition(fix => { onFix(fix); map.centerOn(fix); }, onGeoError);
}

const mapOk = map.initMap($('map'), {
  base: state.base,
  onBaseChange(name) { state.base = name; save(); },
  onLocate: locate,
});
if (mapOk) { map.drawPoints(state.points); map.fitAll(state.points, here); }
else $('geoMsg').textContent = 'Carte indisponible (pas de réseau)';

if (geo.hasGeo) geo.watchPosition(onFix, onGeoError);
else $('geoMsg').textContent = 'GPS indisponible sur ce navigateur';

initPoints(fit => {
  map.drawPoints(state.points);
  if (fit) map.fitAll(state.points, here);
});

$('clear').addEventListener('click', () => {
  if (!confirm('Effacer l’historique RSSI et les positions enregistrées ?')) return;
  state.hist = []; state.points = []; state.prevRssi = null;
  save(); redrawChart();
  map.drawPoints(state.points); map.fitAll(state.points, here);
});

// --- Demarrage ---
tick();
setInterval(tick, POLL_MS);
window.addEventListener('resize', redrawChart);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
