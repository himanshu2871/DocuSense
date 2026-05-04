from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal

from db.mongodb import scrape_jobs_col
from db.models import ScrapeRequest, ScrapeJobRecord
from services.scraper_service import ingest_url

router = APIRouter(prefix="/scrape", tags=["scrape"])


class ScrapeRequestExtended(BaseModel):
    url: str
    mode: Literal["auto", "fast", "js"] = "auto"


def _validate_url(url: str):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")


@router.post("", response_model=ScrapeJobRecord)
async def scrape_single_url(payload: ScrapeRequestExtended):
    """
    Scrape a single URL.
    mode=auto  → auto-detect JS need (default)
    mode=fast  → always use httpx
    mode=js    → always use Playwright
    """
    _validate_url(payload.url)
    job = await ingest_url(url=payload.url, crawl=False, mode=payload.mode)
    if job.status == "error":
        raise HTTPException(422, job.error_message or "Failed to scrape URL.")
    return job


@router.post("/crawl", response_model=ScrapeJobRecord)
async def crawl_site(payload: ScrapeRequestExtended, max_pages: int = 10):
    """Crawl an entire website (same domain) up to max_pages pages."""
    _validate_url(payload.url)
    if not 1 <= max_pages <= 50:
        raise HTTPException(400, "max_pages must be between 1 and 50.")
    job = await ingest_url(url=payload.url, crawl=True,
                           max_pages=max_pages, mode=payload.mode)
    if job.status == "error":
        raise HTTPException(422, job.error_message or "Failed to crawl site.")
    return job


@router.post("/js", response_model=ScrapeJobRecord)
async def scrape_js_url(payload: ScrapeRequest):
    """Shortcut: always use Playwright — for React SPAs, Cloudflare sites, MSN, etc."""
    _validate_url(payload.url)
    job = await ingest_url(url=payload.url, crawl=False, mode="js")
    if job.status == "error":
        raise HTTPException(422, job.error_message or "Failed to scrape with Playwright.")
    return job


@router.get("/jobs", response_model=list[ScrapeJobRecord])
async def list_jobs():
    cursor = scrape_jobs_col().find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    return [ScrapeJobRecord(**job) async for job in cursor]


@router.get("/jobs/{job_id}", response_model=ScrapeJobRecord)
async def get_job(job_id: str):
    job = await scrape_jobs_col().find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found.")
    return ScrapeJobRecord(**job)
