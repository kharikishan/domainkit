---
name: webhooks
description: Webhook endpoint registration, event delivery, and retry logic
domainkit-domain: webhooks
domainkit-dependencies: auth
domainkit-code-paths: src/modules/webhooks/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Webhooks

## Data Models

`WebhookEndpoint`: `id`, `userId`, `url`, `events` (array of event type strings), `secret` (32-byte random, stored encrypted), `status` (active/paused/disabled), `createdAt`, `updatedAt`, `disabledAt` (nullable), `disabledReason` (nullable).

`WebhookDelivery`: `id`, `endpointId`, `eventType`, `eventId`, `payload` (JSON), `status` (pending/delivered/failed), `httpStatus` (nullable), `responseBody` (truncated to 1KB), `attemptCount`, `nextRetryAt` (nullable), `deliveredAt` (nullable), `createdAt`.

`secret` is used to generate HMAC-SHA256 signatures on outbound payloads. It is shown to the user once at endpoint creation and never returned in subsequent reads.

## Business Rules

**Endpoint registration:** A user can register up to 10 webhook endpoints per account (configurable). Each endpoint subscribes to a list of event types. Wildcard subscriptions (`*`) are not supported — event types must be listed explicitly.

**Delivery:**
1. When an event fires internally, the system finds all `active` endpoints subscribed to that event type.
2. For each endpoint, a `WebhookDelivery` record is created with status `pending` and the payload enqueued.
3. The delivery worker posts the payload to the endpoint URL with a 10-second timeout.
4. The request includes headers: `X-Webhook-Event: <eventType>`, `X-Webhook-Delivery: <deliveryId>`, `X-Webhook-Signature-256: sha256=<hmac>`, `X-Webhook-Timestamp: <unix epoch>`.
5. A `2xx` response marks the delivery as `delivered`. Any other response (including timeout) is treated as failure.

**Retry schedule:** Exponential backoff with jitter: 30s, 5m, 30m, 2h, 8h. After 5 failed attempts, status is set to `failed` (terminal). No more retries. If an endpoint accumulates more than 25 consecutive failures across recent deliveries, `status` is set to `disabled` and `disabledReason: "too_many_failures"`.

**Signature verification for consumers:** Payload is `JSON.stringify(body)`. HMAC input is `${timestamp}.${payload}`. Consumers must verify the timestamp is within 300 seconds of current time to prevent replay attacks.

**Idempotency:** Each delivery attempt sends the same `deliveryId` in `X-Webhook-Delivery`. Consumer endpoints should be idempotent on this ID.

## API Surface

`GET /api/webhooks` — list registered endpoints for authenticated user.
`POST /api/webhooks` — register a new endpoint; secret returned once.
`GET /api/webhooks/:id` — endpoint metadata (no secret).
`PUT /api/webhooks/:id` — update URL, events list, or status.
`DELETE /api/webhooks/:id` — delete endpoint and stop future deliveries.
`POST /api/webhooks/:id/test` — send a test ping payload to the endpoint immediately (does not create a `WebhookDelivery` record).
`GET /api/webhooks/:id/deliveries` — list recent delivery attempts; filter by `?status=`, `?eventType=`.
`POST /api/webhooks/:id/deliveries/:deliveryId/redeliver` — manually trigger a re-delivery of a failed delivery.

## Gotchas

- Never log the raw webhook secret. Log the endpoint `id` only.
- The HMAC signature must include the timestamp prefix (`timestamp.payload`) — a naive implementation signing only the payload is vulnerable to replay attacks.
- Delivery worker timeout is 10 seconds. Some consumer endpoints are slow. Do not increase the timeout globally — it ties up workers. If a consumer needs a longer window, they should accept the webhook and process asynchronously.
- When an endpoint is `disabled`, do not continue to enqueue deliveries to it. Check `status` before enqueuing, not only before sending — otherwise the queue fills with undeliverable items.
- Manual re-delivery via the API creates a new `WebhookDelivery` record (new ID) rather than retrying the old one. This means the consumer may receive the same logical event with two different `deliveryId` values. Consumer idempotency should key on the business `eventId`, not the `deliveryId`.

## Testing Priorities

1. Signature verification: correct HMAC accepted; wrong secret rejected; timestamp outside 300s rejected.
2. Retry backoff timing: verify each of the 5 retry delays is correctly scheduled with jitter bounds.
3. Auto-disable: endpoint disabled after 25 consecutive failures across deliveries.
4. Endpoint limit enforcement: 11th endpoint registration is rejected.
5. Manual re-delivery: creates new delivery record, sends payload, updates status correctly.
