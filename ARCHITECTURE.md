# Backend Architecture (Mimo)

## SOURCE OF TRUTH: BackendServiceBoundaries

This backend runs as a Cloudflare Worker and owns orchestration and external-tool integration for analysis workflows.

## Boundaries

1. Route layer (`src/routes/*`)
   - Validates and normalizes HTTP input/output.
   - Applies request context and auth middleware.
   - No direct vendor calls.

2. Service layer (`src/services/*`)
   - Owns business orchestration and adapter selection.
   - Uses typed interfaces and stable result contracts.

3. Adapter layer (`src/services/openwhoop/*`)
   - Encapsulates upstream OpenWhoop analysis HTTP integration.
   - Worker/runtime code does not call vendor logic directly.

## Invariants

- iOS app talks to backend contracts, not raw algorithm binaries.
- External vendor/runtime specifics stay behind service boundaries.
- Route schemas remain stable even if implementation backend changes.
- `x-request-id` is present on responses for tracing.

## Failure modes

- Validation failure => `400 invalid_request`
- Adapter/service failure => non-2xx with contextual error and logs
- Upstream outages/timeouts => surfaced at adapter boundary
