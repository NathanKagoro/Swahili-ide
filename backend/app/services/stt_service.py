import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.core.settings import settings
from app.core.whisper_loader import load_whisper_model
from app.services.deepgram_stt_service import transcribe_audio_bytes_with_deepgram

_ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"}


def _extract_extension(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix in _ALLOWED_AUDIO_EXTENSIONS:
        return suffix
    if upload.content_type == "audio/webm":
        return ".webm"
    return ".wav"


def _normalize_language(lang: str | None) -> str | None:
    normalized = (lang or "").strip().lower().replace("_", "-")
    if not normalized:
        return None

    if normalized.startswith("sw"):
        return "sw"
    if normalized.startswith("en"):
        return "en"
    return None


def _transcribe_file(path: str, model: Any, language: str | None) -> str:
    # Prefer requested language first, then auto-detect as fallback.
    attempts = []
    if language:
        attempts.append({"language": language, "task": "transcribe", "fp16": False})
    attempts.append({"language": None, "task": "transcribe", "fp16": False})

    for options in attempts:
        result = model.transcribe(path, **options)
        text = str(result.get("text", "")).strip()
        if text:
            return text

    return ""


def _normalize_stt_provider(value: str) -> str:
    return value.strip().lower()


def _transcribe_with_whisper(raw: bytes, file: UploadFile, language: str | None) -> str:
    suffix = _extract_extension(file)
    temp_path = ""

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(raw)
            temp_path = temp_file.name

        try:
            model = load_whisper_model(settings.whisper_model)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"Imeshindikana kupakia modeli ya Whisper: {exc}") from exc

        text = _transcribe_file(temp_path, model, language)
        return text
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


async def transcribe_audio(file: UploadFile, language: str | None = None) -> str:
    raw = await file.read()
    if not raw:
        raise ValueError("Hakuna sauti iliyotumwa.")

    preferred_language = _normalize_language(language)
    provider = _normalize_stt_provider(settings.stt_provider)
    if provider == "deepgram":
        text = transcribe_audio_bytes_with_deepgram(raw, file.content_type, preferred_language)
    elif provider == "whisper":
        text = _transcribe_with_whisper(raw, file, preferred_language)
    else:
        raise RuntimeError(f"STT provider haijatambuliwa: {settings.stt_provider}")

    text = text.strip()
    if not text:
        return ""
    return text[: settings.max_input_chars]
