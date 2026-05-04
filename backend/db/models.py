from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


# ── Document ──────────────────────────────────────────────────────────────────

class DocumentBase(BaseModel):
    filename: str
    source_type: Literal["pdf", "url"]
    source_url: Optional[str] = None
    chunk_count: int = 0
    status: Literal["processing", "ready", "error"] = "processing"
    error_message: Optional[str] = None


class DocumentRecord(DocumentBase):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


# ── Chat session ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    sources: list[str] = []
    created_at: datetime = Field(default_factory=utcnow)


class SessionRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str = "New chat"
    doc_ids: list[str] = []
    messages: list[ChatMessage] = []
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


# ── Scrape job ────────────────────────────────────────────────────────────────

class ScrapeJobRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    url: str
    status: Literal["queued", "scraping", "indexing", "done", "error"] = "queued"
    doc_id: Optional[str] = None
    pages_scraped: int = 0
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


# ── API request / response schemas ────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    query: str
    doc_ids: list[str] = []


class ScrapeRequest(BaseModel):
    url: str
