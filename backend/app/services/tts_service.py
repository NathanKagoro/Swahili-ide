from __future__ import annotations

import hashlib
import json
import logging
import subprocess
from pathlib import Path

from app.core.settings import settings

logger = logging.getLogger(__name__)

if settings.tts_provider.lower() != 'piper':
    logger.warning('[TTS] Non-piper provider configured (%s). This service enforces Piper-only mode.', settings.tts_provider)
logger.info(
    '[TTS] Provider: Piper | exe=%s | sw_model=%s | en_model=%s',
    settings.piper_executable_path or '(not set)',
    settings.piper_model_path or '(not set)',
    settings.piper_en_model_path or '(not set)',
)


BASE_DIR = Path(__file__).resolve().parents[2]
AUDIO_DIR = BASE_DIR / 'audio'
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_if_present(value: str) -> Path | None:
    if not value:
        return None
    path = Path(value)
    if path.is_absolute():
        return path
    return (BASE_DIR / path).resolve()


def _synthesize_with_piper(text: str, output_path: Path, model_path: str = '', model_config_path: str = '') -> bool:
    piper_executable = _resolve_if_present(settings.piper_executable_path)
    piper_model = _resolve_if_present(model_path or settings.piper_model_path)
    piper_model_config = _resolve_if_present(model_config_path or settings.piper_model_config_path)

    if not piper_executable or not piper_executable.exists():
        logger.debug('[TTS] Piper skipped: executable not found at %s', settings.piper_executable_path or '<not set>')
        return False
    if not piper_model or not piper_model.exists():
        logger.debug('[TTS] Piper skipped: model not found at %s', (model_path or settings.piper_model_path) or '<not set>')
        return False

    command = [
        str(piper_executable),
        '--model',
        str(piper_model),
        '--output_file',
        str(output_path),
    ]
    if piper_model_config and piper_model_config.exists():
        command.extend(['--config', str(piper_model_config)])

    result = subprocess.run(
        command,
        input=text.encode('utf-8'),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        error_text = result.stderr.decode('utf-8', errors='ignore').strip()
        raise RuntimeError(f'Piper TTS failed: {error_text or "unknown error"}')

    success = output_path.exists() and output_path.stat().st_size > 0
    if success:
        logger.info('[TTS] Piper synthesized %d chars -> %s', len(text), output_path.name)
    return success


def _read_pregenerated_lesson_audio(lesson_id: str, lang: str) -> bytes | None:
    manifest_path = AUDIO_DIR / 'lessons_manifest.json'
    if not manifest_path.exists():
        return None

    lang_code = 'en' if lang.lower().startswith('en') else 'sw'
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        lesson_entry = (manifest.get('files') or {}).get(lesson_id) or {}
        lang_entry = lesson_entry.get(lang_code) or {}
        relative_path = (lang_entry.get('relative_path') or '').strip()
        if not relative_path:
            return None

        audio_path = (BASE_DIR / relative_path).resolve()
        if audio_path.exists() and audio_path.is_file():
            logger.info('[TTS] Using pre-generated lesson audio: lesson=%s lang=%s file=%s', lesson_id, lang_code, audio_path.name)
            return audio_path.read_bytes()
    except Exception as exc:
        logger.debug('[TTS] Could not load pre-generated lesson audio for lesson=%s: %s', lesson_id, exc)

    return None


def _read_pregenerated_audio_by_hash(cleaned_text: str, lang: str) -> bytes | None:
    manifest_path = AUDIO_DIR / 'lessons_manifest.json'
    if not manifest_path.exists():
        return None

    lang_code = 'en' if lang.lower().startswith('en') else 'sw'
    cache_hash = hashlib.sha256(f'{lang}:{cleaned_text}'.encode('utf-8')).hexdigest()
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        files = manifest.get('files') or {}
        for lesson_data in files.values():
            lang_entry = (lesson_data or {}).get(lang_code) or {}
            if str(lang_entry.get('cache_hash') or '').strip() != cache_hash:
                continue
            relative_path = str(lang_entry.get('relative_path') or '').strip()
            if not relative_path:
                continue
            audio_path = (BASE_DIR / relative_path).resolve()
            if audio_path.exists() and audio_path.is_file():
                logger.info('[TTS] Using pre-generated audio by cache hash: %s', audio_path.name)
                return audio_path.read_bytes()
    except Exception as exc:
        logger.debug('[TTS] Could not load pre-generated cache-hash audio: %s', exc)

    return None


def synthesize_speech(text: str, lang: str = 'sw', lesson_id: str | None = None) -> bytes:
    cleaned_text = ' '.join(text.split())
    if not cleaned_text:
        raise ValueError('Text cannot be empty.')

    # For lesson narration, prefer deterministic pre-generated files from the manifest.
    if lesson_id:
        pregenerated = _read_pregenerated_lesson_audio(lesson_id=lesson_id, lang=lang)
        if pregenerated is not None:
            return pregenerated

    # If caller did not include lesson_id but text matches a pre-generated narration,
    # use the pre-recorded audio before live synthesis.
    pregenerated_by_hash = _read_pregenerated_audio_by_hash(cleaned_text=cleaned_text, lang=lang)
    if pregenerated_by_hash is not None:
        return pregenerated_by_hash

    # Include lang in cache key so sw and en don't collide
    cache_key = hashlib.sha256(f'{lang}:{cleaned_text}'.encode('utf-8')).hexdigest()
    output_path = AUDIO_DIR / f'{cache_key}.wav'
    if output_path.exists() and output_path.stat().st_size > 0:
        return output_path.read_bytes()

    # Pick the correct Piper model for the requested language
    is_english = lang.lower().startswith('en')
    if is_english and settings.piper_en_model_path:
        model_path = settings.piper_en_model_path
        model_config_path = settings.piper_en_model_config_path
    else:
        model_path = settings.piper_model_path
        model_config_path = settings.piper_model_config_path

    logger.info('[TTS] synthesize_speech lang=%s model=%s text_len=%d', lang, model_path or '(default)', len(cleaned_text))

    if settings.tts_provider.lower() != 'piper':
        raise RuntimeError('TTS provider must be piper.')

    if not _synthesize_with_piper(cleaned_text, output_path, model_path, model_config_path):
        raise RuntimeError('Piper TTS failed to produce an audio file.')

    logger.info('[TTS] synthesize_speech used_engine=piper text_len=%d', len(cleaned_text))

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError('TTS generation did not produce an audio file.')

    return output_path.read_bytes()
