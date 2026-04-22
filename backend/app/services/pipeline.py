from __future__ import annotations

import logging
from app.scraper.static import fetch_html
from app.scraper.headless import fetch_html_headless
from app.detector import heuristic
from app.detector.llm import detect_with_llm
from app.models import DetectionResult
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _needs_llm(h: heuristic.HeuristicResult) -> bool:
    if h.bot_protection_detected:
        return False  # LLM can't help if the page itself is a bot-blocker
    if not h.found:
        return True
    if h.confidence < settings.confidence_threshold:
        return True
    if h.candidate_count > 1 and h.low_confidence_reason == "ambiguous_multiple_forms":
        return True
    if h.unusual_structure:
        return True
    return False


def _to_result(url: str, h: heuristic.HeuristicResult, method: str) -> DetectionResult:
    return DetectionResult(
        url=url,
        found=h.found,
        confidence=h.confidence,
        method=method,
        html_snippet=h.html_snippet,
        detected_fields=h.detected_fields,
        form_action=h.form_action,
        fallback_reason=h.low_confidence_reason,
        bot_protection=h.bot_protection_detected,
    )


async def analyze(url: str) -> DetectionResult:
    """
    Full pipeline: static fetch → heuristic → (headless if needed) → (LLM if needed).
    """

    # --- Step 1: lightweight static fetch ---
    html, static_error = await fetch_html(url)
    method_used = "static"

    if html:
        h = heuristic.detect(html)
        logger.info("static: url=%s conf=%.2f found=%s bot=%s", url, h.confidence, h.found, h.bot_protection_detected)
    else:
        h = heuristic.HeuristicResult()
        h.low_confidence_reason = f"static_fetch_failed: {static_error}"

    # If static already found it with good confidence, skip headless
    if h.found and h.confidence >= settings.confidence_threshold and not h.bot_protection_detected:
        pass  # fall through to optional LLM check
    else:
        # --- Step 2: headless fallback ---
        logger.info("headless fallback: url=%s reason=%s", url, h.low_confidence_reason)
        html_headless, headless_error = await fetch_html_headless(url)

        if html_headless:
            h_headless = heuristic.detect(html_headless)
            logger.info("headless: url=%s conf=%.2f found=%s bot=%s", url, h_headless.confidence, h_headless.found, h_headless.bot_protection_detected)

            # Use headless result if it's better, OR if bot protection was the static result
            if h_headless.confidence >= h.confidence or h.bot_protection_detected:
                h = h_headless
                html = html_headless
                method_used = "headless"
        else:
            logger.warning("headless failed: url=%s error=%s", url, headless_error)
            if not html:
                return DetectionResult(
                    url=url, found=False, confidence=0.0, method="none",
                    error=headless_error or static_error,
                )

    # --- Step 3: optional LLM fallback ---
    if settings.enable_llm_fallback and settings.anthropic_api_key and _needs_llm(h):
        logger.info("LLM fallback: url=%s reason=%s", url, h.low_confidence_reason)
        llm_result = await detect_with_llm(html, h)
        return DetectionResult(
            url=url,
            found=llm_result.get("found", False),
            confidence=llm_result.get("confidence", 0.0),
            method="llm",
            html_snippet=h.html_snippet,
            detected_fields=llm_result.get("detected_fields", []),
            form_action=llm_result.get("form_action"),
            fallback_reason=h.low_confidence_reason,
            bot_protection=h.bot_protection_detected,
        )

    return _to_result(url, h, method_used)
