from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
BACKEND_DATA_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "swahili_ide.db"


class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:5173"
    sqlite_db_path: str = str(BACKEND_DATA_DB_PATH)

    use_llm: bool = True
    llm_provider: str = "openrouter"
    llm_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_timeout_seconds: int = 60
    llm_max_output_tokens: int = 900
    llm_runtime_context_max_chars: int = 3500
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_app_name: str = "Swahili Voice IDE"
    openrouter_site_url: str = ""

    stt_provider: str = "whisper"
    whisper_model: str = "small"
    deepgram_api_key: str = ""
    deepgram_model: str = "nova-3"
    deepgram_language: str = "sw"
    tts_provider: str = "piper"
    tts_voice: str = "sw"
    piper_executable_path: str = ""
    piper_model_path: str = ""
    piper_model_config_path: str = ""
    piper_en_model_path: str = ""
    piper_en_model_config_path: str = ""

    code_exec_timeout_seconds: int = 5
    max_input_chars: int = 8000

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
