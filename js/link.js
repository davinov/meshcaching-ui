// Liaison avec le boitier : Bluetooth (Nordic UART) ou port serie USB.
// Les deux transportent les memes lignes de texte terminees par '\n'.
// Ce module ne touche pas a la page : il signale les lignes recues et les
// changements d'etat aux fonctions passees a initLink().
const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // telephone -> boitier
const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // boitier -> telephone
const RETRY_MS = 5000;

// Sur Android, le Web Serial natif de Chrome ne voit pas le port USB de
// l'ESP32-S3 : on passe par le polyfill de Google, qui parle au port en WebUSB.
// Sur ordinateur, le pilote du systeme tient le port : Web Serial natif.
// Charge des l'ouverture : Chrome n'ouvre le choix du port que juste apres le toucher.
const ANDROID = /Android/i.test(navigator.userAgent) && 'usb' in navigator;
const serialApi = ANDROID
  ? import('https://cdn.jsdelivr.net/npm/web-serial-polyfill@1.0.15/dist/serial.js').then(m => m.serial)
  : Promise.resolve(navigator.serial);
serialApi.catch(() => {});  // sans reseau : l'erreur s'affichera au clic

export const canBle = 'bluetooth' in navigator;
export const canSerial = 'serial' in navigator || ANDROID;

const enc = new TextEncoder();
let on = { line() {}, state() {} };
let write = null;           // fonction d'envoi, null hors connexion
let kind = null;            // 'ble' ou 'serial', une fois un appareil choisi
let dev = null, port = null, retry = null, down = true;
let buf = '', dec = null;

// on.line(texte) pour chaque ligne recue ;
// on.state('connecting' | 'connected' | 'lost' | 'idle', { name, err, canReconnect })
export function initLink(handlers) { on = handlers; }

export const isConnected = () => !!write;
export function send(cmd) { if (write) write(cmd + '\n'); }

export const connectBle = () => start(openBle, true);
export const connectSerial = () => start(openSerial, true);
export const reconnect = () => start(kind === 'ble' ? openBle : openSerial, false);

function start(open, pick) {
  open(pick).catch(e => {
    if (e.name !== 'NotFoundError') lost(e);        // vraie erreur
    else if (!write) on.state('idle', {});          // choix de l'appareil annule
  });
}

// Les notifications Bluetooth arrivent par morceaux de 20 octets : on
// recolle, puis on coupe aux fins de ligne. Le decodeur "stream" garde les
// accents coupes en deux entre deux morceaux.
function onChunk(bytes) {
  buf += dec.decode(bytes, { stream: true });
  if (buf.length > 8192) buf = '';  // jamais de fin de ligne : on repart a zero
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) on.line(line);
  }
}

function linked(name) {
  buf = ''; down = false;
  on.state('connected', { name });
}

// Perte de liaison ; en Bluetooth on retente seul (sortie de portee, boitier redemarre...)
function lost(err) {
  if (!write && err === undefined && down) return;  // deja signale
  write = null; down = true;
  on.state('lost', { err, canReconnect: !!kind });
  clearTimeout(retry);
  if (kind === 'ble') retry = setTimeout(() => openBle(false).catch(lost), RETRY_MS);
}

async function openBle(pick) {
  if (pick) {
    // Nom et service ne tiennent pas ensemble dans une annonce de 31 octets :
    // on accepte l'un ou l'autre.
    dev = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'MeshCaching' }, { services: [NUS] }], optionalServices: [NUS] });
    dev.addEventListener('gattserverdisconnected', () => lost());
    kind = 'ble';
  }
  clearTimeout(retry);
  on.state('connecting', {});
  dec = new TextDecoder();
  const srv = await (await dev.gatt.connect()).getPrimaryService(NUS);
  const rx = await srv.getCharacteristic(NUS_RX), tx = await srv.getCharacteristic(NUS_TX);
  // "=" plutot que addEventListener : pas de doublon apres reconnexion
  tx.oncharacteristicvaluechanged = e => {
    const v = e.target.value;
    onChunk(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  };
  await tx.startNotifications();
  // Une seule ecriture GATT a la fois, sinon Chrome refuse : on les enchaine
  let queue = Promise.resolve();
  const w = rx.properties.writeWithoutResponse ? b => rx.writeValueWithoutResponse(b) : b => rx.writeValue(b);
  write = s => { queue = queue.then(() => w(enc.encode(s))).catch(() => {}); };
  linked(dev.name);
}

// Le polyfill plante sur les paquets USB vides que l'ESP32-S3 envoie ("chunk
// is empty") : on lit nous-memes le point d'entree USB, en sautant ces paquets.
// ponytail: device_/inEndpoint_ sont internes au polyfill, version figee 1.0.15.
const usbReader = p => ({
  async read() {
    for (;;) {
      const r = await p.device_.transferIn(p.inEndpoint_.endpointNumber, 1024);
      if (r.status !== 'ok') throw new Error('USB ' + r.status);
      if (r.data.byteLength) return { value: new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength) };
    }
  },
  releaseLock() {},
});

async function openSerial(pick) {
  if (pick) {
    port = await (await serialApi).requestPort();
    kind = 'serial';
  }
  on.state('connecting', {});
  dec = new TextDecoder();
  await port.open({ baudRate: 115200 });
  const wr = port.writable.getWriter();
  const rd = port.device_ ? usbReader(port) : port.readable.getReader();
  write = s => { wr.write(enc.encode(s)).catch(() => {}); };
  linked('USB');
  let err;
  try {
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      onChunk(value);
    }
  } catch (e) { err = e; }  // cable debranche
  try { rd.releaseLock(); wr.releaseLock(); await port.close(); } catch (e) {}
  lost(err);
}
