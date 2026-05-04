import chromadb
from chromadb.config import Settings as ChromaSettings
from functools import lru_cache
from config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_DIR,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def upsert_chunks(
    ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
):
    col = get_collection()
    col.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query_similar(
    query_embedding: list[float],
    n_results: int,
    where: dict | None = None,
) -> dict:
    col = get_collection()
    params: dict = {
        "query_embeddings": [query_embedding],
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        params["where"] = where
    return col.query(**params)


def delete_by_doc_id(doc_id: str) -> int:
    col = get_collection()
    results = col.get(where={"doc_id": doc_id})
    if results["ids"]:
        col.delete(ids=results["ids"])
    return len(results["ids"])


def count_by_doc_id(doc_id: str) -> int:
    col = get_collection()
    results = col.get(where={"doc_id": doc_id})
    return len(results["ids"])
