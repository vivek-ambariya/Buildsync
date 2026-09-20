"""Pluggable LLM transport.

The rest of the AI layer never talks to a vendor SDK directly. It asks for a
provider and gets either a hosted model (when LLM_PROVIDER + LLM_API_KEY are
set in .env) or the local deterministic engine. Adding a vendor means adding
one subclass here and nothing else.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


class LLMProvider(ABC):
    name: str = "base"
    available: bool = False

    @abstractmethod
    async def complete(self, system: str, prompt: str, max_tokens: int = 900) -> str: ...


class LocalProvider(LLMProvider):
    """No hosted model configured. Callers fall back to the rules engine."""

    name = "local"
    available = False

    async def complete(self, system: str, prompt: str, max_tokens: int = 900) -> str:
        raise RuntimeError("No hosted model configured; use the local intelligence engine.")


class AnthropicProvider(LLMProvider):
    name = "anthropic"
    available = True
    endpoint = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def complete(self, system: str, prompt: str, max_tokens: int = 900) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(self.endpoint, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        return "".join(part.get("text", "") for part in data.get("content", []))


class OpenAIProvider(LLMProvider):
    name = "openai"
    available = True
    endpoint = "https://api.openai.com/v1/chat/completions"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def complete(self, system: str, prompt: str, max_tokens: int = 900) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}", "content-type": "application/json"}
        body = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(self.endpoint, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]


class GeminiProvider(LLMProvider):
    """Google Gemini via the Generative Language API.

    Auth is an API key in the x-goog-api-key header, not a bearer token --
    Gemini rejects Authorization: Bearer for API keys. Thinking is disabled
    because 2.5-flash otherwise spends the output budget on reasoning tokens
    and can return a candidate with no text part at all.
    """

    name = "gemini"
    available = True
    base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def complete(self, system: str, prompt: str, max_tokens: int = 900) -> str:
        headers = {"x-goog-api-key": self.api_key, "content-type": "application/json"}
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.3,
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        url = f"{self.base_url}/{self.model}:generateContent"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates") or []
        if not candidates:
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates returned")
            raise RuntimeError(f"Gemini returned no answer ({reason}).")

        # Skip any thought parts; keep the visible text.
        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if not text.strip():
            finish = candidates[0].get("finishReason", "unknown")
            raise RuntimeError(f"Gemini returned an empty answer (finishReason={finish}).")
        return text


_PROVIDERS = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
}


def get_provider() -> LLMProvider:
    key = (settings.llm_provider or "").strip().lower()
    if key in _PROVIDERS and settings.llm_api_key:
        return _PROVIDERS[key](settings.llm_api_key, settings.llm_model)
    if key:
        log.warning("LLM_PROVIDER=%s set but LLM_API_KEY is missing; using local engine.", key)
    return LocalProvider()
