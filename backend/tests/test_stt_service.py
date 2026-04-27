import io
import unittest
from unittest.mock import patch

from fastapi import UploadFile

from app.services.stt_service import transcribe_audio


class _FakeWhisperModel:
    def __init__(self, text: str) -> None:
        self._text = text

    def transcribe(self, _path: str, language: str, task: str, fp16: bool):
        return {"text": self._text}


class STTServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_transcribe_audio_returns_trimmed_text(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))

        with patch("app.services.stt_service.load_whisper_model", return_value=_FakeWhisperModel("  habari  ")):
            text = await transcribe_audio(upload)

        self.assertEqual(text, "habari")

    async def test_transcribe_audio_rejects_empty_payload(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b""))

        with self.assertRaisesRegex(ValueError, "Hakuna sauti"):
            await transcribe_audio(upload)

    async def test_transcribe_audio_surfaces_model_load_failure(self) -> None:
        upload = UploadFile(filename="voice.webm", file=io.BytesIO(b"fake-audio"))

        with patch("app.services.stt_service.load_whisper_model", side_effect=RuntimeError("missing model")):
            with self.assertRaisesRegex(RuntimeError, "Imeshindikana kupakia modeli ya Whisper"):
                await transcribe_audio(upload)


if __name__ == "__main__":
    unittest.main()
