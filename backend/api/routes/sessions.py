from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.models import SessionRecord
from db.mongodb import sessions_col
from datetime import datetime, timezone

router = APIRouter(prefix="/sessions", tags=["sessions"])


class BulkDeleteRequest(BaseModel):
    session_ids: list[str]


@router.post("", response_model=SessionRecord)
async def create_session(doc_ids: list[str] | None = None):
    session = SessionRecord(doc_ids=doc_ids or [])
    await sessions_col().insert_one(session.model_dump())
    return session


@router.get("", response_model=list[SessionRecord])
async def list_sessions():
    cursor = sessions_col().find({}, {"_id": 0}).sort("updated_at", -1).limit(50)
    return [SessionRecord(**s) async for s in cursor]


@router.get("/{session_id}", response_model=SessionRecord)
async def get_session(session_id: str):
    session = await sessions_col().find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found.")
    return SessionRecord(**session)


@router.patch("/{session_id}/title")
async def rename_session(session_id: str, title: str):
    result = await sessions_col().update_one(
        {"id": session_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Session not found.")
    return {"message": "Title updated."}


@router.delete("/bulk")
async def bulk_delete_sessions(payload: BulkDeleteRequest):
    if not payload.session_ids:
        raise HTTPException(400, "No session IDs provided.")
    if len(payload.session_ids) > 50:
        raise HTTPException(400, "Cannot delete more than 50 sessions at once.")

    result = await sessions_col().delete_many({"id": {"$in": payload.session_ids}})
    return {
        "deleted": result.deleted_count,
        "message": f"Deleted {result.deleted_count} session(s).",
    }


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    result = await sessions_col().delete_one({"id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Session not found.")
    return {"message": "Session deleted."}
