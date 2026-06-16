# DirectEmby

DirectEmby is a private, self-hosted [Stremio](https://www.stremio.com/) addon for [Emby](https://emby.media/). It authenticates to Emby during setup, stores only an encrypted Emby access token inside the generated addon URL, and returns direct Emby static stream URLs to Stremio.

DirectEmby does not proxy, relay, cache media, download media, transcode media, or convert media. Playback traffic goes directly from the Stremio device to the Emby server.

## Features

- Stremio manifest, catalog, meta, and stream handlers for movies and series.
- Catalogs named `DirectEmby Movies` and `DirectEmby TV Shows`.
- Catalog `search` and `skip` support.
- Movie IDs mapped from `ProviderIds.Imdb`, for example `tt0111161`.
- Series IDs mapped from `ProviderIds.Imdb`, for example `tt0944947`.
- Episode IDs mapped as `ttSeriesId:season:episode`, for example `tt0944947:1:1`.
- Fallback IDs for items without IMDb IDs: `directemby_movie_<id>` and `directemby_series_<id>:season:episode`.
- Browser setup page at `/configure`.
- Health endpoint at `/health`.
- Docker Compose deployment.
- Optional Cloudflare Tunnel deployment.
- No database. Only in-memory TTL caches are used.

## Security Model

- Emby usernames and passwords are used only for the setup login request.
- Passwords are never written to disk, stored in the addon config, returned in responses, or logged.
- The generated install URL contains an encrypted and signed config payload.
- The encrypted config includes the Emby server URL, selected library IDs, Emby user ID, and Emby access token.
- `ENCRYPTION_SECRET` must stay stable. Changing it invalidates previously generated install URLs.
- Treat generated Stremio install URLs as private credentials.

## Stream Behavior

DirectEmby only returns direct static Emby stream URLs:

```text
/Videos/{ItemId}/stream?static=true&api_key=<TOKEN>
```

It does not use Emby HLS, transcoding, conversion, download, or proxy endpoints. If DirectEmby cannot determine that an item has a direct-playable media source, the stream handler returns:

```json
{ "streams": [] }
```

## Requirements

For local development:

- Node.js 20+
- npm

For production deployment:

- Linux host or VM
- Docker
- Docker Compose v2
- curl
- openssl

The deploy script can install Docker, Docker Compose, Git, curl, and openssl on common `apt`, `dnf`, and `yum` systems when run by a sudo-capable user.

## Environment

Copy the example file and edit the values:

```bash
cp .env.example .env
```

Required:

```env
PUBLIC_BASE_URL=https://your-addon.example.com
ENCRYPTION_SECRET=replace-with-a-long-random-secret-at-least-32-characters
```

Generate a strong secret:

```bash
openssl rand -base64 48
```

Optional:

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

Open:

```text
http://localhost:3000/configure
```

Run checks:

```bash
npm run check
```

Build:

```bash
npm run build
npm start
```

## Docker Compose

```bash
cp .env.example .env
# Edit .env.
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

By default, `docker-compose.yml` binds the app to `127.0.0.1:${PORT:-3000}` on the host. This is a good default when Cloudflare Tunnel or a reverse proxy is running on the same host.

For direct LAN/Internet exposure without a tunnel or reverse proxy, change the port mapping in `docker-compose.yml` from:

```yaml
"127.0.0.1:${PORT:-3000}:3000"
```

to:

```yaml
"${PORT:-3000}:3000"
```

## Cloudflare Tunnel

The simplest production option is a Cloudflare managed tunnel token.

1. In Cloudflare Zero Trust, create a tunnel.
2. Add a public hostname such as `directemby.example.com`.
3. Route that hostname to:

```text
http://directemby:3000
```

4. Put the tunnel token in `.env`:

```env
CLOUDFLARED_TOKEN=your-token
```

5. Start the Cloudflare profile:

```bash
docker compose --profile cloudflare up -d --build
```

If `cloudflared` is installed directly on the host instead of running in Docker, route the public hostname to:

```text
http://127.0.0.1:3000
```

## Deploy Over SSH

From Windows PowerShell:

```powershell
.\scripts\deploy.ps1 -HostName user@server -PublicBaseUrl https://directemby.example.com
```

Optional parameters:

```powershell
.\scripts\deploy.ps1 `
  -HostName user@server `
  -RemoteDir /home/user/directemby `
  -PublicBaseUrl https://directemby.example.com `
  -Port 3000 `
  -CloudflaredToken "YOUR_TUNNEL_TOKEN"
```

The PowerShell script uploads the project as a tarball, extracts it on the remote host, and runs `scripts/deploy.sh`.

You can also run the Linux deploy script directly from the project directory on the server:

```bash
APP_DIR="$PWD" PUBLIC_BASE_URL=https://directemby.example.com PORT=3000 bash scripts/deploy.sh
```

The deploy script:

- Installs prerequisites if needed and sudo is available.
- Creates `.env` with a generated `ENCRYPTION_SECRET` if `.env` does not already exist.
- Preserves an existing `ENCRYPTION_SECRET`.
- Starts Docker Compose with `restart: unless-stopped`.
- Starts the Cloudflare Compose profile when `CLOUDFLARED_TOKEN` is present.
- Verifies `http://127.0.0.1:${PORT}/health`.

## Configure Stremio

1. Open `https://directemby.example.com/configure`.
2. Enter your Emby server URL, username, and password.
3. Select movie and TV libraries.
4. Copy the generated Stremio install link.
5. Open the `stremio://.../manifest.json` link on a device with Stremio installed.

Generated addon URLs are already configured. Stremio should show an install option, not a configure loop.

## Routes

- `GET /health`
- `GET /configure`
- `GET /:config/configure`
- `POST /configure/libraries`
- `POST /configure/link`
- `GET /:config/manifest.json`
- `GET /:config/catalog/:type/:catalogId.json`
- `GET /:config/catalog/:type/:catalogId/:extra.json`
- `GET /:config/meta/:type/:id.json`
- `GET /:config/stream/:type/:id.json`

## Troubleshooting

### Stremio Says Failed To Fetch Manifest

Verify the public manifest URL works in a browser or with curl:

```bash
curl -i https://directemby.example.com/health
```

Expected headers include:

```text
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
```

If `/health` works but Stremio fails, confirm the addon URL includes `/manifest.json` and the public URL uses HTTPS.

### Stremio Shows Configure Instead Of Install

Generate a fresh install link from `/configure`. DirectEmby generated manifests are already configured and should not include `configurationRequired`.

### Existing Install Links Stopped Working

Check whether `ENCRYPTION_SECRET` changed. Existing links can only be decrypted with the same secret that generated them.

### Streams Are Empty

DirectEmby returns no streams when a media item does not expose a direct-playable media source. Check the Emby item in the Emby web UI and confirm the client can direct play it without transcoding.

## License

MIT
