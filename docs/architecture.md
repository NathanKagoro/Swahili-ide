# Architecture

Swahili Voice IDE has three active layers: frontend UI, backend API/runtime, and local/cloud model providers.

## Frontend

- React + Vite
- Monaco editor for coding lessons
- Chat assistant panel with language toggle
- Voice capture and per-message playback controls

## Backend

- FastAPI API under `/api`
- Pyswahili-to-Python conversion before execution
- Restricted sandbox execution for submitted code
- STT and TTS services for speech workflows
- LLM orchestration with topic/language guardrails

## Data Storage

- SQLite database at `backend/data/swahili_ide.db` (path configurable via `sqlite_db_path`)
- Stores users, auth sessions, lesson progress, and chat history

## Model Providers

- STT: Whisper (`WHISPER_MODEL`)
- TTS: Piper (`TTS_PROVIDER=piper`)
- LLM: OpenRouter or Ollama (`LLM_PROVIDER`) with model selected by `LLM_MODEL`

## Audio Files

- Runtime TTS cache lives in `backend/audio`
- Lesson pre-generated narration files are named by lesson and language (for example `lesson-01_utangulizi_sw.wav`)
- A manifest file `backend/audio/lessons_manifest.json` maps each lesson/language to filename and cache hash

## Security Controls

- Code execution timeout limits
- Restricted runtime surface in sandbox
- Input length validation in request models
- Auth token validation on protected routes
