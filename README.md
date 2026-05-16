# Mimo Backend (Cloudflare Worker)

Cloudflare Worker backend workspace for analytics orchestration and service adapters used by the iOS app.

## Purpose

- Keep iOS app focused on capture + UX.
- Move heavier analysis and orchestration into a service boundary.
- Centralize external integrations (OpenWhoop CLI today, optional cloud services later).

## Quick start (Cloudflare)

```bash
cd /Users/ido/Documents/dev/mimo/backend
npm install
npm run dev
```

Deploy:

```bash
cd /Users/ido/Documents/dev/mimo/backend
npm run deploy
```

Pre-deploy values you need are listed in:
`/Users/ido/Documents/dev/mimo/backend/DEPLOY_CHECKLIST.md`

## Configure upstream analysis

Because Cloudflare Workers cannot execute local CLI binaries, OpenWhoop analysis is called through HTTP.

Set these in Cloudflare (or `.dev.vars` for local dev):

- `OPENWHOOP_ANALYSIS_URL`
- `OPENWHOOP_ANALYSIS_API_KEY` (optional)
- `BACKEND_API_KEY` (optional but recommended)

If unset, backend falls back to mock analysis responses.

If `BACKEND_API_KEY` is set, send:

`Authorization: Bearer <BACKEND_API_KEY>`

## Endpoints

- `GET /health`
- `GET /openapi.json`
- `GET /analysis/upstream-health`
- `GET /analysis/library-catalog`
- `POST /analysis/sleep`
- `POST /analysis/clean-window`
- `POST /analysis/reprocess-history`

All responses include `x-request-id` header for tracing.

Sample request:

```json
{
  "dbPath": "/tmp/openwhoop-data/openwhoop.db",
  "startIso": "2026-05-15T00:00:00Z",
  "endIso": "2026-05-16T00:00:00Z"
}
```

Sample curl:

```bash
curl -X POST "https://<your-worker>.workers.dev/analysis/sleep" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <BACKEND_API_KEY>" \
  -d '{"dbPath":"/tmp/openwhoop-data/openwhoop.db"}'
```

Historical reprocess sample:

```bash
curl -X POST "https://<your-worker>.workers.dev/analysis/reprocess-history" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <BACKEND_API_KEY>" \
  -d '{
    "heartRate":[
      {"time":"2026-05-16T00:00:00Z","value":65},
      {"time":"2026-05-16T00:00:10Z","value":66}
    ],
    "gravity":[
      {"time":"2026-05-16T00:00:00Z","x":0.0,"y":0.0,"z":1.0},
      {"time":"2026-05-16T00:00:10Z","x":0.001,"y":0.001,"z":1.001}
    ]
  }'
```

## Layout

- `src/services/openwhoop`: upstream analysis gateway boundary
- `src/services/sleep`: sleep-analysis orchestration
- `src/routes`: HTTP route layer
- `src/config`: env validation and runtime config

See `/Users/ido/Documents/dev/mimo/backend/ARCHITECTURE.md` for the architecture contract.
