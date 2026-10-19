from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.deps import CurrentUser, DatabaseSession
from app.models import Membership, Team, TeamRole, User
from app.schemas import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    SignupOptions,
    SignupTeam,
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


@router.get("/signup-options", response_model=SignupOptions)
def signup_options(db: DatabaseSession) -> SignupOptions:
    """What the sign-up form may offer. Empty unless demo sign-up is enabled."""
    if not settings.open_signup:
        return SignupOptions(enabled=False, teams=[], roles=[])
    teams = db.execute(select(Team.id, Team.name).order_by(Team.name)).all()
    return SignupOptions(
        enabled=True,
        teams=[SignupTeam(id=team_id, name=name) for team_id, name in teams],
        roles=list(TeamRole),
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: DatabaseSession) -> TokenResponse:
    """Demo sign-up: the person chooses their own name, email, team and role."""
    if not settings.open_signup:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Sign-up is closed."
        )
    if db.get(Team, payload.team_id) is None:
        raise HTTPException(422, detail="Choose a valid team.")
    if db.scalar(select(User.id).where(User.email == payload.email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()  # the unique index settles a simultaneous sign-up with the same email
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.add(Membership(user_id=user.id, team_id=payload.team_id, role=payload.role))
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id))