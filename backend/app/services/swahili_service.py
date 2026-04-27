from app.utils.sandbox import execute_safely


# Convert Pyswahili source to Python, then execute it in the restricted sandbox.
def run_swahili_code(code: str) -> tuple[str, str | None]:
    try:
        from pyswahili.swahili_node import PySwahili
    except Exception as exc:  # noqa: BLE001
        return "", f"pyswahili haijapatikana: {exc}"

    try:
        transpiler = PySwahili()
        english_code = transpiler.convert_to_english(code)
        if not english_code or not str(english_code).strip():
            return "", "Imeshindikana kutafsiri msimbo wa Kiswahili kwenda Python."
    except Exception as exc:  # noqa: BLE001
        return "", f"Hitilafu ya kutafsiri msimbo: {exc}"

    return execute_safely(str(english_code))
