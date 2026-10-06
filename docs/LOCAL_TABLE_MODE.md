# Local Table Mode (Termux / LAN) — design note only

Not implemented. Production Guest QR continues to use the public Railway origin (`AUTH_URL`).

A later Local Table Mode would:

- Run a Termux/local Node server bound to `0.0.0.0`
- Share a phone hotspot or LAN so Guest devices reach the host
- Encode Guest QR with that reachable LAN origin (`http://192.168.x.x:port/join/guest/{token}`)
- Skip Resend/magic-link; verified login stays unavailable without internet
- Use a local PostgreSQL/SQLite database on the host
- Promise no automatic sync with Railway
- Be tested on Android hotspot host reachability from a second device
- Leave JetBro II Web production behaviour unchanged
