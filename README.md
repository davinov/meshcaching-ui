# meshcaching-ui

Web UI for the MeshCaching device, over Web Bluetooth (Nordic UART) or Web Serial (115200 baud).
Plain static page, deployed by GitHub Pages: https://david.nowinsky.net/meshcaching-ui/

Protocol: send `j\n` to get one status JSON line and `p\n` to ping. Lines that don't start with `{` are shown as a log.

Run locally: `python3 -m http.server 8000`, then open http://localhost:8000 (Bluetooth, USB and GPS need `localhost` or HTTPS).

## Files

- `index.html`, `style.css`: the page
- `js/main.js`: wires everything to the page (status display, detections, options)
- `js/link.js`: Bluetooth / USB serial link, line splitting, reconnection
- `js/map.js`: Leaflet map, points, legend, locate control
- `js/chart.js`: 10-minute RSSI chart
- `js/points.js`: points panel (list, delete, import, export)
- `js/store.js`: state saved in localStorage
- `js/colors.js`, `js/geo.js`, `js/feedback.js`, `js/util.js`: levels and gradient, GPS, beep / vibration / wake lock, helpers
- `sw.js`, `manifest.webmanifest`, `icon*`: PWA
