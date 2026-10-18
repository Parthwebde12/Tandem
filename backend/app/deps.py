from collections.abc import Callable
from typing import TYPE_CHECKING
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db import get_db
from app.models import Membership, TeamRole, User, WorkItem

if TYPE_CHECKING:
    from app.services.work_items import ItemContext

bearer = HTTPBearer(auto_error=False)
DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DatabaseSession,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_team_membership(
    team_id: UUID,
    user: CurrentUser,
    db: DatabaseSession,
) -> Membership:
    membership = db.get(Membership, (user.id, team_id))
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )
    return membership


TeamMembership = Annotated[Membership, Depends(get_team_membership)]


def require_team_role(
    *allowed_roles: TeamRole,
) -> Callable[[Membership], Membership]:
    if not allowed_roles:
        raise ValueError("At least one allowed team role is required.")

    def check_team_role(membership: TeamMembership) -> Membership:
        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient team role.",
            )
        return membership

    return check_team_role


def get_item_context(
    item_id: UUID,
    user: CurrentUser,
    db: DatabaseSession,
) -> "ItemContext":
    """Load an item only if the caller belongs to its team.

    Missing item and no membership give the SAME 404, so item existence
    is never leaked to outsiders.
    """
    from app.services.work_items import ItemContext

    item = db.get(WorkItem, item_id)
    membership = db.get(Membership, (user.id, item.team_id)) if item else None
    if item is None or membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found."
        )
    return ItemContext(item=item, membership=membership, user=user)


ItemAccess = Annotated["ItemContext", Depends(get_item_context)]
