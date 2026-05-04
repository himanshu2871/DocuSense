from fastapi import APIRouter, UploadFile, File, HTTPException
from db.mongodb import documents_col
from db.models import DocumentRecord
from core.vector_store import delete_by_doc_id
from services.document_service import ingest_pdf
from datetime import datetime, timezone

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentRecord)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:  # 50 MB
        raise HTTPException(413, "File too large. Maximum size is 50 MB.")

    record = await ingest_pdf(contents, file.filename)
    if record.status == "error":
        raise HTTPException(422, record.error_message or "Failed to process PDF.")
    return record


@router.get("", response_model=list[DocumentRecord])
async def list_documents():
    cursor = documents_col().find({}, {"_id": 0}).sort("created_at", -1)
    return [DocumentRecord(**doc) async for doc in cursor]


@router.get("/{doc_id}", response_model=DocumentRecord)
async def get_document(doc_id: str):
    doc = await documents_col().find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found.")
    return DocumentRecord(**doc)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    doc = await documents_col().find_one({"id": doc_id})
    if not doc:
        raise HTTPException(404, "Document not found.")

    chunks_removed = delete_by_doc_id(doc_id)
    await documents_col().delete_one({"id": doc_id})
    return {"message": f"Deleted document and {chunks_removed} vector chunks."}
