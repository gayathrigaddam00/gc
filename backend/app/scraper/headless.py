from __future__ import annotations

from playwright.async_api import async_playwright
from app.config import get_settings

settings = get_settings()

_AUTH_INPUT_SELECTOR = (
    'input[type="password"],'
    'input[autocomplete="current-password"],'
    'input[autocomplete="username"],'
    'input[autocomplete="email"],'
    'input[name="email"],'
    'input[name="username"],'
    'input[name="login"],'
    'input[name="identifier"],'
    'input[name="session_key"]'
)

# Injected before page scripts run — hides common headless detection signals
_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => false });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
"""


async def fetch_html_headless(url: str) -> tuple[str | None, str | None]:
    """
    Fetch a URL using a headless Chromium browser with stealth settings.

    Strategy:
    1. Launch with flags that suppress headless detection
    2. Inject stealth JS before page scripts execute
    3. Wait for any known auth input (single combined selector, 8s budget)
    4. Fall back to 3s flat wait if no auth input appears
    """
    timeout_ms = max(settings.request_timeout_seconds * 1000, 20000)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            context = await browser.new_context(
                user_agent=settings.user_agent,
                java_script_enabled=True,
                viewport={"width": 1280, "height": 800},
                locale="en-US",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )

            # Inject stealth overrides before any page script runs
            await context.add_init_script(_STEALTH_JS)

            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

            try:
                await page.wait_for_selector(_AUTH_INPUT_SELECTOR, timeout=8000)
            except Exception:
                await page.wait_for_timeout(3000)

            html = await page.content()
            await browser.close()
            return html, None
    except Exception as e:
        return None, f"Headless error: {str(e)}"
