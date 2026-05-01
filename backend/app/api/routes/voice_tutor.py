import asyncio
import json
import threading
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.settings import settings
from app.services.deepgram_voice_agent_service import (
    build_voice_tutor_prompt,
    get_voice_tutor_runtime_config,
)
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


def _event_to_dict(message: Any) -> dict[str, Any]:
    if isinstance(message, dict):
        return message
    if hasattr(message, "to_dict"):
        data = message.to_dict()
        if isinstance(data, dict):
            return data

    payload: dict[str, Any] = {}
    if hasattr(message, "__dict__"):
        for key, value in vars(message).items():
            if isinstance(value, (str, int, float, bool, type(None))):
                payload[key] = value
            else:
                payload[key] = str(value)
    payload.setdefault("type", getattr(message, "type", "Unknown"))
    return payload


@router.get("/voice/tutor/config")
def voice_tutor_config() -> dict[str, Any]:
    return {
        "enabled": settings.deepgram_agent_enabled,
        "runtime": get_voice_tutor_runtime_config(),
        "deepgram_key_present": bool(settings.deepgram_api_key.strip()),
    }


@router.websocket("/voice/tutor/ws")
async def voice_tutor_ws(websocket: WebSocket) -> None:
    await websocket.accept()

    if not settings.deepgram_agent_enabled:
        await websocket.send_json(
            {
                "type": "error",
                "detail": "Voice Tutor imezimwa. Weka DEEPGRAM_AGENT_ENABLED=true.",
            }
        )
        await websocket.close(code=1008)
        return

    if not settings.deepgram_api_key.strip():
        await websocket.send_json(
            {
                "type": "error",
                "detail": "DEEPGRAM_API_KEY haijawekwa.",
            }
        )
        await websocket.close(code=1008)
        return

    try:
        from deepgram import DeepgramClient
        from deepgram.agent.v1.types import (
            AgentV1Settings,
            AgentV1SettingsAgent,
            AgentV1SettingsAgentListen,
            AgentV1SettingsAgentListenProvider_V1,
            AgentV1SettingsAudio,
            AgentV1SettingsAudioInput,
            AgentV1SettingsAudioOutput,
        )
        from deepgram.core.events import EventType
        from deepgram.types.speak_settings_v1 import SpeakSettingsV1
        from deepgram.types.speak_settings_v1provider import SpeakSettingsV1Provider_Deepgram
        from deepgram.types.think_settings_v1 import ThinkSettingsV1
        from deepgram.types.think_settings_v1provider import ThinkSettingsV1Provider_OpenAi
    except Exception as exc:  # noqa: BLE001
        await websocket.send_json(
            {
                "type": "error",
                "detail": f"Deepgram Agent SDK import failed: {exc}",
            }
        )
        await websocket.close(code=1011)
        return

    try:
        start_message = await websocket.receive_text()
        start_payload = json.loads(start_message)
    except Exception as exc:  # noqa: BLE001
        await websocket.send_json(
            {
                "type": "error",
                "detail": f"Invalid start payload: {exc}",
            }
        )
        await websocket.close(code=1003)
        return

    language = str(start_payload.get("language") or "en")[:8]
    chat_context = start_payload.get("chat_context") or []
    if not isinstance(chat_context, list):
        chat_context = []

    prompt = build_voice_tutor_prompt(chat_context)
    loop = asyncio.get_running_loop()
    stop_event = threading.Event()

    try:
        client = DeepgramClient(api_key=settings.deepgram_api_key)
        connection = client.agent.v1.connect()

        def _send_json(payload: dict[str, Any]) -> None:
            asyncio.run_coroutine_threadsafe(websocket.send_json(payload), loop)

        def _send_bytes(payload: bytes) -> None:
            asyncio.run_coroutine_threadsafe(websocket.send_bytes(payload), loop)

        def on_open(_event: Any) -> None:
            _send_json({"type": "agent_open"})

        def on_message(message: Any) -> None:
            if isinstance(message, bytes):
                _send_bytes(message)
                return
            _send_json({"type": "agent_event", "payload": _event_to_dict(message)})

        def on_error(error: Any) -> None:
            _send_json({"type": "error", "detail": str(error)})

        def on_close(_event: Any) -> None:
            _send_json({"type": "agent_closed"})

        connection.on(EventType.OPEN, on_open)
        connection.on(EventType.MESSAGE, on_message)
        connection.on(EventType.ERROR, on_error)
        connection.on(EventType.CLOSE, on_close)

        settings_payload = AgentV1Settings(
            audio=AgentV1SettingsAudio(
                input=AgentV1SettingsAudioInput(
                    encoding="linear16",
                    sample_rate=24000,
                ),
                output=AgentV1SettingsAudioOutput(
                    encoding="linear16",
                    sample_rate=24000,
                    container="none",
                ),
            ),
            agent=AgentV1SettingsAgent(
                language=language if language.startswith("en") else "en",
                listen=AgentV1SettingsAgentListen(
                    provider=AgentV1SettingsAgentListenProvider_V1(
                        type="deepgram",
                        model=settings.deepgram_agent_listen_model,
                    )
                ),
                think=ThinkSettingsV1(
                    provider=ThinkSettingsV1Provider_OpenAi(
                        type="open_ai",
                        model=settings.deepgram_agent_think_model,
                    ),
                    prompt=prompt,
                ),
                speak=SpeakSettingsV1(
                    provider=SpeakSettingsV1Provider_Deepgram(
                        type="deepgram",
                        model=settings.deepgram_agent_speak_model,
                    )
                ),
                greeting=settings.deepgram_agent_greeting,
            ),
        )

        connection.send_settings(settings_payload)
        listener_thread = threading.Thread(target=connection.start_listening, daemon=True)
        listener_thread.start()

        def _keep_alive() -> None:
            while not stop_event.is_set():
                try:
                    connection.send_keep_alive()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Deepgram keep-alive failed: %s", exc)
                    return
                stop_event.wait(4)

        keep_alive_thread = threading.Thread(target=_keep_alive, daemon=True)
        keep_alive_thread.start()

        await websocket.send_json({"type": "ready"})

        while True:
            message = await websocket.receive()
            data = message.get("bytes")
            if data is not None:
                connection.send_media(data)
                continue

            text = message.get("text")
            if not text:
                continue

            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue

            if payload.get("type") == "stop":
                break
            if payload.get("type") == "keepalive":
                connection.send_keep_alive()

    except WebSocketDisconnect:
        logger.info("Voice tutor websocket disconnected")
    except Exception as exc:  # noqa: BLE001
        await websocket.send_json({"type": "error", "detail": str(exc)})
    finally:
        stop_event.set()
        try:
            if "connection" in locals():
                if hasattr(connection, "finish"):
                    connection.finish()
                elif hasattr(connection, "close"):
                    connection.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass