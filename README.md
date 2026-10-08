# FGCScout

FGCScout is a public match, team and event browser for FIRST Global data. It has
a Next.js frontend, an ASP.NET Core API and MongoDB. Production traffic goes
through Caddy, so the website and API share one HTTPS origin.

## Development with hot reload

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Open the site at `http://localhost:3000`; the development API is available at
`http://localhost:5000`. Source directories are mounted into the containers,
so Next.js and `dotnet watch` reload ordinary code edits without rebuilding.
Rebuild only after changing dependencies, a Dockerfile or Compose configuration.

To enable the admin panel locally, put a key in `.env`:

```dotenv
FGCSCOUT_ADMIN_API_KEY=use-a-long-random-value
```

Stop development with `docker compose -f docker-compose.dev.yml down`.

The development database deliberately keeps the existing Docker volume named
`fgcscout_mongo_data`. Back it up before the first MongoDB 7 startup if it
contains irreplaceable data.

## Production deployment

Requirements: Docker Engine with Compose v2, a server reachable on ports 80 and
443, and a DNS record pointing the chosen domain to that server.

1. Copy `.env.example` to `.env`.
2. Replace every placeholder with unique secrets. The admin key must be at least
   32 characters. Set the real operator name, address, privacy contact and hosting provider.
3. Set `CADDY_SITE_ADDRESS` to the public domain and
   `FGCSCOUT_FRONTEND_ORIGIN` to its `https://` URL. Keep
   `NEXT_PUBLIC_API_URL` empty for the recommended same-origin setup.
4. Start and verify the stack:

```powershell
docker compose --env-file .env -f docker-compose.prod.yml up --build -d --wait
node scripts/smoke-test.mjs
```

The public site is served by Caddy on ports 80/443. Frontend port 3000 is also bound to `127.0.0.1` on the
server to preserve existing host-managed Cloudflare Tunnel routes. It serves both
the site and `/api` through the existing backend rewrite. A healthy container
does not verify the tunnel's route to this listener.

The backend and MongoDB are not published directly. Caddy obtains and renews TLS certificates automatically
when a real domain is configured. For local production testing, set
`CADDY_SITE_ADDRESS=http://localhost` and browse `http://localhost`.

Production uses a separate `fgcscout_prod_mongo_data` volume, so an unsecured
development database is never silently reused. Import an existing season with
the admin panel or restore a verified production backup.

After a code or dependency update, rerun the same `up --build -d --wait`
command. Stop services without deleting data using
`docker compose --env-file .env -f docker-compose.prod.yml down`. Do not add
`--volumes` unless permanently deleting production data is intended.

## Backups and restore

Create an online compressed database backup:

```powershell
.\scripts\backup-mongodb.ps1
```

On macOS/Linux use `sh scripts/backup-mongodb.sh`. Backups are stored in the
ignored `backups/` directory. Copy them to encrypted off-server storage, schedule
the script daily, and regularly test a restore on a non-production machine.

Restore is intentionally interactive and replaces the database:

```powershell
.\scripts\restore-mongodb.ps1 -BackupFile .\backups\fgcscout-TIMESTAMP.archive.gz
```

On macOS/Linux use
`sh scripts/restore-mongodb.sh backups/fgcscout-TIMESTAMP.archive.gz`.

## Live season synchronization

Automatic video timestamps from concurrent field broadcasts are supported by the
optional [live-video worker](live-video/README.md). It retains detections until a
match appears in synchronized season data, then attaches the start and confirmed
end through the authenticated API.

Open `/admin`, enter the admin key, and add a season under **Live season
synchronization**. The current official JSON feed is `https://api.first.global/v1`. Sources must
use HTTPS and the `api.first.global` or `results.first.global` host;
this allowlist prevents the server from fetching arbitrary internal URLs.

Each stored season can also be exported from the admin panel as a reusable JSON
file in the same `{ "matches": [...] }` format accepted by the season importer.

Synchronization updates existing matches, inserts new matches, preserves
locally assigned YouTube links, and retains unknown game fields. The configured
year is checked against event keys to prevent importing a different season.

