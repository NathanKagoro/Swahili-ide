# Setup Guide

## Prerequisites
- Python 3.11+
- Node.js 20+

## Backend
1. `cd backend`
2. `python -m venv .venv`
3. Activate virtual env
4. `pip install -r requirements.txt`
5. `uvicorn app.main:app --reload`

## Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Environment
Copy `backend/.env.example` to `backend/.env`.

## Database

- The app uses SQLite at `backend/data/swahili_ide.db` by default.
- It is created automatically on backend startup.
- It stores users, auth sessions, lesson progress, and chat history.

## Local TTS (Piper)
To run higher-quality local/offline text-to-speech:

1. Download a Piper executable for your OS.
2. Download a Swahili Piper model (`.onnx`) and its config (`.onnx.json`).
3. Set these values in `backend/.env`:
	- `TTS_PROVIDER=piper`
	- `PIPER_EXECUTABLE_PATH=<path-to-piper-exe>`
	- `PIPER_MODEL_PATH=<path-to-model.onnx>`
	- `PIPER_MODEL_CONFIG_PATH=<path-to-model.onnx.json>`

Generated speech files are cached under `backend/audio`.

## STT Provider Selection

Speech-to-text can run on Whisper (local) or Deepgram (cloud).

Set in `backend/.env`:

- `STT_PROVIDER=whisper` (default local model)
- `STT_PROVIDER=deepgram` (uses Deepgram API)

For Deepgram also set:

- `DEEPGRAM_API_KEY=<your-api-key>`
- `DEEPGRAM_MODEL=nova-3`
- `DEEPGRAM_LANGUAGE=sw`

## Pre-Generate Lesson Audio

From repo root:

```bash
python scripts/pregen_audio.py
```

This creates lesson narration audio files named with lesson and language, plus `backend/audio/lessons_manifest.json`.
