from datetime import datetime, timezone
from typing import Literal

from db.mongodb import documents_col, scrape_jobs_col
from db.models import DocumentRecord, ScrapeJobRecord
from core.scraper import scrape_url, scrape_site
from core.chunker import chunk_by_paragraphs
from core.embeddings import embed_texts
from core.vector_store import upsert_chunks

# Sites that always need Playwright regardless of mode
ALWAYS_JS_DOMAINS = {
    "en.wikipedia.org",
    "wikipedia.org",
    "www.wikipedia.org",
    "msn.com",
    "www.msn.com",
    "apple.com",
    "www.apple.com",
    "medium.com",
    "www.medium.com",
    "substack.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "linkedin.com",
    "reddit.com",
    "www.reddit.com",
}


def _needs_playwright(url: str, mode: str) -> bool:
    """Returns True if this URL should use Playwright."""
    if mode == "js":
        return True
    if mode == "fast":
        return False
    # auto mode — check known blocked domains
    from urllib.parse import urlparse
    domain = urlparse(url).netloc.lower()
    return domain in ALWAYS_JS_DOMAINS


async def ingest_url(
    url: str,
    crawl: bool = False,
    max_pages: int = 10,
    mode: Literal["auto", "fast", "js"] = "auto",
) -> ScrapeJobRecord:
    """
    Scrape a URL (or site), chunk, embed, store.
    mode: "auto" | "fast" | "js"
    """
    job = ScrapeJobRecord(url=url, status="scraping")
    await scrape_jobs_col().insert_one(job.model_dump())

    try:
        use_playwright = _needs_playwright(url, mode)
        print(f"[scraper] mode={mode}, use_playwright={use_playwright}, url={url}")

        # ── Scrape ────────────────────────────────────────────────────────
        if crawl:
            if use_playwright:
                from core.playwright_scraper import scrape_js_site
                pages = await scrape_js_site(url, max_pages=max_pages)
            else:
                pages = await scrape_site(url, max_pages=max_pages)
        else:
            if use_playwright:
                from core.playwright_scraper import scrape_with_playwright
                title, text = await scrape_with_playwright(url)
            else:
                title, text = await scrape_url(url)

            pages = [{"url": url, "title": title or url, "text": text}]

        if not pages:
            raise ValueError("No content found at the provided URL.")

        # Validate we got real content
        total_words = sum(len(p["text"].split()) for p in pages)
        if total_words < 30:
            # Auto-retry with Playwright if httpx got nothing
            if not use_playwright and mode == "auto":
                print(f"[scraper] httpx got {total_words} words, retrying with Playwright...")
                from core.playwright_scraper import scrape_with_playwright
                title, text = await scrape_with_playwright(url)
                pages = [{"url": url, "title": title or url, "text": text}]
                total_words = len(text.split())

            if total_words < 30:
                raise ValueError(
                    f"Scraped content too short ({total_words} words). "
                    "Try JS Mode for JavaScript-heavy or bot-protected sites."
                )

        # ── Create document record ────────────────────────────────────────
        label  = pages[0]["title"] or url
        record = DocumentRecord(
            filename=label,
            source_type="url",
            source_url=url,
            status="processing",
        )
        await documents_col().insert_one(record.model_dump())

        # ── Chunk + embed ─────────────────────────────────────────────────
        all_ids, all_embeddings, all_docs, all_metas = [], [], [], []
        chunk_counter = 0

        for page in pages:
            chunks = chunk_by_paragraphs(page["text"])
            if not chunks:
                continue
            embeddings = embed_texts(chunks)
            for chunk, emb in zip(chunks, embeddings):
                all_ids.append(f"{record.id}_{chunk_counter}")
                all_embeddings.append(emb)
                all_docs.append(chunk)
                all_metas.append({
                    "doc_id":      record.id,
                    "filename":    label,
                    "source_type": "url",
                    "source_url":  page["url"],
                    "chunk_index": chunk_counter,
                })
                chunk_counter += 1

        if not all_ids:
            raise ValueError("Scraped content had no usable text chunks.")

        upsert_chunks(all_ids, all_embeddings, all_docs, all_metas)

        # ── Update records ────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        await documents_col().update_one(
            {"id": record.id},
            {"$set": {"status": "ready", "chunk_count": chunk_counter, "updated_at": now}},
        )
        await scrape_jobs_col().update_one(
            {"id": job.id},
            {"$set": {
                "status":        "done",
                "doc_id":        record.id,
                "pages_scraped": len(pages),
                "updated_at":    now,
            }},
        )
        job.status        = "done"
        job.doc_id        = record.id
        job.pages_scraped = len(pages)

    except Exception as e:
        now = datetime.now(timezone.utc)
        await scrape_jobs_col().update_one(
            {"id": job.id},
            {"$set": {"status": "error", "error_message": str(e), "updated_at": now}},
        )
        job.status        = "error"
        job.error_message = str(e)

    return job
