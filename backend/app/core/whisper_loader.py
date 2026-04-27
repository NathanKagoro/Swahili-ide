from functools import lru_cache
from typing import Any


@lru_cache(maxsize=2)
def _load_whisper_model_cached(model_name: str) -> Any:
    import whisper

    return whisper.load_model(model_name)


def load_whisper_model(model_name: str = "base") -> Any:
    return _load_whisper_model_cached(model_name)