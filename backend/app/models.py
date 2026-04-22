from __future__ import annotations

from pydantic import BaseModel
from typing import List, Literal, Optional


class DetectRequest(BaseModel):
    url: str

    class Config:
        json_schema_extra = {
            "example": {"url": "https://github.com/login"}
        }


class DetectionResult(BaseModel):
    url: str
    found: bool
    confidence: float
    method: Literal["static", "headless", "llm", "none"]
    html_snippet: Optional[str] = None
    detected_fields: List[str] = []
    form_action: Optional[str] = None
    fallback_reason: Optional[str] = None
    bot_protection: bool = False
    error: Optional[str] = None
