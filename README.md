# Cat Shelter

React/Vite frontend with an Express API and PostgreSQL persistence.

## Requirements

- Node.js 22+
- PostgreSQL
- A database and user with permission to create tables

## Setup

1. Copy `.env.example` to `.env` and fill in PostgreSQL credentials and secrets.
2. Install dependencies with `npm install`.
3. Run development mode with `npm run dev`.

On the first start, the server creates its tables and imports existing records from
`data/shelter_db.json` when the PostgreSQL tables are empty. Legacy applications are
kept for administrators but are not assigned to a new visitor.

## Production

Run `npm run build`, then `npm start`.

Admin sessions use HttpOnly, SameSite cookies. Set `COOKIE_SECURE=true` behind HTTPS.
User favourites and application ownership are isolated by a signed anonymous visitor cookie.


## Self-signed HTTPS

Set `HTTPS_ENABLED=true`, `HOST=0.0.0.0`, `TLS_KEY_PATH`, `TLS_CERT_PATH`, and
`COOKIE_SECURE=true` in `.env`. The current development certificate covers localhost,
the machine LAN address, and the public address present when it was generated.
Browsers will show a warning until a domain and a trusted certificate are configured.
Forward external TCP port 3000 to this computer's LAN port 3000.
