from functools import lru_cache

from fastembed import TextEmbedding
from config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _get_model() -> TextEmbedding:
    return TextEmbedding(model_name=settings.EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings locally on CPU."""
    if not texts:
        return []
    vectors = _get_model().embed(texts, batch_size=32)
    return [vector.tolist() for vector in vectors]

def embed_query(query: str) -> list[float]:
    """Embed a single query."""
    res = embed_texts([query])
    return res[0] if res else []
