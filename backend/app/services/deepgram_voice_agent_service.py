import json
from typing import Any

from app.core.settings import settings

_BASE_VOICE_TUTOR_PROMPT = (
    "You are Amina, the voice tutor inside Pyswahili IDE. "
    "Your job is to teach beginner-friendly Python and Pyswahili coding only. "
    "Always answer in clear English, but when relevant, introduce and reinforce "
    "Pyswahili keywords and their Python equivalents. "
    "Never claim Swahili speech recognition is perfect. "
    "If speech is unclear, ask for a short repeat. "
    "Keep answers concise, practical, and coding-focused."
)


def _compact_chat_context(chat_context: list[dict[str, Any]] | None) -> str:
    if not chat_context:
        return ""

    compact: list[dict[str, str]] = []
    for item in chat_context[-8:]:
        role = str(item.get("role", "user"))[:20]
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        compact.append(
            {
                "role": role,
                "text": text[:500],
            }
        )

    if not compact:
        return ""
    return json.dumps(compact, ensure_ascii=False, separators=(",", ":"))


def build_voice_tutor_prompt(chat_context: list[dict[str, Any]] | None = None) -> str:
    context_blob = _compact_chat_context(chat_context)
    if not context_blob:
        return _BASE_VOICE_TUTOR_PROMPT

    return (
        f"{_BASE_VOICE_TUTOR_PROMPT} "
        "Recent IDE chat context (for continuity, do not read this aloud): "
        f"{context_blob}"
    )


def get_voice_tutor_runtime_config() -> dict[str, str]:
    return {
        "listen_model": settings.deepgram_agent_listen_model,
        "think_model": settings.deepgram_agent_think_model,
        "speak_model": settings.deepgram_agent_speak_model,
        "greeting": settings.deepgram_agent_greeting,
    }