from __future__ import annotations

import anthropic
from app.config import get_settings
from app.detector.heuristic import HeuristicResult

settings = get_settings()

SYSTEM_PROMPT = """You are an expert at analyzing HTML to find login/authentication forms.
Given an HTML snippet, determine if it contains a login or authentication component.
Respond in JSON only with this exact structure:
{
  "found": true | false,
  "confidence": 0.0 to 1.0,
  "detected_fields": ["password", "username_or_email", ...],
  "form_action": "/login" or null,
  "reasoning": "one sentence explanation"
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

    # Trim HTML to stay within a reasonable token budget
    trimmed_html = html[:8000]

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
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        import json
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)

    except Exception as e:
        return {
            "found": False,
            "confidence": 0.0,
            "detected_fields": [],
            "form_action": None,
            "reasoning": f"LLM call failed: {str(e)}",
        }
