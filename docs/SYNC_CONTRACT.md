# ACDC offline sync contract

The mobile app always writes locally before attempting a network operation.

## Mobile event fields

- `event_id`: client-generated UUID used for idempotency
- `entity_type`: product, stock movement, sale, customer, credit entry, expense, or settings
- `entity_id`: UUID of the changed record
- `action`: create, update, disable, or void
- `created_at`: device timestamp in ISO 8601 format
- `payload`: complete event payload

## Server endpoints

### `POST /api/method/acdc_backend.api.push_events`

Accepts a batch of offline events. The Frappe server records each `event_id` before applying it. Repeating an accepted event must return the original acknowledgement rather than duplicate a sale, payment, expense, or stock movement.

### `GET /api/method/acdc_backend.api.pull_changes?after_cursor=...`

Returns server changes after an opaque server-issued cursor. Device clocks are not used as synchronization cursors.

## Merge rules

- Sales, stock movements, credit entries, and expenses are append-only.
- A correction creates a reversal instead of rewriting the original transaction.
- Stock is recalculated from movements, never overwritten by the last device to sync.
- Product and customer edits use a server revision. The latest accepted edit wins only for the same field.
- Disabling a product wins over a stale ordinary edit.
- A hard-deleted unused product leaves a tombstone so an older phone cannot recreate it.
- A duplicate barcode is held under **Needs Attention** instead of blocking unrelated transactions.
