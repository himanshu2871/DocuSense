import PyPDF2
import io
from datetime import datetime, timezone

from db.mongodb import documents_col
from db.models import DocumentRecord
from core.chunker import chunk_by_paragraphs
from core.embeddings import embed_texts
from core.vector_store import upsert_chunks


async def ingest_pdf(file_bytes: bytes, filename: str) -> DocumentRecord:
    """Full PDF → chunk → embed → store pipeline."""

    # Create initial DB record
    record = DocumentRecord(filename=filename, source_type="pdf", status="processing")
    await documents_col().insert_one(record.model_dump())

    try:
        text = _extract_pdf_text(file_bytes)
        if not text:
            raise ValueError("No extractable text found in PDF.")

        chunks = chunk_by_paragraphs(text)
        if not chunks:
            raise ValueError("PDF produced no usable text chunks.")

        embeddings = embed_texts(chunks)

        ids = [f"{record.id}_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "doc_id": record.id,
                "filename": filename,
                "source_type": "pdf",
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]
        upsert_chunks(ids, embeddings, chunks, metadatas)

        # Update MongoDB record
        now = datetime.now(timezone.utc)
        await documents_col().update_one(
            {"id": record.id},
            {"$set": {"status": "ready", "chunk_count": len(chunks), "updated_at": now}},
        )
        record.status = "ready"
        record.chunk_count = len(chunks)

    except Exception as e:
        now = datetime.now(timezone.utc)
        await documents_col().update_one(
            {"id": record.id},
            {"$set": {"status": "error", "error_message": str(e), "updated_at": now}},
        )
        record.status = "error"
        record.error_message = str(e)

    return record


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            pages.append(t)
    return "\n\n".join(pages)
