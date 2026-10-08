from functools import lru_cache
from threading import Lock

from fastembed import TextEmbedding
from config import get_settings

settings = get_settings()
_embedding_lock = Lock()


@lru_cache(maxsize=1)
def _get_model() -> TextEmbedding:
    return TextEmbedding(model_name=settings.EMBEDDING_MODEL, threads=1)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings locally on CPU."""
    if not texts:
        return []
    with _embedding_lock:
        vectors = _get_model().embed(texts, batch_size=8)
        return [vector.tolist() for vector in vectors]

def embed_query(query: str) -> list[float]:
    """Embed a single query."""
    res = embed_texts([query])
    return res[0] if res else []
