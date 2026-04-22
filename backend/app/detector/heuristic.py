from __future__ import annotations

from bs4 import BeautifulSoup
from dataclasses import dataclass, field


# ── Keyword sets ──────────────────────────────────────────────────────────────
_FORM_ACTION_KEYWORDS = {
    "login", "log-in", "log_in", "signin", "sign-in", "sign_in",
    "auth", "session", "authenticate", "sso", "oauth",
}
_FORM_ID_KEYWORDS = {
    "login", "signin", "auth", "logon", "session",
}
_SUBMIT_KEYWORDS = {
    "log in", "login", "sign in", "signin", "continue", "next",
    "submit", "get started", "go", "enter",
}
_HEADING_KEYWORDS = {
    "sign in", "log in", "login", "signin", "welcome back",
    "enter your password", "enter your email",
}
_AUTH_AUTOCOMPLETE = {
    "username", "email", "current-password", "new-password",
}
_USERNAME_NAMES = {
    "email", "username", "user", "login", "identifier",
    "phone", "mobile", "userid", "user_id", "user-id",
}


_BOT_BLOCK_PHRASES = [
    "browser is not supported",
    "browser not supported",
    "please enable javascript",
    "javascript is required",
    "access denied",
    "checking your browser",
    "ddos protection",
    "please wait while we verify",
    "captcha",
]


@dataclass
class HeuristicResult:
    found: bool = False
    confidence: float = 0.0
    html_snippet: str | None = None
    detected_fields: list[str] = field(default_factory=list)
    form_action: str | None = None
    candidate_count: int = 0
    low_confidence_reason: str | None = None
    unusual_structure: bool = False
    bot_protection_detected: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _input_is_username(inp) -> bool:
    ac = (inp.get("autocomplete") or "").lower()
    name = (inp.get("name") or "").lower()
    id_ = (inp.get("id") or "").lower()
    placeholder = (inp.get("placeholder") or "").lower()
    label_for = (inp.get("aria-label") or "").lower()
    combined = f"{ac} {name} {id_} {placeholder} {label_for}"
    if ac in ("username", "email"):
        return True
    return any(kw in combined for kw in _USERNAME_NAMES)


def _clean_snippet(form) -> str:
    """Return a cleaned, readable version of the form HTML."""
    import copy
    form = copy.copy(form)

    # Remove noisy tags entirely
    for tag in form.find_all(["svg", "path", "script", "style"]):
        tag.decompose()

    # Remove noisy attributes, keep only meaningful ones
    KEEP_ATTRS = {"type", "name", "id", "placeholder", "autocomplete", "action", "method", "value"}
    for tag in form.find_all(True):
        attrs_to_remove = [attr for attr in tag.attrs if attr not in KEEP_ATTRS]
        for attr in attrs_to_remove:
            del tag.attrs[attr]

    return str(form)[:2000]

def _score_form(form) -> tuple[float, list[str], str | None]:
    """Score a single <form> element."""
    score = 0.0
    fields: list[str] = []

    inputs = form.find_all("input")
    input_types = [i.get("type", "text").lower() for i in inputs]

    # Password field — strongest signal
    if "password" in input_types:
        score += 0.4
        fields.append("password")

    # Username/email in same form
    for inp in inputs:
        if _input_is_username(inp):
            score += 0.2
            fields.append("username_or_email")
            break

    # Form action
    action = (form.get("action") or "").lower()
    if any(kw in action for kw in _FORM_ACTION_KEYWORDS):
        score += 0.15

    # Form id/class
    form_meta = (" ".join(form.get("class", [])) + " " + (form.get("id") or "")).lower()
    if any(kw in form_meta for kw in _FORM_ID_KEYWORDS):
        score += 0.1

    # Submit button text
    for btn in form.find_all(["button", "input"]):
        btn_text = (btn.get_text() + " " + (btn.get("value") or "")).lower()
        if any(kw in btn_text for kw in _SUBMIT_KEYWORDS):
            score += 0.1
            break

    # ARIA labels inside form
    aria_combined = " ".join(
        (el.get("aria-label") or "") for el in form.find_all(True)
    ).lower()
    if any(kw in aria_combined for kw in _FORM_ID_KEYWORDS):
        score += 0.05

    return min(score, 1.0), fields, (form.get("action") or None)


