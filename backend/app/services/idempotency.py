"""Idempotency-Key support.

The key row is inserted in the SAME transaction as the action and committed
with it, so "action happened" and "key stored" are one atomic fact.
A concurrent request with the same key blocks on the unique index until the
first one commits, then replays the stored response.
"""

import hashlib
import json
from collections.abc import Callable
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import IdempotencyKey, User


def fingerprint(request: Request, body: BaseModel | None) -> str:
    payload = body.model_dump(mode="json") if body is not None else None
    raw = json.dumps(
        {"m": request.method, "p": request.url.path, "b": payload},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def run_idempotent(
    db: Session,
    user: User,
    key: str | None,
    request_hash: str,
    action: Callable[[], Any],
    success_status: int = status.HTTP_200_OK,
) -> JSONResponse:
    if key is None:
        try:
            body = jsonable_encoder(action())
            db.commit()
        except Exception:
            db.rollback()
            raise
        return JSONResponse(status_code=success_status, content=body)

    claimed = db.execute(
        pg_insert(IdempotencyKey)
        .values(id=uuid4(), user_id=user.id, key=key, request_hash=request_hash)
        .on_conflict_do_nothing(constraint="uq_idempotency_user_key")
        .returning(IdempotencyKey.id)
    ).first()

    if claimed is None:
        existing = db.scalar(
            select(IdempotencyKey).where(
                IdempotencyKey.user_id == user.id, IdempotencyKey.key == key
            )
        )
        db.rollback()
        if existing is None or existing.request_hash != request_hash:
            raise HTTPException(
                422,
                detail="Idempotency-Key was already used with a different request.",
            )
        if existing.response_status is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="A request with this Idempotency-Key is still in progress.",
            )
        return JSONResponse(
            status_code=existing.response_status,
            content=existing.response_body,
            headers={"Idempotent-Replay": "true"},
        )

    try:
        body = jsonable_encoder(action())
        db.execute(
            update(IdempotencyKey)
            .where(IdempotencyKey.id == claimed.id)
            .values(response_status=success_status, response_body=body)
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=success_status, content=body)