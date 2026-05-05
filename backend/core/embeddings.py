import httpx
import time
from config import get_settings

settings = get_settings()

HF_API_URL = f"https://api-inference.huggingface.co/models/{settings.EMBEDDING_MODEL}"
HEADERS = {"Authorization": f"Bearer {settings.HF_TOKEN}"} if settings.HF_TOKEN else {}

def embed_texts(texts: list[str], retries: int = 3) -> list[list[float]]:
    """Get embeddings from HuggingFace Inference API."""
    if not texts:
        return []

    # If no token is provided, the API still works but is heavily rate-limited
    payload = {"inputs": texts, "options": {"wait_for_model": True}}
    
    for i in range(retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(HF_API_URL, headers=HEADERS, json=payload)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            if i == retries - 1:
                print(f"HF API Error after {retries} retries: {e}")
                raise e
            time.sleep(2 ** i)  # Exponential backoff

def embed_query(query: str) -> list[float]:
    """Embed a single query."""
    res = embed_texts([query])
    return res[0] if res else []
