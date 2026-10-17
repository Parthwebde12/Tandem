from uuid import UUID

from pydantic import BaseModel

from app.models import TeamRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TeamMembershipRead(BaseModel):
    team_id: UUID
    team_name: str
    role: TeamRole


class MeResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    memberships: list[TeamMembershipRead]