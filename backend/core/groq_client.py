from groq import AsyncGroq
from functools import lru_cache
from typing import AsyncGenerator
from config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def get_groq_client() -> AsyncGroq:
    return AsyncGroq(api_key=settings.GROQ_API_KEY)


RAG_SYSTEM_PROMPT = """You are a precise and helpful document assistant.
Answer the user's question using ONLY the context provided below.
If the answer is not found in the context, clearly say: "I couldn't find this in the provided documents."
Be concise, factual, and cite which source the information came from when possible.
Format your response in clear paragraphs. Use bullet points only when listing multiple items."""

WEB_SYSTEM_PROMPT = """You are a helpful web research assistant.
Answer the user's question using ONLY the scraped web content provided below.
If the answer is not found in the content, clearly say: "I couldn't find this in the scraped content."
Be concise, factual, and mention the source URL when relevant."""


async def chat_completion(
    query: str,
    context: str,
    history: list[dict] | None = None,
    system_prompt: str = RAG_SYSTEM_PROMPT,
    max_tokens: int = 1024,
) -> str:
    """Non-streaming — returns full answer string."""
    client  = get_groq_client()
    history = history or []

    messages = [
        *history[-6:],
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]

    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "system", "content": system_prompt}, *messages],
        max_tokens=max_tokens,
        temperature=0.2,
    )
    return response.choices[0].message.content


async def chat_completion_stream(
    query: str,
    context: str,
    history: list[dict] | None = None,
    system_prompt: str = RAG_SYSTEM_PROMPT,
    max_tokens: int = 1024,
) -> AsyncGenerator[str, None]:
    """
    Streaming version — yields text chunks as they arrive from Groq.
    Each yielded value is a raw text delta string.
    """
    client  = get_groq_client()
    history = history or []

    messages = [
        *history[-6:],
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]

    stream = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "system", "content": system_prompt}, *messages],
        max_tokens=max_tokens,
        temperature=0.2,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
