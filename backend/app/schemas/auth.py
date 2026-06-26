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
    # Optional login — a username or a phone number — claimed as the standalone
    # login. Only applied when the matching column (username/phone) is still
    # empty; an existing login is never clobbered.
    login: str | None = Field(default=None, max_length=64)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserMe(BaseModel):
    id: UUID
    # None for Google/password-only accounts that never linked Telegram.
    telegram_id: int | None = None
    username: str = ""
    first_name: str
    last_name: str
    phone: str
    is_admin: bool = False
    # True once a password is set — the forced login+password setup is done.
    # The frontend gates the dashboard on this: False ⇒ send to /auth/setup.
    has_password: bool = False

    class Config:
        from_attributes = True
