from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    verify_password,
)
from app.deps import CurrentUser, DatabaseSession
from app.models import Membership, Team, User
from app.schemas import (
    LoginRequest,
    MeResponse,
    TeamMembershipRead,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DatabaseSession) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_HASH
    )
    if user is None or not password_ok or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser, db: DatabaseSession) -> MeResponse:
    rows = db.execute(
        select(Membership.team_id, Team.name, Membership.role)
        .join(Team, Team.id == Membership.team_id)
        .where(Membership.user_id == user.id)
        .order_by(Team.name)
    ).all()
    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        memberships=[
            TeamMembershipRead(team_id=team_id, team_name=name, role=role)
            for team_id, name, role in rows
        ],
    )