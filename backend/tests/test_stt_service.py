import io
import unittest
from unittest.mock import patch

from fastapi import UploadFile

from app.core.settings import settings
from app.services.stt_service import transcribe_audio


class _FakeWhisperModel:
    def __init__(self, text: str) -> None:
        self._text = text

    def transcribe(self, _path: str, language: str, task: str, fp16: bool):
        return {"text": self._text}


class STTServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_transcribe_audio_returns_trimmed_text(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))
        previous_provider = settings.stt_provider

        try:
            settings.stt_provider = "whisper"
            with patch("app.services.stt_service.load_whisper_model", return_value=_FakeWhisperModel("  habari  ")):
                text = await transcribe_audio(upload)
        finally:
            settings.stt_provider = previous_provider

        self.assertEqual(text, "habari")

    async def test_transcribe_audio_rejects_empty_payload(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b""))

        with self.assertRaisesRegex(ValueError, "Hakuna sauti"):
            await transcribe_audio(upload)

    async def test_transcribe_audio_surfaces_model_load_failure(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))
        previous_provider = settings.stt_provider

        try:
            settings.stt_provider = "whisper"
            with patch("app.services.stt_service.load_whisper_model", side_effect=RuntimeError("missing model")):
                with self.assertRaisesRegex(RuntimeError, "Imeshindikana kupakia modeli ya Whisper"):
                    await transcribe_audio(upload)
        finally:
            settings.stt_provider = previous_provider

    async def test_transcribe_audio_uses_deepgram_when_configured(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))
        previous_provider = settings.stt_provider

        try:
            settings.stt_provider = "deepgram"
            with patch("app.services.stt_service.transcribe_audio_bytes_with_deepgram", return_value=" jambo "):
                text = await transcribe_audio(upload)
        finally:
            settings.stt_provider = previous_provider

        self.assertEqual(text, "jambo")

    async def test_transcribe_audio_rejects_unknown_provider(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))
        previous_provider = settings.stt_provider

        try:
            settings.stt_provider = "not-real"
            with self.assertRaisesRegex(RuntimeError, "STT provider haijatambuliwa"):
                await transcribe_audio(upload)
        finally:
            settings.stt_provider = previous_provider


if __name__ == "__main__":
    unittest.main()
