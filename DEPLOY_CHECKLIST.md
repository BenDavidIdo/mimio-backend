# Mimo Backend Cloudflare Deploy Checklist

## Required before production analysis works

1. Set `BACKEND_API_KEY` (strong random secret).
2. Set `OPENWHOOP_ANALYSIS_URL` (your real upstream analysis service URL).

## Optional

- `OPENWHOOP_ANALYSIS_API_KEY` (if upstream requires auth).
- `RATE_LIMIT_WINDOW_MS` (default `60000`).
- `RATE_LIMIT_MAX` (default `60`).

## Set vars in Cloudflare

```bash
cd /Users/ido/Documents/dev/mimo/backend
wrangler secret put BACKEND_API_KEY
wrangler secret put OPENWHOOP_ANALYSIS_API_KEY
wrangler secret put OPENWHOOP_ANALYSIS_URL
```

If you prefer plaintext non-secret vars, use `wrangler.jsonc` `vars`, but secrets are recommended.

## Deploy

```bash
cd /Users/ido/Documents/dev/mimo/backend
npm run deploy
```

## Verify after deploy

1. `GET /health` returns `ok: true`.
2. `GET /analysis/upstream-health` returns `mode: "upstream"` and `ok: true`.
3. `POST /analysis/sleep` with valid payload returns summary + requestId.
