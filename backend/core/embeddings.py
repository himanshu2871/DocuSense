import httpx
import time
from config import get_settings

settings = get_settings()

# Correct format for HuggingFace Inference API
HF_API_URL = f"https://api-inference.huggingface.co/models/{settings.EMBEDDING_MODEL}"
HEADERS = {"Authorization": f"Bearer {settings.HF_TOKEN}"} if settings.HF_TOKEN else {}

def embed_texts(texts: list[str], retries: int = 3) -> list[list[float]]:
    """Get embeddings from HuggingFace Inference API."""
    if not texts:
        return []

    # Simplified payload structure
    payload = {
        "inputs": texts,
        "options": {"wait_for_model": True, "use_cache": True}
    }
    
    for i in range(retries):
        try:
            with httpx.Client(timeout=90.0) as client:
                response = client.post(HF_API_URL, headers=HEADERS, json=payload)
                
                # If we get a 503, the model is still loading, so we wait and retry
                if response.status_code == 503:
                    time.sleep(10)
                    continue
                    
                response.raise_for_status()
                return response.json()
        except Exception as e:
            if i == retries - 1:
                print(f"HF API Error after {retries} retries: {e}")
                # Log the actual response body for better debugging
                if 'response' in locals() and response:
                    print(f"Response body: {response.text}")
                raise e
            time.sleep(2 ** i)

def embed_query(query: str) -> list[float]:
    """Embed a single query."""
    res = embed_texts([query])
    return res[0] if res else []
