from sentence_transformers import SentenceTransformer
from functools import lru_cache
from config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    print(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
    return SentenceTransformer(settings.EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()
    return model.encode(texts, show_progress_bar=False).tolist()


def embed_query(query: str) -> list[float]:
    return embed_texts([query])[0]
