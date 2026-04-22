"""
Integration tests against the five sample sites.
These make real network requests — run with: pytest tests/test_pipeline.py -v
Skip in CI if you don't want external network calls: pytest -m "not integration"
"""
import pytest
import pytest_asyncio
from app.services.pipeline import analyze


pytestmark = pytest.mark.asyncio


SAMPLE_SITES = [
    ("https://github.com/login", True),
    ("https://www.linkedin.com/login", True),
    ("https://accounts.google.com", True),
    # Slack uses advanced bot-detection that blocks headless Chromium.
    # We detect and surface this as bot_protection=True rather than pretending to find a form.
    ("https://app.slack.com/signin", False),
    ("https://twitter.com/login", True),
]


@pytest.mark.integration
@pytest.mark.parametrize("url,expected_found", SAMPLE_SITES)
async def test_sample_site_detection(url, expected_found):
    result = await analyze(url)
    assert result.found == expected_found, (
        f"Expected found={expected_found} for {url}, "
        f"got found={result.found} (confidence={result.confidence:.2f}, method={result.method})"
    )
    if expected_found:
        assert result.confidence > 0.0


@pytest.mark.integration
async def test_github_login_fields():
    result = await analyze("https://github.com/login")
    assert result.found is True
    assert "password" in result.detected_fields
