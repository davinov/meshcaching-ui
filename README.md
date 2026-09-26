# meshcaching-ui

Web UI for the MeshCaching device, over Web Bluetooth (Nordic UART) or Web Serial (115200 baud).
Plain static page, deployed by GitHub Pages: https://david.nowinsky.net/meshcaching-ui/

Protocol: send `j\n` to get one status JSON line and `p\n` to ping. Lines that don't start with `{` are shown as a log.
