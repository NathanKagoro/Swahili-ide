# Swahili Voice IDE

Swahili Voice IDE is a web-based coding environment for learning and practicing Python/Pyswahili with voice and optional LLM assistance.

## Core Features

- Write and run Swahili-style code through a sandboxed backend runtime
- Convert speech to text (Whisper)
- Generate speech from text (Piper local TTS)
- Use LLM assistance for coding explanation/generation and translation
- Track user progress and chat history in SQLite

## Project Layout

- `frontend/`: React + Vite app (Monaco editor, lessons, chat, voice UI)
- `backend/app/`: FastAPI routes, services, settings, and sandbox runtime
- `backend/piper/`: local Piper executable and runtime files (binary assets)
- `models/piper/`: Piper voice model files (`.onnx` + `.onnx.json`)
- `backend/audio/`: generated/cached TTS files and lesson audio manifest
- `scripts/pregen_audio.py`: pre-generates lesson narration audio files

## Runtime Components

- Code execution: `pyswahili` conversion + restricted Python sandbox
- STT: Whisper (default) or Deepgram via `STT_PROVIDER`
- TTS: Piper (`TTS_PROVIDER=piper`)
- LLM: OpenRouter or Ollama (`LLM_PROVIDER`)

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Setup

Copy:

```bash
backend/.env.example -> backend/.env
```

Important notes:

- Backend reads env vars from `backend/.env`
- SQLite database path defaults to `backend/data/swahili_ide.db`
- `PIPER_EXECUTABLE_PATH`, `PIPER_MODEL_PATH`, and related Piper paths are resolved from `backend/` when relative

## Database

SQLite file:

- `backend/data/swahili_ide.db`

Stores:

- Users
- Sessions
- Lesson progress
- Chat history

## Lesson Audio Generation

To generate lesson narration audio files for both English and Swahili:

```bash
python scripts/pregen_audio.py
```

Output:

- Named files such as `lesson-01_utangulizi_sw.wav` in `backend/audio/`
- `backend/audio/lessons_manifest.json` mapping lesson/language to filenames and cache hashes

## Frontend Build Output

Frontend production build is configured to output to:

- `frontend/frontend-build/`

Commands:

```bash
cd frontend
npm run build
npm run preview
```

`netlify.toml` is configured to publish `frontend-build`.

## API Reference

See:

- `docs/api.md`
- `docs/architecture.md`
- `docs/setup.md`

Base API URL (local):

- `http://localhost:8000/api`

## Security Notes

- Sandboxed code execution
- Timeout limits for code execution
- Request input limits in API models
- Protected routes require bearer tokens
