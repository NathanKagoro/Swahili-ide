from fastapi import APIRouter, Header, HTTPException, Query, status

from app.core.settings import settings
from app.models.request_models import (
    ChatHistoryResponse,
    LlmRequest,
    LlmResponse,
    SaveChatHistoryRequest,
)
from app.services.auth_service import get_user_by_token
from app.services.chat_history_service import get_chat_messages, save_chat_messages
from app.services.llm_service import explain_code, generate_text
from app.services.translation import translate_text
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# Extract and validate a bearer token from Authorization header.
def _get_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing bearer token.')
    return authorization.replace('Bearer ', '', 1).strip()


@router.get('/llm/config')
def llm_config() -> dict[str, str | bool | int]:
    # Useful diagnostics for confirming which LLM provider/model is active.
    return {
        'provider': settings.llm_provider,
        'model': settings.llm_model,
        'openrouter_base_url': settings.openrouter_base_url,
        'openrouter_key_present': bool(settings.openrouter_api_key.strip()),
        'openrouter_key_len': len(settings.openrouter_api_key or ''),
    }


@router.post("/generate", response_model=LlmResponse)
def generate(payload: LlmRequest) -> LlmResponse:
    # Log runtime context so we can verify what the frontend sent.
    logger.info('LLM runtime_context (/generate): %s', payload.runtime_context)
    print(f"LLM runtime_context (/generate): {payload.runtime_context}")
    return LlmResponse(
        result=generate_text(
            payload.prompt,
            payload.target_language,
            payload.runtime_context,
        )
    )


@router.post("/explain", response_model=LlmResponse)
def explain(payload: LlmRequest) -> LlmResponse:
    # Log runtime context so we can verify what the frontend sent.
    logger.info('LLM runtime_context (/explain): %s', payload.runtime_context)
    print(f"LLM runtime_context (/explain): {payload.runtime_context}")
    return LlmResponse(
        result=explain_code(
            payload.prompt,
            payload.target_language,
            payload.runtime_context,
        )
    )


@router.post("/translate", response_model=LlmResponse)
def translate(payload: LlmRequest) -> LlmResponse:
    translated = translate_text(
        text=payload.prompt,
        source_language=payload.source_language,
        target_language=payload.target_language,
    )
    return LlmResponse(result=translated)


@router.get('/chat/history', response_model=ChatHistoryResponse)
def read_chat_history(
    authorization: str | None = Header(default=None),
    limit: int = Query(default=20, ge=1, le=50),
) -> ChatHistoryResponse:
    token = _get_bearer_token(authorization)
    user = get_user_by_token(token)
    messages = get_chat_messages(user_id=user['id'], limit=limit)
    return ChatHistoryResponse(messages=messages)


@router.post('/chat/history', response_model=ChatHistoryResponse)
def write_chat_history(
    payload: SaveChatHistoryRequest,
    authorization: str | None = Header(default=None),
) -> ChatHistoryResponse:
    token = _get_bearer_token(authorization)
    user = get_user_by_token(token)
    messages = save_chat_messages(user_id=user['id'], messages=[m.model_dump() for m in payload.messages])
    return ChatHistoryResponse(messages=messages)