def _score_formless(soup: BeautifulSoup) -> tuple[float, list[str], str | None]:
    """
    Score a page that has NO <form> tags.
    Handles SPAs like Twitter/X that render inputs directly in divs.
    """
    score = 0.0
    fields: list[str] = []

    all_inputs = soup.find_all("input")
    if not all_inputs:
        return 0.0, [], None

    input_types = [i.get("type", "text").lower() for i in all_inputs]
    autocompletes = [
        (i.get("autocomplete") or "").lower() for i in all_inputs
    ]

    # Password input anywhere on page
    if "password" in input_types or "current-password" in autocompletes:
        score += 0.4
        fields.append("password")

    # Username/email input
    for inp in all_inputs:
        if _input_is_username(inp):
            score += 0.2
            fields.append("username_or_email")
            break

    # Page heading says "sign in" / "log in"
    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = tag.get_text().lower().strip()
        if any(kw in text for kw in _HEADING_KEYWORDS):
            score += 0.25
            break

    # Button or link with auth text
    for btn in soup.find_all(["button", "a"]):
        btn_text = btn.get_text().lower().strip()
        if any(kw in btn_text for kw in _SUBMIT_KEYWORDS):
            score += 0.1
            break

    # data-testid attributes with login keywords
    for el in soup.find_all(True, attrs={"data-testid": True}):
        testid = (el.get("data-testid") or "").lower()
        if any(kw in testid for kw in _FORM_ID_KEYWORDS):
            score += 0.1
            break

    return min(score, 1.0), fields, None


# ── Public API ────────────────────────────────────────────────────────────────

def detect(html: str) -> HeuristicResult:
    result = HeuristicResult()

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # Detect bot-protection / unsupported-browser pages.
    # Only trigger when blocking phrases appear AND there are no interactive inputs.
    # Guard: many SPAs include "please enable JS" in a hidden <noscript> tag even
    # when JS ran fine (e.g. Twitter). If there are visible inputs on the page,
    # the browser did execute JS successfully — don't flag as bot-protected.
    interactive_inputs = [
        i for i in soup.find_all("input")
        if (i.get("type") or "text").lower() not in ("hidden", "submit")
    ]
    if not interactive_inputs:
        page_text = soup.get_text().lower()
        if any(phrase in page_text for phrase in _BOT_BLOCK_PHRASES):
            result.bot_protection_detected = True
            result.low_confidence_reason = "bot_protection_detected"
            return result

    forms = soup.find_all("form")

    # ── Path A: page has <form> elements ─────────────────────────────────────
    if forms:
        scored = []
        for form in forms:
            score, fields, action = _score_form(form)
            if score > 0:
                scored.append((score, fields, action, form))

        if not scored:
            result.low_confidence_reason = "forms_present_but_no_auth_signals"
            return result

        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best_fields, best_action, best_form = scored[0]

        result.found = best_score >= 0.4
        result.confidence = best_score
        result.detected_fields = best_fields
        result.form_action = best_action
        result.candidate_count = len(scored)
        # Fix: only set snippet when auth is actually found
        result.html_snippet = _clean_snippet(best_form) if result.found else None

        if len(scored) > 1 and (scored[0][0] - scored[1][0]) < 0.15:
            result.low_confidence_reason = "ambiguous_multiple_forms"

        return result

    # ── Path B: no <form> tags — SPA / formless flow ──────────────────────────
    result.unusual_structure = True
    score, fields, _ = _score_formless(soup)

    if score > 0:
        result.found = score >= 0.4
        result.confidence = score
        result.detected_fields = fields
        result.low_confidence_reason = "no_form_tags_spa_pattern"

        # Fix: only build snippet when auth is actually found
        if result.found:
            anchor = None
            for inp in soup.find_all("input"):
                if inp.get("type") == "password" or _input_is_username(inp):
                    anchor = inp
                    break
            if anchor:
                # Walk up to find a meaningful container (up to 3 levels)
                node = anchor
                for _ in range(3):
                    if node.parent and node.parent.name not in ("body", "html", "[document]"):
                        node = node.parent
                    else:
                        break
                result.html_snippet = _clean_snippet(node)
    else:
        result.low_confidence_reason = "no_forms_found"

    return result