import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.llm import router as llm_router
from app.api.routes.speech import router as speech_router
from app.api.routes.swahili import router as swahili_router
from app.core.settings import settings
from app.db.database import init_database

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(name)s: %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Swahili Voice IDE API", version="0.1.0")

init_database()


@app.on_event('startup')
def _log_startup() -> None:
    piper_ready = (
        bool(settings.piper_executable_path) and bool(settings.piper_model_path)
    )
    tts_status = (
        f'Piper (exe={settings.piper_executable_path}, model={settings.piper_model_path})'
        if piper_ready
        else 'Piper paths not configured'
    )
    logger.info('=' * 60)
    logger.info('  Swahili Voice IDE Backend  v0.1.0')
    logger.info('  TTS provider : %s  (configured=%s)', settings.tts_provider, settings.tts_provider)
    logger.info('  TTS active   : %s', tts_status)
    logger.info('  Frontend URL : %s', settings.frontend_origin)
    logger.info('=' * 60)

_origins = [o.strip() for o in settings.frontend_origin.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(swahili_router, prefix="/api", tags=["swahili"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(speech_router, prefix="/api", tags=["speech"])
app.include_router(llm_router, prefix="/api", tags=["llm"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
