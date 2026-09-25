"""Mobile synchronization endpoints for ACDC.

This scaffold intentionally stores accepted event IDs separately from business
document application. Deploying the backend requires the Frappe DocTypes and
entity handlers described in docs/SYNC_CONTRACT.md.
"""

from __future__ import annotations

import json
from typing import Any

import frappe


def _as_list(value: str | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, list):
        frappe.throw("events must be a JSON array")
    return value


@frappe.whitelist(methods=["POST"])
def push_events(events: str | list[dict[str, Any]]) -> dict[str, Any]:
    """Validate an offline batch and return deterministic acknowledgements.

    Event application is intentionally explicit: handlers should be added per
    entity type once the matching DocTypes are installed. Until then this
    endpoint rejects the batch rather than pretending data was synchronized.
    """

    parsed = _as_list(events)
    required = {"event_id", "entity_type", "entity_id", "action", "created_at", "payload"}
    for index, event in enumerate(parsed):
        missing = sorted(required.difference(event))
        if missing:
            frappe.throw(f"Event {index + 1} is missing: {', '.join(missing)}")

    return {
        "accepted": [],
        "rejected": [
            {
                "event_id": event["event_id"],
                "message": "The ACDC Frappe entity handlers are not installed yet.",
            }
            for event in parsed
        ],
        "cursor": None,
    }


@frappe.whitelist(methods=["GET"])
def pull_changes(after_cursor: str | None = None) -> dict[str, Any]:
    """Return server changes after an opaque cursor.

    The empty response keeps the contract stable while the first server-side
    DocTypes are being implemented.
    """

    return {"changes": [], "tombstones": [], "cursor": after_cursor}
