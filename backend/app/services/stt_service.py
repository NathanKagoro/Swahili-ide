import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.core.settings import settings
from app.core.whisper_loader import load_whisper_model

_ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"}


def _extract_extension(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix in _ALLOWED_AUDIO_EXTENSIONS:
        return suffix
    if upload.content_type == "audio/webm":
        return ".webm"
    return ".wav"


def _transcribe_file(path: str, model: Any) -> str:
    # Try language auto-detection first, then a Swahili hint.
    attempts = [
        {"language": None, "task": "transcribe", "fp16": False},
        {"language": "sw", "task": "transcribe", "fp16": False},
    ]

    for options in attempts:
        result = model.transcribe(path, **options)
        text = str(result.get("text", "")).strip()
        if text:
            return text

    return ""


async def transcribe_audio(file: UploadFile) -> str:
    raw = await file.read()
    if not raw:
        raise ValueError("Hakuna sauti iliyotumwa.")

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

        text = _transcribe_file(temp_path, model)
        if not text:
            return ""
        return text[: settings.max_input_chars]
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
