import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

SKIP_TAGS = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript"}
SKIP_CLASSES = {"nav", "menu", "sidebar", "footer", "header", "cookie", "banner", "ad"}


def _is_clean_element(tag) -> bool:
    if tag.name in SKIP_TAGS:
        return False
    # Safely get class attribute
    raw_class = tag.attrs.get("class", []) if tag.attrs else []
    if isinstance(raw_class, list):
        classes = " ".join(raw_class).lower()
    else:
        classes = str(raw_class).lower()
    if any(s in classes for s in SKIP_CLASSES):
        return False
    return True


def extract_main_text(html: str, url: str = "") -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")

    # Title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()

    # Remove noise elements safely
    for tag in list(soup.find_all(True)):
        try:
            if not _is_clean_element(tag):
                tag.decompose()
        except Exception:
            continue

    # Find main content — always fall back to full soup
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id=re.compile(r"content|main|article", re.I))
        or soup.find(class_=re.compile(r"content|main|article|post", re.I))
        or soup.body
        or soup
    )

    text = main.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return title or url, text


async def scrape_url(url: str, timeout: int = 20) -> tuple[str, str]:
    async with httpx.AsyncClient(
        headers=HEADERS,
        follow_redirects=True,
        timeout=timeout,
        verify=False,  # avoids SSL issues on Windows Python 3.12
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            raise ValueError(f"Unsupported content type: {content_type}")
        return extract_main_text(response.text, url)


def _get_links(soup: BeautifulSoup, base_url: str, base_domain: str, same_domain_only: bool) -> list[str]:
    """Safely extract all valid links from a page."""
    links = []
    for a in soup.find_all("a"):
        try:
            # Safely get href — this is what was causing 'NoneType has no attribute get'
            if not a.attrs:
                continue
            href = a.attrs.get("href")
            if not href or not isinstance(href, str):
                continue
            href = href.strip()
            if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("javascript:"):
                continue
            full_url = urljoin(base_url, href).split("#")[0]
            if not full_url.startswith("http"):
                continue
            p = urlparse(full_url)
            if same_domain_only and p.netloc != base_domain:
                continue
            links.append(full_url)
        except Exception:
            continue
    return links


async def scrape_site(
    base_url: str,
    max_pages: int = 10,
    same_domain_only: bool = True,
    timeout: int = 20,
) -> list[dict]:
    parsed = urlparse(base_url)
    base_domain = parsed.netloc

    visited: set[str] = set()
    queue: list[str] = [base_url]
    results: list[dict] = []

    async with httpx.AsyncClient(
        headers=HEADERS,
        follow_redirects=True,
        timeout=timeout,
        verify=False,
    ) as client:
        while queue and len(results) < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                response = await client.get(url)
                response.raise_for_status()
                ct = response.headers.get("content-type", "")
                if "text/html" not in ct:
                    continue

                title, text = extract_main_text(response.text, url)
                if not text or len(text) < 100:
                    continue

                results.append({"url": url, "title": title or url, "text": text})

                # Discover links safely
                soup = BeautifulSoup(response.text, "lxml")
                new_links = _get_links(soup, url, base_domain, same_domain_only)
                for link in new_links:
                    if link not in visited and link not in queue:
                        queue.append(link)

            except Exception as e:
                print(f"Skipping {url}: {e}")
                continue

    return results
