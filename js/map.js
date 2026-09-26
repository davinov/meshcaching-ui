// Carte Leaflet : fond plan (OpenStreetMap) ou satellite (Esri), points
// enregistres colores par RSSI, notre position, legende, bouton "ma position".
// Leaflet est charge par index.html (window.L) ; sans reseau il manque et
// initMap() renvoie false : la liaison avec le boitier marche quand meme.
import { colorer } from './colors.js';

const PARIS = [48.8566, 2.3522];  // vue par defaut, sans point ni position
const HERE = '#4aa3ff';
const LOCATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
  + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'
  + '<path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>';

let map = null, layer = null, legend = null, hereDot = null, hereRing = null;

// Au-dela du zoom 19 (le plus fin des deux fonds), Leaflet agrandit les tuiles.
const tiles = (url, attribution) => L.tileLayer(url, { maxZoom: 25, maxNativeZoom: 19, attribution });

export function initMap(el, { base, onBaseChange, onLocate }) {
  if (!window.L) return false;
  map = L.map(el);
  const bases = {
    Plan: tiles('https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap'),
    Satellite: tiles('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', '© Esri'),
  };
  (bases[base] || bases.Plan).addTo(map);
  L.control.layers(bases, null, { position: 'topright' }).addTo(map);
  map.on('baselayerchange', e => onBaseChange(e.name));
  layer = L.layerGroup().addTo(map);
  control('bottomright', () => locateButton(onLocate));
  control('bottomleft', () => (legend = L.DomUtil.create('div', 'legend')));
  return true;
}

function control(position, build) {
  new (L.Control.extend({ onAdd: build }))({ position }).addTo(map);
}

// Bouton dans le style des boutons +/- du zoom
function locateButton(onClick) {
  const bar = L.DomUtil.create('div', 'leaflet-bar');
  const a = L.DomUtil.create('a', 'locate', bar);
  a.href = '#'; a.title = 'Ma position précise'; a.setAttribute('role', 'button');
  a.innerHTML = LOCATE_ICON;
  L.DomEvent.disableClickPropagation(bar);
  L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); onClick(); });
  return bar;
}

// A appeler quand la liste des points change (pas a chaque position GPS :
// une bulle ouverte se refermerait)
export function drawPoints(points) {
  if (!map) return;
  layer.clearLayers();
  const rs = points.map(p => p.r), col = colorer(rs);
  const best = points.reduce((b, p) => (!b || p.r > b.r ? p : b), null);
  legend.hidden = !points.length;
  if (points.length)
    legend.innerHTML = '<i></i><span>' + Math.round(Math.min(...rs)) + '</span><span>' + Math.round(Math.max(...rs)) + ' dBm</span>';
  for (const p of points) {
    // Meilleur signal entoure de blanc : le repeteur est probablement de ce cote
    L.circleMarker([p.lat, p.lon], { radius: 6, color: p === best ? '#fff' : '#000', weight: p === best ? 3 : 1,
                                     fillColor: col(p.r), fillOpacity: 0.9 })
      .bindPopup(Math.round(p.r) + ' dBm · SNR ' + p.snr.toFixed(1) + ' · ' + new Date(p.t).toLocaleTimeString())
      .addTo(layer);
  }
}

export function drawHere(here) {
  if (!map || !here) return;
  const at = [here.lat, here.lon];
  if (!hereDot) {
    // Non cliquables : ils sont dessines par-dessus les points, qui doivent rester touchables
    hereRing = L.circle(at, { radius: here.acc, color: HERE, weight: 1, interactive: false }).addTo(map);
    hereDot = L.circleMarker(at, { radius: 5, color: HERE, fillOpacity: 1, interactive: false }).addTo(map);
  }
  hereRing.setLatLng(at).setRadius(here.acc);
  hereDot.setLatLng(at);
}

// Cadre la carte sur tous les points et notre position
export function fitAll(points, here) {
  if (!map) return;
  const all = points.map(p => [p.lat, p.lon]);
  if (here) all.push([here.lat, here.lon]);
  if (all.length) map.fitBounds(all, { maxZoom: 18, padding: [20, 20] });
  else map.setView(PARIS, 11);
}

// Centre sur notre position, au moins au niveau de la rue
export function centerOn(here) {
  if (map) map.setView([here.lat, here.lon], Math.max(map.getZoom(), 17));
}
