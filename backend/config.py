from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "rag_app"

    # Groq
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "documents"

    # Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # RAG settings
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 75
    TOP_K_RESULTS: int = 6

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5174"]
    
    # ── Auth (Day 8) ──────────────────────────────────────────────────────
    # Generate a strong secret: python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60        # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7           # 7 days

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
