def translate_text(text: str, source_language: str, target_language: str) -> str:
    # TODO: route to LLM translation when enabled.
    if source_language == target_language:
        return text
    return f"[stub translation {source_language}->{target_language}] {text}"
