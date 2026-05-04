import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from db.models import ChatRequest, ChatMessage
from db.mongodb import sessions_col
from core.embeddings import embed_query
from core.vector_store import query_similar
from core.groq_client import chat_completion, chat_completion_stream
from services.rag_service import rerank_chunks, deduplicate_chunks, RAG_SYSTEM_PROMPT
from config import get_settings
from datetime import datetime, timezone

settings = get_settings()
router   = APIRouter(prefix="/chat", tags=["chat"])


def _build_context(docs: list, metas: list) -> tuple[str, list[str]]:
    blocks = []
    for i, (doc, meta) in enumerate(zip(docs, metas), 1):
        src = meta.get("source_url") or meta.get("filename", "unknown")
        blocks.append(f"[{i}] Source: {src}\n{doc}")
    context = "\n\n---\n\n".join(blocks)
    sources = list({meta.get("source_url") or meta.get("filename", "unknown") for meta in metas})
    return context, sources


async def _get_rag_inputs(session_id: str, query: str, doc_ids: list[str]):
    session_doc = await sessions_col().find_one({"id": session_id})
    if not session_doc:
        raise ValueError(f"Session '{session_id}' not found.")

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in session_doc.get("messages", [])[-6:]
    ]

    q_emb   = embed_query(query)
    where   = {"doc_id": {"$in": doc_ids}} if doc_ids else None

    # Fetch 2× and re-rank
    fetch_k = min(settings.TOP_K_RESULTS * 2, 12)
    results = query_similar(q_emb, n_results=fetch_k, where=where)

    raw_docs  = results.get("documents", [[]])[0]
    raw_metas = results.get("metadatas",  [[]])[0]

    # Deduplicate
    seen_sets: list[set] = []
    deduped_docs, deduped_metas = [], []
    for doc, meta in zip(raw_docs, raw_metas):
        words = set(doc.lower().split())
        is_dupe = any(
            len(words & s) / len(words | s) >= 0.85
            for s in seen_sets if words and s
        )
        if not is_dupe:
            deduped_docs.append(doc)
            deduped_metas.append(meta)
            seen_sets.append(words)

    # Re-rank
    reranked_docs, confidence = rerank_chunks(query, deduped_docs, top_n=settings.TOP_K_RESULTS)
    doc_to_meta  = {d: m for d, m in zip(deduped_docs, deduped_metas)}
    final_metas  = [doc_to_meta.get(d, {}) for d in reranked_docs]

    return history, reranked_docs, final_metas, session_doc, confidence


async def _save_messages(session_id, query, answer, sources, is_first):
    now      = datetime.now(timezone.utc)
    user_msg = ChatMessage(role="user",      content=query)
    asst_msg = ChatMessage(role="assistant", content=answer, sources=sources)
    update: dict = {"updated_at": now}
    if is_first:
        update["title"] = query[:50] + ("…" if len(query) > 50 else "")
    await sessions_col().update_one(
        {"id": session_id},
        {
            "$push": {"messages": {"$each": [user_msg.model_dump(), asst_msg.model_dump()]}},
            "$set":  update,
        },
    )


# ── Non-streaming ─────────────────────────────────────────────────────────────

@router.post("")
async def chat(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(400, "Query cannot be empty.")
    try:
        history, docs, metas, session_doc, confidence = await _get_rag_inputs(
            payload.session_id, payload.query, payload.doc_ids
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    if not docs:
        return {"answer": "I couldn't find relevant content.", "sources": [], "chunks_used": 0, "confidence": 0.0}

    context, sources = _build_context(docs, metas)
    answer           = await chat_completion(payload.query, context, history, RAG_SYSTEM_PROMPT)
    is_first         = len(session_doc.get("messages", [])) == 0
    await _save_messages(payload.session_id, payload.query, answer, sources, is_first)
    return {"answer": answer, "sources": sources, "chunks_used": len(docs), "confidence": confidence}


# ── Streaming SSE ─────────────────────────────────────────────────────────────

@router.post("/stream")
async def chat_stream(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(400, "Query cannot be empty.")
    try:
        history, docs, metas, session_doc, confidence = await _get_rag_inputs(
            payload.session_id, payload.query, payload.doc_ids
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    if not docs:
        async def empty_stream():
            yield _sse({"type": "meta",  "sources": [], "chunks_used": 0, "confidence": 0.0})
            yield _sse({"type": "token", "content": "I couldn't find relevant content. Please upload documents or scrape a URL first."})
            yield _sse({"type": "done",  "content": ""})
        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    context, sources = _build_context(docs, metas)
    is_first         = len(session_doc.get("messages", [])) == 0

    async def event_generator():
        full_answer = []
        try:
            yield _sse({"type": "meta", "sources": sources,
                        "chunks_used": len(docs), "confidence": confidence})

            async for token in chat_completion_stream(
                query=payload.query, context=context,
                history=history, system_prompt=RAG_SYSTEM_PROMPT
            ):
                full_answer.append(token)
                yield _sse({"type": "token", "content": token})

            yield _sse({"type": "done", "content": ""})

            await _save_messages(
                payload.session_id, payload.query,
                "".join(full_answer), sources, is_first
            )
        except Exception as e:
            yield _sse({"type": "error", "content": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                 "Access-Control-Allow-Origin": "*"},
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
