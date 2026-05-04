"""
Playwright scraper using the SYNC Playwright API run in a ThreadPoolExecutor.

Why sync API?
  - Windows Python 3.12 + uvicorn uses ProactorEventLoop which raises
    NotImplementedError for asyncio.create_subprocess_exec (what async
    Playwright needs to launch Chromium).
  - The sync Playwright API manages its own threads internally and never
    calls asyncio.create_subprocess_exec, so it works on any event loop.
  - We offload it to a ThreadPoolExecutor so FastAPI stays non-blocking.
"""

import re
import asyncio
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

# One shared executor for all Playwright calls
_executor = ThreadPoolExecutor(max_workers=2)

# Domains that always need Playwright regardless of mode
ALWAYS_JS_DOMAINS = {
    "en.wikipedia.org", "wikipedia.org", "www.wikipedia.org",
    "msn.com", "www.msn.com",
    "apple.com", "www.apple.com",
    "medium.com", "www.medium.com",
    "substack.com",
    "twitter.com", "x.com",
    "instagram.com", "linkedin.com",
    "reddit.com", "www.reddit.com",
    "news.ycombinator.com",
    "techcrunch.com", "www.techcrunch.com",
    "theverge.com", "www.theverge.com",
}


def _clean(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


# ── Sync Playwright helpers (run in thread pool) ──────────────────────────────

def _sync_scrape(url: str, timeout: int = 30) -> tuple[str, str]:
    """
    Scrape a single URL using sync Playwright.
    Must be called from a thread (not the main asyncio loop).
    """
    import sys
    import asyncio
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
        )
        page = ctx.new_page()

        # Block images/fonts/media to speed up loading
        page.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in ("image", "media", "font")
            else route.continue_(),
        )

        try:
            page.goto(url, wait_until="networkidle", timeout=timeout * 1000)
        except Exception:
            try:
                page.goto(url, wait_until="load", timeout=timeout * 1000)
            except Exception as e:
                browser.close()
                raise TimeoutError(f"Page timed out after {timeout}s: {e}")

        # Extra wait for SPA hydration
        page.wait_for_timeout(1500)
        title = page.title()

        # Remove noise elements
        for sel in [
            "nav", "footer", "header", "aside",
            "[class*='cookie']", "[class*='banner']",
            "[class*='popup']", "[class*='modal']",
            "[class*='advertisement']", "script", "style",
        ]:
            try:
                page.eval_on_selector_all(sel, "els => els.forEach(el => el.remove())")
            except Exception:
                pass

        # Try content selectors from most to least specific
        text = ""
        for sel in [
            ".mw-parser-output",  # Wikipedia
            "article",
            "[role='main']",
            "main",
            "#content",
            ".content",
            ".post-content",
            ".article-body",
            "body",
        ]:
            try:
                el = page.query_selector(sel)
                if el:
                    candidate = el.inner_text()
                    if len(candidate.split()) > 100:
                        text = candidate
                        break
            except Exception:
                continue

        # Last resort: evaluate on body
        if not text or len(text.split()) < 50:
            try:
                text = page.evaluate("""() => {
                    const el = document.querySelector(
                        'article, .mw-parser-output, main, #content, body'
                    );
                    return el ? el.innerText : document.body.innerText;
                }""")
            except Exception:
                pass

        browser.close()
        return title or url, _clean(text)


def _sync_scrape_site(base_url: str, max_pages: int, timeout: int) -> list[dict]:
    """Crawl a JS-heavy site using sync Playwright."""
    import sys
    import asyncio
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    from playwright.sync_api import sync_playwright

    parsed      = urlparse(base_url)
    base_domain = parsed.netloc
    visited:  set[str]   = set()
    queue:    list[str]  = [base_url]
    results:  list[dict] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 800},
        )

        while queue and len(results) < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                page = ctx.new_page()
                page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ("image", "media", "font")
                    else route.continue_(),
                )
                page.goto(url, wait_until="networkidle", timeout=timeout * 1000)
                page.wait_for_timeout(1000)
                title = page.title()

                for sel in ["nav", "footer", "header", "aside", "script", "style"]:
                    try:
                        page.eval_on_selector_all(sel, "els => els.forEach(e => e.remove())")
                    except Exception:
                        pass

                text = ""
                for sel in [".mw-parser-output", "article", "[role='main']", "main", "body"]:
                    try:
                        el = page.query_selector(sel)
                        if el:
                            c = el.inner_text()
                            if len(c.split()) > 80:
                                text = c
                                break
                    except Exception:
                        continue

                text = _clean(text)
                if len(text.split()) >= 80:
                    results.append({"url": url, "title": title or url, "text": text})

                links = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
                for link in links:
                    link = link.split("#")[0]
                    if not link.startswith("http"):
                        continue
                    if urlparse(link).netloc != base_domain:
                        continue
                    if link not in visited and link not in queue:
                        queue.append(link)

                page.close()

            except Exception as e:
                print(f"Skipping {url}: {e}")
                try:
                    page.close()
                except Exception:
                    pass
                continue

        browser.close()

    return results


# ── Public async API (wraps sync functions via executor) ──────────────────────

async def scrape_with_playwright(url: str, timeout: int = 30) -> tuple[str, str]:
    """Async wrapper — runs sync Playwright in a thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        lambda: _sync_scrape(url, timeout)
    )


async def scrape_js_site(
    base_url: str,
    max_pages: int = 5,
    timeout: int = 30,
) -> list[dict]:
    """Async wrapper — crawls JS-heavy site in a thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        lambda: _sync_scrape_site(base_url, max_pages, timeout)
    )


async def detect_needs_js(url: str, timeout: int = 10) -> bool:
    """Returns True if URL needs Playwright (known domain or SPA signals)."""
    domain = urlparse(url).netloc.lower()
    if domain in ALWAYS_JS_DOMAINS:
        return True

    import httpx
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=timeout, verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; RAGBot/1.0)"},
        ) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return True
            if "text/html" not in r.headers.get("content-type", ""):
                return False
            body = r.text
            return any([
                '<div id="root"'  in body,
                '<div id="app"'   in body,
                "__NEXT_DATA__"   in body,
                "__nuxt"          in body,
                len(body.split()) < 300,
            ])
    except Exception:
        return True


async def scrape_auto(url: str, timeout: int = 30) -> tuple[str, str]:
    """Auto-detect: httpx for static pages, Playwright for JS-heavy/blocked ones."""
    from core.scraper import scrape_url

    needs_js = await detect_needs_js(url, timeout=10)
    if needs_js:
        print(f"[Playwright] Using browser for: {url}")
        return await scrape_with_playwright(url, timeout=timeout)
    print(f"[httpx] Static page: {url}")
    return await scrape_url(url, timeout=timeout)
