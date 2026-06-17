# DirectEmby

DirectEmby is a private, self-hosted Stremio addon for Emby. It authenticates to Emby during setup, stores an encrypted Emby access token inside the generated addon URL, and gives Stremio Emby playback URLs.

DirectEmby does not proxy, relay, cache, transcode, download, or convert media. Playback traffic goes from the Stremio device directly to the Emby server. If `Prefer SDR when available` is selected during setup, DirectEmby chooses a direct SDR media source when Emby exposes one; otherwise it keeps using the normal direct stream.

## Features

- Stremio manifest, catalog, meta, and stream handlers.
- Movie and series catalogs named `DirectEmby Movies` and `DirectEmby TV Shows`.
- Catalog search and pagination through Stremio `search` and `skip` extras.
- Movie IDs from Emby IMDb provider IDs, with fallback IDs for media without IMDb data.
- Series episode IDs in the format `ttSeriesId:season:episode`.
- Browser setup page at `/configure`.
- Optional SDR preference for TVs where HDR looks too dark.
- Health endpoint at `/health`.
- Docker Compose deployment.
- Optional Cloudflare Tunnel service.
- No database; only in-memory TTL caches are used.

## Security Model

- Emby usernames and passwords are used only for the setup login request.
- Passwords are never written to disk, stored in addon config, returned in responses, or logged.
- Generated install URLs contain an encrypted and signed config payload.
- The encrypted config includes the Emby server URL, selected library IDs, Emby user ID, and Emby access token.
- `ENCRYPTION_SECRET` must stay stable. Changing it invalidates existing install URLs.
- Treat generated Stremio install links as private credentials.

## Requirements

For local development:

- Node.js 20 or newer
- npm

For Docker deployment:

- Docker
- Docker Compose v2
- A public HTTPS URL, reverse proxy, or Cloudflare Tunnel if installing from outside the LAN

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Required values:

```env
PUBLIC_BASE_URL=https://your-addon.example.com
ENCRYPTION_SECRET=replace-with-a-long-random-secret-at-least-32-characters
```

Generate a strong secret:

```bash
openssl rand -base64 48
```

Optional values:

```env
PORT=3000
CACHE_TTL_SECONDS=300
SETUP_SESSION_TTL_SECONDS=600
CLOUDFLARED_TOKEN=
```

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open the setup page:

```text
http://localhost:3000/configure
```

Run checks:

```bash
npm run check
```

Build and run production JavaScript:

```bash
npm run build
npm start
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

By default, `docker-compose.yml` binds the app to `127.0.0.1:${PORT:-3000}`. That is a safe default when a reverse proxy or Cloudflare Tunnel runs on the same host.

For direct LAN exposure, change the port mapping from:

```yaml
"127.0.0.1:${PORT:-3000}:3000"
```

to:

```yaml
"${PORT:-3000}:3000"
```

## Cloudflare Tunnel

1. Create a tunnel in Cloudflare Zero Trust.
2. Add a public hostname such as `directemby.example.com`.
3. Route that hostname to `http://directemby:3000`.
4. Set `CLOUDFLARED_TOKEN` in `.env`.
5. Start the tunnel profile:

```bash
docker compose --profile cloudflare up -d --build
```

## Deploy Over SSH

From Windows PowerShell:

```powershell
.\scripts\deploy.ps1 -HostName user@server -PublicBaseUrl https://directemby.example.com
```

Optional:

```powershell
.\scripts\deploy.ps1 `
  -HostName user@server `
  -RemoteDir /home/user/directemby `
  -PublicBaseUrl https://directemby.example.com `
  -Port 3000 `
  -CloudflaredToken "YOUR_TUNNEL_TOKEN"
```

The PowerShell script uploads the project, runs `scripts/deploy.sh` remotely, preserves existing secrets, and verifies `/health`.

## Configure Stremio

1. Open `https://directemby.example.com/configure`.
2. Enter your Emby server URL, username, and password.
3. Select movie and TV libraries.
4. Optionally select `Prefer SDR when available` to direct-play an SDR source when Emby exposes one.
5. Copy the generated Stremio install link.
6. Open the `stremio://.../manifest.json` link on a device with Stremio installed.

## Routes

- `GET /` redirects to `/configure`
- `GET /health`
- `GET /configure`
- `POST /configure/libraries`
- `POST /configure/link`
- `GET /:config/manifest.json`
- `GET /:config/catalog/:type/:catalogId.json`
- `GET /:config/catalog/:type/:catalogId/:extra.json`
- `GET /:config/meta/:type/:id.json`
- `GET /:config/stream/:type/:id.json`

## Scripts

- `npm run dev` starts the TypeScript dev server with watch mode.
- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the built app.
- `npm test` runs Vitest.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run check` runs typecheck and tests.

## License

GPL-3.0. See `LICENSE`.
