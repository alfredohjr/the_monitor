from datetime import datetime

from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    mensagem: str = Field(max_length=255)
    lida: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
