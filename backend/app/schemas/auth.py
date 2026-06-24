from uuid import UUID

from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=10)


class LoginRequest(BaseModel):
    # Phone number or username — matched against either column.
    login: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class SetPasswordRequest(BaseModel):
    password: str = Field(min_length=6, max_length=128)
    # Optional username to use as the login. Only applied when the
    # account has no username yet — never clobbers an existing one.
    login: str | None = Field(default=None, max_length=64)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserMe(BaseModel):
    id: UUID
    telegram_id: int
    username: str = ""
    first_name: str
    last_name: str
    phone: str
    is_admin: bool = False

    class Config:
        from_attributes = True
