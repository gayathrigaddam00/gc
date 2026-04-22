from __future__ import annotations

import json
import anthropic
from bs4 import BeautifulSoup
from app.config import get_settings
from app.detector.heuristic import HeuristicResult

settings = get_settings()

SYSTEM_PROMPT = """You are an expert at analyzing HTML to find login/authentication forms.
Given an HTML snippet, determine if it contains a login or authentication component.

WHAT COUNTS AS A LOGIN FORM:
- An <input type="password"> is the strongest signal
- A text/email input with autocomplete="username", autocomplete="email", name="email", name="login", or name="identifier"
- A submit action pointing to a login/auth/session endpoint

CRITICAL RULES:
1. Never infer fields that are not explicitly present in the HTML. If <input type="password"> is absent, set "found": false unless a clearly labeled login form with a username field is present.
2. Only include a field in "detected_fields" if you can cite the exact HTML attribute that proves it.
3. Confidence scoring: use 0.8–1.0 only when both a password input AND a username/email input are present. Use 0.4–0.7 when only one is present. Use below 0.4 when you are uncertain.

Respond in JSON only with this exact structure:
{
  "reasoning": "one sentence citing the specific HTML attributes you found",
  "found": true | false,
  "confidence": 0.0 to 1.0,
  "detected_fields": ["password", "username_or_email"],
  "form_action": "/login" or null
}"""


async def detect_with_llm(
    html: str,
    heuristic_hint: HeuristicResult,
) -> dict:
    """
    Call Claude to classify the HTML when the heuristic is uncertain.
    Returns a dict with found, confidence, detected_fields, form_action, reasoning.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # --- Start HTML Cleanup ---
    # 1. Parse the raw HTML
    soup = BeautifulSoup(html, 'html.parser')
    
    # 2. Destroy non-structural tags that eat up tokens
    for element in soup(["script", "style", "noscript", "meta", "link", "svg"]):
        element.decompose()
        
    # 3. Extract just the body (fallback to the whole parsed soup if body is missing)
    body_content = soup.body if soup.body else soup
    
    # 4. Convert back to string and compress whitespace to save tokens
    cleaned_html = str(body_content)
    cleaned_html = " ".join(cleaned_html.split()) 
    
    # 5. Apply the token-saving cutoff to the cleaned content
    trimmed_html = cleaned_html[:8000]
    # --- End HTML Cleanup ---

    hint_text = ""
    if heuristic_hint.low_confidence_reason:
        hint_text = f"\nHeuristic note: {heuristic_hint.low_confidence_reason}"

    user_message = f"""Analyze this HTML and identify if it contains a login/auth form.{hint_text}

HTML:
```html
{trimmed_html}
```"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=256,
            temperature=0.0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = message.content[0].text.strip()
        
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        
        return json.loads(raw.strip())

    except Exception as e:
        return {
            "found": False,
            "confidence": 0.0,
            "detected_fields": [],
            "form_action": None,
            "reasoning": f"LLM call failed: {str(e)}",
        }