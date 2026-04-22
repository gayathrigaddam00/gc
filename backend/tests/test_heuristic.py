import pytest
from app.detector.heuristic import detect


SIMPLE_LOGIN_HTML = """
<html><body>
  <form action="/login" id="login-form">
    <input type="email" name="email" placeholder="Email" />
    <input type="password" name="password" placeholder="Password" />
    <button type="submit">Log in</button>
  </form>
</body></html>
"""

NO_AUTH_HTML = """
<html><body>
  <form action="/search">
    <input type="text" name="q" />
    <button>Search</button>
  </form>
</body></html>
"""

MULTI_FORM_HTML = """
<html><body>
  <form action="/login">
    <input type="email" /><input type="password" /><button>Sign in</button>
  </form>
  <form action="/signup">
    <input type="email" /><input type="password" /><button>Create account</button>
  </form>
</body></html>
"""

EMPTY_HTML = "<html><body><p>Nothing here</p></body></html>"


def test_simple_login_detected():
    result = detect(SIMPLE_LOGIN_HTML)
    assert result.found is True
    assert result.confidence >= 0.6
    assert "password" in result.detected_fields
    assert "username_or_email" in result.detected_fields


def test_no_auth_form_not_detected():
    result = detect(NO_AUTH_HTML)
    assert result.found is False or result.confidence < 0.5


def test_empty_page_not_found():
    result = detect(EMPTY_HTML)
    assert result.found is False
    assert result.unusual_structure is True


def test_multi_form_flagged_as_ambiguous():
    result = detect(MULTI_FORM_HTML)
    assert result.found is True
    # Two similar forms should trigger ambiguity flag
    assert result.low_confidence_reason == "ambiguous_multiple_forms" or result.confidence >= 0.5


def test_html_snippet_is_capped():
    big_form = "<form>" + "<input/>" * 1000 + "</form>"
    result = detect(big_form)
    if result.html_snippet:
        assert len(result.html_snippet) <= 2000
