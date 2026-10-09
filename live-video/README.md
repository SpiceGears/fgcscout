# FGCScout — automatic live match videos

## Admin-managed mode

The main production Compose stack runs `managed.py` automatically. Configure
streams in `/admin` → **Match videos** → **Live streams**. Settings are fetched
from the authenticated API every 20 seconds and cached on disk for recovery.
Each season has its own SQLite database, with WAL and FULL synchronization,
in the persistent `live_video_state` volume. Pending detections still reconcile
when watching is paused. Worker status is reported to the admin panel; a stale
heartbeat is shown as disconnected, so saved settings are not confused with an
actually running observer.

For local development use `docker compose --profile videos -f
docker-compose.dev.yml up --build` from the repository root, with the admin key
set in `.env`. The sections below document the alternative standalone mode;
do not run it alongside managed mode for the same broadcast.


This is version 2 of the video detector, integrated with FGCScout at commit
`618781a49565dfe29dec8241f3c070240439d63a`.

Each configured field has a concurrent HLS reader. The worker samples the image,
reads the clock and `Match N | Field F` footer, and confirms several consistent
observations before recognizing a match. It does not download the entire broadcast.
A SQLite queue retains detections, unfinished games and segment checkpoints across
restarts. Global results continue to be imported by FGCScout's existing season sync.
The worker polls FGCScout every 15 seconds and attaches a recording as soon as
exactly one imported match has the same match number, field and configured scope.
A start can be attached while the game is running; an end is added after seeing zero.

## Install and configure

Apply the accompanying repository patch or use the updated source archive, then
build and deploy the changed FGCScout backend/frontend normally. Both sides are
needed: the original player discarded URL timestamps and the original backend did
not persist timestamp/status fields. The worker checks the authenticated
`GET /api/admin/video-capabilities` endpoint before sending updates.

On the machine that will watch the streams:

```bash
cd live-video
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp config.example.json config.json
```

Install `ffmpeg` and `tesseract` with the English OCR language (`eng`). On macOS:
`brew install ffmpeg tesseract`. Set `YT_DLP` to the full path of `.venv/bin/yt-dlp`
(or put `.venv/bin` on PATH).

In `config.json`, set `api_url` to your FGCScout API and `year` to the season.
Replace the example URLs with the actual field broadcasts. Add another object in
`streams` for each field. Different fields are watched concurrently.

```json
{
  "field": 3,
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "match_duration": 150,
  "event_key": "THE_EXACT_EVENT_KEY_FROM_API",
  "tournament_key": "THE_EXACT_TOURNAMENT_KEY_FROM_API",
  "name_pattern": "Qualification Match (\\d+)"
}
```

`event_key` and `tournament_key` are optional when the match number and field
uniquely identify one record in the selected season. Specify them for separate
phases or events with overlapping match numbers. The Greece sample in `data.json`
uses `FGC_2024-FGC-CMP`, `t1`, `Qualification Match 1` and `field: 1`.
The default name pattern accepts Qualification and Ranking matches. Change it for
playoff naming rather than matching games by approximate scheduled times.

Provide the existing admin key through the environment, not through the config:

```bash
export FGCSCOUT_ADMIN_API_KEY='YOUR_EXISTING_ADMIN_KEY'
export YT_DLP="$PWD/.venv/bin/yt-dlp"
.venv/bin/python worker.py --config config.json --check
.venv/bin/python worker.py --config config.json --probe
.venv/bin/python worker.py --config config.json
```

`--check` validates without contacting streams or writing to the API. `--probe`
prints recent HLS sequence numbers and time metadata without attaching videos.
A JSON snapshot appears beside `state/live.sqlite3` as `state/live.json`.
`pending_reason` distinguishes absent API data, ambiguous identities and conflicts
with another assigned recording. Never delete the SQLite file to resolve an API
outage: queued detections remain available for retry.

## Absolute stream timestamps

A worker's launch time is not the beginning of a YouTube video. This version uses
HLS program date/time minus the broadcast's start (`release_timestamp` from yt-dlp)
when both are available. You can set `origin_utc`, with a timezone, to an explicitly
calibrated UTC time of video timestamp zero. YouTube metadata and live manifests
must be checked against the player's timeline for each broadcaster; this has not
been verified on the upcoming 2026 streams.

