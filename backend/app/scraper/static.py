from __future__ import annotations

import httpx
from app.config import get_settings

settings = get_settings()

# Mimic a real browser request as closely as possible without Brotli
# (httpx doesn't support Brotli by default, so omit `br` from Accept-Encoding)
_BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}


async def fetch_html(url: str) -> tuple[str | None, str | None]:
    """
    Fetch a URL with a lightweight HTTP request.
    Returns (html, error). On success error is None; on failure html is None.
    """
    headers = {**_BROWSER_HEADERS, "User-Agent": settings.user_agent}
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=settings.request_timeout_seconds,
        ) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text, None
    except httpx.HTTPStatusError as e:
        return None, f"HTTP {e.response.status_code}: {e.response.reason_phrase}"
    except httpx.TimeoutException:
        return None, "Request timed out"
    except httpx.RequestError as e:
        return None, f"Request error: {str(e)}"
