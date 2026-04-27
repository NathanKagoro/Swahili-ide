from typing import Any

from pydantic import BaseModel, Field


class SwahiliRunRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=8000)


class SwahiliRunResponse(BaseModel):
    output: str
    error: str | None = None


class AuthRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=120)


class UserResponse(BaseModel):
    id: int
    username: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    completed_lessons: dict[str, bool]


class ProgressUpdateRequest(BaseModel):
    completed_lessons: dict[str, bool]


class ProgressResponse(BaseModel):
    completed_lessons: dict[str, bool]


class LlmRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    source_language: str = "sw"
    target_language: str = "en"
    runtime_context: dict[str, Any] = Field(default_factory=dict)


class LlmResponse(BaseModel):
    result: str


class ChatHistoryItem(BaseModel):
    role: str = Field(..., pattern=r'^(user|assistant)$')
    text: str = Field(..., min_length=1, max_length=8000)
    code: str | None = Field(default=None, max_length=12000)
    created_at: str | None = None


class SaveChatHistoryRequest(BaseModel):
    messages: list[ChatHistoryItem] = Field(..., min_length=1, max_length=10)


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryItem]


class SpeechToTextResponse(BaseModel):
    text: str


class TextToSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    lang: str = Field('sw', pattern=r'^[a-z]{2}(_[A-Z]{2})?$')
    lesson_id: str | None = Field(default=None, max_length=80)


class TextToSpeechResponse(BaseModel):
    audio_base64: str
    mime_type: str = "audio/wav"