## Verification before publishing

Run these checks for every release:

```powershell
cd frontend
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run typecheck
npm run build

cd ..\backend
dotnet restore backend.csproj
dotnet build backend.csproj --configuration Release
dotnet list backend.csproj package --vulnerable --include-transitive
```

The GitHub Actions workflow also builds the real production stack, checks its
health, confirms public write endpoints reject unauthenticated requests, and
executes route smoke tests.

Before launch, verify:

- the privacy page names the actual operator, address, hosting provider and working contact address;
- the public domain, HTTPS redirect and certificate work from another network;
- a fresh backup exists and a restore has been tested;
- only ports 80, 443 and administrative SSH are open on the host;
- admin secrets are stored outside Git and rotated if exposed;
- event rankings, awards, match scoring and video embeds match the official
  season source on desktop and mobile.

## Security notes

All API mutations and every `/api/Admin` route require `X-Admin-Key`. Public
requests are rate-limited, responses are compressed, sensitive containers are
kept off the host network, MongoDB uses a least-privilege application user, and
the proxy/frontend apply browser security headers. The API limits imports to
25 MiB. Never commit `.env`, database archives or generated build directories.

## Archive playlist video timestamps

The [playlist-video tool](playlist-video/README.md) extracts per-match JSON
records with YouTube links, start timestamps and end timestamps from archived
field broadcasts. The supplied manifest covers the FGC 2025 playlist. These
archive detections can be reviewed before assigning videos to matches; the
archive tool exports JSON and does not automatically update the application.

## Match video administration

The `/admin` **Match videos** section has two tabs:

- **Historical recordings**: select a season and upload the playlist script's
  `matches.json` (or one match JSON). The script reads the match number from the broadcast overlay.
  Preview the automatic assignments, select the match for any unidentified
  recording, then import. Existing videos are protected;
  an interrupted upload can be safely repeated. The same file recognizes
  recordings already imported into this season, including their assignments.
- **Live streams**: set one YouTube URL per field, check the broadcast settings,
  enable watching and save. The worker uses these settings automatically; no
  per-event configuration file or running browser tab is required. The panel
  shows its heartbeat, each field's status and the pending recording count.

Production Compose starts the managed video worker with the application. For
local development, set the admin key and add `--profile videos` to the Compose
command. The standalone `live-video/compose.yml` remains available for operators
who prefer configuration files. Run only one worker for a given broadcast.

Configuration is persisted in MongoDB. The managed worker retains checkpoints
and pending detections in the `live_video_state` Docker volume and reconnects
using its last saved configuration when the API is temporarily unavailable.
Do not delete either volume. Back up the worker state volume along with the
MongoDB backup; retaining only the database loses unsent detections. Pausing
stops observation but keeps reconciling saved detections. Deleting a season
removes its live configuration so watching stops after the next refresh.

A stream outage can leave unrecoverable live gaps when old segments expire.
The panel reports retry/timeline errors; the worker never invents timestamps
for missing footage. Configure/verify the scoreboard crop and broadcast origin
for each year's streams before enabling watching. Automatic identity matching
currently supports Qualification and Ranking match names.

## FIRST Global 2026

`data-2026.json` is the supplied official API snapshot: 340 scheduled Ranking
Matches and 2 played Test Matches. Upload it under `/admin` to make the season
available. To receive subsequent results, configure the season's current official
results URL and enable synchronization; this snapshot itself does not update.

Match pages select Igniting Innovation scoring for 2026 and retain Eco Equilibrium
for 2025. Unplayed matches show teams, schedule and pending scores. Pages refresh
every 30 seconds; match tables refresh from their existing season polling.
The 2026 manual is linked beside the scoring explanation. Official scores and
bonuses come from the API; the suppression subtotal rounds up per the manual.

Archive imports and live reconciliation accept a unique match number without
requiring a field. Optional event/tournament keys disambiguate overlapping numbers.
Ambiguous numbers are never attached automatically. Fields still identify the
configured stream channels and appear in the match metadata provided by the API.
