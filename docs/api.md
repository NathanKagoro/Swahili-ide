# API

Base URL: `http://localhost:8000/api`

## Health

- `GET /health`

## Swahili Runtime

- `POST /run-swahili`

Request body:
```json
{ "code": "andika('Habari')" }
```

Response body:
```json
{ "output": "Habari\n", "error": null }
```

## Speech

- `POST /transcribe` (multipart form-data, file field name: `file`)
- `POST /speak`

`/transcribe` uses the backend-selected provider from `STT_PROVIDER`:

- `whisper` for local transcription
- `deepgram` for Deepgram API transcription

Request body for `/speak`:
```json
{ "text": "Karibu darasani", "lang": "sw" }
```

Response body for `/speak`:
```json
{ "audio_base64": "...", "mime_type": "audio/wav" }
```

## LLM

- `POST /generate`
- `POST /explain`
- `POST /translate`

Request body for `/generate` and `/explain`:
```json
{
	"prompt": "Andika programu ndogo ya kujumlisha namba mbili",
	"target_language": "sw",
	"runtime_context": {
		"intent": "code_generation",
		"active_language": "sw"
	}
}
```

Request body for `/translate`:
```json
{ "prompt": "Habari", "source_language": "sw", "target_language": "en" }
```

## Auth And User Data

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout` (requires `Authorization: Bearer <token>`)
- `GET /auth/me` (requires bearer token)
- `GET /progress` (requires bearer token)
- `PUT /progress` (requires bearer token)
- `GET /chat/history` (requires bearer token)
- `POST /chat/history` (requires bearer token)

Progress update request body:
```json
{ "completed_lessons": { "utangulizi": true, "sintaksia": true } }
```
