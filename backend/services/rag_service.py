from functools import lru_cache
from db.mongodb import sessions_col
from db.models import ChatMessage
from core.embeddings import embed_query
from core.vector_store import query_similar
from core.groq_client import chat_completion
from config import get_settings
from datetime import datetime, timezone

settings = get_settings()


# ── CrossEncoder re-ranker (lazy-loaded on first use) ─────────────────────────

@lru_cache(maxsize=1)
def _get_reranker():
    """Load CrossEncoder once and cache it — avoids blocking startup."""
    from sentence_transformers import CrossEncoder
    print("Loading CrossEncoder re-ranker...")
    return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def rerank_chunks(query: str, chunks: list[str], top_n: int = 5) -> tuple[list[str], float]:
    """
    Re-rank chunks using cross-encoder and return:
    - top_n most relevant chunks (sorted by score)
    - confidence score (0-1, normalised from top chunk score)
    """
    if not chunks:
        return [], 0.0

    try:
        ranker = _get_reranker()
        pairs  = [[query, chunk] for chunk in chunks]
        scores = ranker.predict(pairs).tolist()

        # Sort by score descending
        ranked = sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)
        top    = ranked[:top_n]

        # Normalise top score to 0-1 range using sigmoid
        import math
        top_score  = top[0][0] if top else 0.0
        confidence = round(1 / (1 + math.exp(-top_score * 0.1)), 2)  # sigmoid normalisation
        confidence = min(max(confidence, 0.0), 1.0)

        return [chunk for _, chunk in top], confidence

    except Exception as e:
        print(f"Re-ranking failed, using original order: {e}")
        return chunks[:top_n], 0.5


def deduplicate_chunks(chunks: list[str], threshold: float = 0.85) -> list[str]:
    """
    Remove near-duplicate chunks based on word overlap (Jaccard similarity).
    Keeps the first occurrence of similar chunks.
    """
    if not chunks:
        return []

    unique = []
    seen_sets: list[set] = []

    for chunk in chunks:
        words = set(chunk.lower().split())
        is_dupe = False
        for seen in seen_sets:
            if not words or not seen:
                continue
            jaccard = len(words & seen) / len(words | seen)
            if jaccard >= threshold:
                is_dupe = True
                break
        if not is_dupe:
            unique.append(chunk)
            seen_sets.append(words)

    return unique


# ── RAG SYSTEM PROMPT with [1][2] citation format ─────────────────────────────

RAG_SYSTEM_PROMPT = """You are a precise and helpful document assistant.
Answer the user's question using ONLY the context provided below.
When citing information, reference the source number like [1], [2], etc.
If the answer is not in the context, say: "I couldn't find this in the provided documents."
Be concise, factual, and well-structured. Use bullet points only when listing multiple items."""


async def answer_query(
    session_id: str,
    query: str,
    doc_ids: list[str],
) -> dict:
    """
    Full RAG pipeline with re-ranking:
    1. Embed query
    2. Retrieve top-K chunks from ChromaDB (fetch more than needed)
    3. Deduplicate chunks
    4. CrossEncoder re-rank → keep top-N
    5. Build context + call Groq
    6. Persist to MongoDB
    """
    session_doc = await sessions_col().find_one({"id": session_id})
    if not session_doc:
        raise ValueError(f"Session '{session_id}' not found.")

    existing_messages = session_doc.get("messages", [])
    is_first_message  = len(existing_messages) == 0

    history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in existing_messages[-6:]
    ]

    # ── Step 1: Retrieve more chunks than needed (for re-ranking) ─────────
    fetch_k = min(settings.TOP_K_RESULTS * 2, 12)  # fetch 2× then re-rank down
    q_emb   = embed_query(query)
    where   = {"doc_id": {"$in": doc_ids}} if doc_ids else None
    results = query_similar(q_emb, n_results=fetch_k, where=where)

    docs  = results.get("documents", [[]])[0]
    metas = results.get("metadatas",  [[]])[0]

    if not docs:
        return {
            "answer":     "I couldn't find relevant content. Please upload documents or scrape a URL first.",
            "sources":    [],
            "chunks_used": 0,
            "confidence":  0.0,
        }

    # ── Step 2: Deduplicate ───────────────────────────────────────────────
    # Keep metas aligned with docs after dedup
    seen_sets: list[set] = []
    deduped_docs, deduped_metas = [], []
    for doc, meta in zip(docs, metas):
        words = set(doc.lower().split())
        is_dupe = any(
            len(words & s) / len(words | s) >= 0.85
            for s in seen_sets if words and s
        )
        if not is_dupe:
            deduped_docs.append(doc)
            deduped_metas.append(meta)
            seen_sets.append(words)

    # ── Step 3: CrossEncoder re-rank ──────────────────────────────────────
    reranked_docs, confidence = rerank_chunks(
        query, deduped_docs, top_n=settings.TOP_K_RESULTS
    )

    # Re-align metas to match reranked order
    doc_to_meta = {d: m for d, m in zip(deduped_docs, deduped_metas)}
    final_metas = [doc_to_meta.get(d, {}) for d in reranked_docs]

    # ── Step 4: Build numbered context ───────────────────────────────────
    context_blocks = []
    for i, (doc, meta) in enumerate(zip(reranked_docs, final_metas), 1):
        src = meta.get("source_url") or meta.get("filename", "unknown")
        context_blocks.append(f"[{i}] Source: {src}\n{doc}")
    context = "\n\n---\n\n".join(context_blocks)

    sources = list({
        meta.get("source_url") or meta.get("filename", "unknown")
        for meta in final_metas
    })

    # ── Step 5: Call Groq ─────────────────────────────────────────────────
    answer = await chat_completion(
        query=query,
        context=context,
        history=history,
        system_prompt=RAG_SYSTEM_PROMPT,
    )

    # ── Step 6: Persist to MongoDB ────────────────────────────────────────
    now      = datetime.now(timezone.utc)
    user_msg = ChatMessage(role="user",      content=query)
    asst_msg = ChatMessage(role="assistant", content=answer, sources=sources)

    update_fields: dict = {"updated_at": now}
    if is_first_message:
        update_fields["title"] = query[:50] + ("…" if len(query) > 50 else "")

    await sessions_col().update_one(
        {"id": session_id},
        {
            "$push": {"messages": {"$each": [user_msg.model_dump(), asst_msg.model_dump()]}},
            "$set":  update_fields,
        },
    )

    return {
        "answer":      answer,
        "sources":     sources,
        "chunks_used": len(reranked_docs),
        "confidence":  confidence,
    }
