from typing import Any

from app.core.settings import settings


def _response_to_dict(response: Any) -> dict[str, Any]:
    if hasattr(response, "to_dict"):
        data = response.to_dict()
        if isinstance(data, dict):
            return data
    if isinstance(response, dict):
        return response
    return {}


def _extract_transcript(response: Any) -> str:
    payload = _response_to_dict(response)
    channels = payload.get("results", {}).get("channels", [])
    if not channels:
        return ""
    alternatives = channels[0].get("alternatives", [])
    if not alternatives:
        return ""
    return str(alternatives[0].get("transcript", "")).strip()


def transcribe_audio_bytes_with_deepgram(raw_audio: bytes, content_type: str | None = None) -> str:
    if not settings.deepgram_api_key:
        raise RuntimeError("DEEPGRAM_API_KEY haijawekwa kwenye backend/.env.")

    try:
        from deepgram import DeepgramClient, PrerecordedOptions
    except ImportError as exc:  # noqa: BLE001
        raise RuntimeError("Deepgram SDK haijasakinishwa. Endesha: pip install -r requirements.txt") from exc

    try:
        client = DeepgramClient(api_key=settings.deepgram_api_key)
        source = {
            "buffer": raw_audio,
            "mimetype": content_type or "audio/webm",
        }
        options = PrerecordedOptions(
            model=settings.deepgram_model,
            language=settings.deepgram_language or None,
            punctuate=True,
            smart_format=True,
        )

        response = client.listen.rest.v("1").transcribe_file(source, options)
        return _extract_transcript(response)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Deepgram transcription imeshindikana: {exc}") from exc