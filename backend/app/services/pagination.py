"""Cursor helpers for stable, keyset-paginated API responses."""

import base64
import binascii
import json
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def encode_cursor(created_at: datetime, item_id: UUID) -> str:
    payload = json.dumps([created_at.isoformat(), str(item_id)]).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded_cursor = cursor + "=" * (-len(cursor) % 4)
        payload = base64.b64decode(padded_cursor, altchars=b"-_", validate=True)
        decoded = json.loads(payload.decode("utf-8"))
        if (
            not isinstance(decoded, list)
            or len(decoded) != 2
            or not all(isinstance(value, str) for value in decoded)
        ):
            raise ValueError("Cursor must contain a timestamp and UUID.")
        created_at = datetime.fromisoformat(decoded[0])
        item_id = UUID(decoded[1])
    except (binascii.Error, UnicodeDecodeError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid cursor.",
        ) from exc
    return created_at, item_id