On startup, anchored streams are scanned from the beginning of the currently
available HLS/DVR window, then followed live. Restarting resumes saved checkpoints;
re-entering the same URL does not erase them. This can recover missed games still
in that window, but cannot recover segments YouTube has already removed. Use the
archive scanner and admin import for those after the VOD becomes available.

When program date/time is absent, the worker can count segment durations if it
observes sequence zero or knows a segment's absolute start. For example:

```json
{"anchor_sequence": 1234, "anchor_timestamp": 3600.0}
```

This means that **the start of HLS segment 1234** corresponds to video second 3600.
It is not the time when the worker was started. Use `--probe` to inspect sequence
numbers and calibrate against the player. Sequence numbering alone is never
multiplied by a guessed segment duration. At an HLS discontinuity, a fresh
program date/time tag and the broadcast origin automatically re-anchor the next
segment. A timestamp extrapolated from the previous encoding is discarded at
the boundary. Without a fresh UTC tag or an explicit sequence anchor, that field
reports a retry status rather than manufacturing timestamps. If a broadcaster restarts/reset its segment numbering, use
its new watch URL or a fresh state file after recalibrating.

During a live broadcast, YouTube must have DVR enabled for seeking to earlier
moments. After the broadcast, trimming/editing the archive can change its timeline;
recheck the timestamps if the organizer edits the VOD.

## Scoreboard layout

The supplied normalized ROIs and footer pattern were checked against the 2025
broadcasts, including fields 1/2/5. **Calibrate them on the first 2026 broadcast**;
the upcoming graphics have not yet been inspected. Set `match_duration` to that
season's real clock duration. ROIs are `[left, top, width, height]` with values
between 0 and 1. `clock_roi` must contain only the clock. `identity_roi` must contain
the match number and field; `overlay_pattern` must capture those as groups 1 and 2.

An unreadable identity stays unmatched. Multiple consistent clock readings are
required. A stopped clock or a missing ending becomes `interrupted` with no invented
end timestamp. Replays get distinct detection IDs; the worker does not replace
another recording already assigned to that match. An operator can review pending
replays in the snapshot and assign the preferred recording manually.

This reader supports unencrypted, complete HLS segments (TS and initialization-map
fMP4). Encrypted streams and byte-range playlists are reported as unsupported.
Expired media URLs are resolved again. Temporary segment files are discarded;
SQLite holds the durable metadata rather than the full videos.

## App integration

The authenticated video PUT remains at `/api/admin/matches/{mongoId}/video` and
accepts the existing `videoUrl` plus:

```json
{
  "startTimestamp": 265.0,
  "endTimestamp": 415.0,
  "status": "complete",
  "detectionId": "stable-detection-id",
  "onlyIfEmpty": true
}
```

Public match data contains `videoStartTimestamp`, `videoEndTimestamp`,
`videoStatus` and `videoDetectionId`. While live, endTimestamp is null. The endpoint
atomically accepts an empty match or a revision of the same detection; a conflicting
recording returns 409. Manual editing keeps the previous URL-only contract.
Season sync updates source fields without replacing local video fields, avoiding
a race with concurrent video updates. The player passes `start` and `end` into the
YouTube embed. A user sees the new metadata on the app's existing refresh cycle;
the match details page refreshes every 30 seconds, in addition to worker/API sync.

## Docker

`compose.yml` runs the worker separately with a persistent named state volume.
Create `config.json`, point it at the published HTTPS FGCScout API, and set the
existing admin key in the shell or a local `.env`:

```bash
docker compose -f compose.yml up --build -d
```

The worker container exposes no ports. On localhost development, run Python
natively as above; `localhost` inside a separate container refers to that container.
Changing the streams config requires restarting the worker. Keep the state volume.

## Verification

```bash
.venv/bin/python -m unittest discover -s . -v
```

Seven tests cover delayed API imports, persisted queues, start/end transitions,
ambiguous identities, exact matching against the Greece sample, held clocks,
field mismatches, manual conflicts and absolute HLS anchors/gaps.
The implementation was also tested with a local HLS replay of actual 2025 footage:
OCR read Match 1 / Field 1, then a mock FGCScout API received start 265 seconds,
followed by end 415 seconds when the clock reached zero. This is an integration
fixture, not a claim that a 2024 match was played in that 2025 footage.
The .NET 10 backend builds successfully; frontend typecheck and lint passed.
Live 2026 YouTube streams and a production MongoDB installation have not been
exercised in this session. Actual stream URLs, scoreboard calibration and your
FGCScout API/admin-key configuration are still needed to operate the service.
