import re
from config import get_settings

settings = get_settings()


def clean_text(text: str) -> str:
    """Remove excessive whitespace and control characters."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def chunk_by_words(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[str]:
    """Split text into overlapping word-based chunks."""
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP

    text = clean_text(text)
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap

    return chunks


def chunk_by_paragraphs(
    text: str,
    max_words: int | None = None,
) -> list[str]:
    """
    Split by paragraphs first, then merge small paragraphs and split
    large ones so no chunk exceeds max_words.
    """
    max_words = max_words or settings.CHUNK_SIZE
    text = clean_text(text)

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for para in paragraphs:
        para_words = len(para.split())

        if para_words > max_words:
            # Flush current buffer first
            if current:
                chunks.append(" ".join(current))
                current, current_words = [], 0
            # Split the long paragraph by words
            sub = chunk_by_words(para, chunk_size=max_words, overlap=settings.CHUNK_OVERLAP)
            chunks.extend(sub)
            continue

        if current_words + para_words > max_words:
            chunks.append(" ".join(current))
            current, current_words = [], 0

        current.append(para)
        current_words += para_words

    if current:
        chunks.append(" ".join(current))

    return chunks
