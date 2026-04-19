from uuid import UUID

from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=10)


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
