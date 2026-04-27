from fastapi import APIRouter, File, UploadFile
from fastapi import HTTPException, status

from app.models.request_models import (
    SpeechToTextResponse,
    TextToSpeechRequest,
    TextToSpeechResponse,
)
from app.services.stt_service import transcribe_audio
from app.services.tts_service import synthesize_speech
from app.utils.audio import to_base64

router = APIRouter()


@router.post("/transcribe", response_model=SpeechToTextResponse)
async def transcribe(file: UploadFile = File(...)) -> SpeechToTextResponse:
    try:
        text = await transcribe_audio(file)
        return SpeechToTextResponse(text=text)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/speak", response_model=TextToSpeechResponse)
def speak(payload: TextToSpeechRequest) -> TextToSpeechResponse:
    try:
        audio = synthesize_speech(payload.text, payload.lang, payload.lesson_id)
        return TextToSpeechResponse(audio_base64=to_base64(audio))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
