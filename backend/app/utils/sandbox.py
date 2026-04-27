import json
import os
import subprocess
import sys
import tempfile
import textwrap

from app.core.settings import settings


_RUNNER_TEMPLATE = textwrap.dedent(
    """
    import ast
    import builtins
    import contextlib
    import io
    import json
    import sys

    USER_CODE = {user_code!r}
    MAX_OUTPUT_CHARS = {max_output_chars}
    BLOCKED_NAMES = {blocked_names!r}
    SAFE_BUILTINS = {{
        name: getattr(builtins, name)
        for name in {safe_builtins!r}
    }}
    BANNED_NODE_TYPES = tuple(getattr(ast, name) for name in {banned_node_types!r})

    def fail(message):
        raise ValueError(message)

    class SafetyVisitor(ast.NodeVisitor):
        def generic_visit(self, node):
            if isinstance(node, BANNED_NODE_TYPES):
                fail(f"{{type(node).__name__}} is not allowed in the Swahili sandbox.")
            super().generic_visit(node)

        def visit_Import(self, node):
            fail("Imports are not allowed in the Swahili sandbox.")

        def visit_ImportFrom(self, node):
            fail("Imports are not allowed in the Swahili sandbox.")

        def visit_Attribute(self, node):
            fail("Attribute access is not allowed in the Swahili sandbox.")

        def visit_Name(self, node):
            if node.id.startswith("__") or node.id in BLOCKED_NAMES:
                fail(f"Use of '{{node.id}}' is not allowed in the Swahili sandbox.")
            self.generic_visit(node)

        def visit_Try(self, node):
            if node.orelse:
                fail("try/else is not allowed in the Swahili sandbox.")
            if node.finalbody:
                fail("try/finally is not allowed in the Swahili sandbox.")

            for handler in node.handlers:
                if handler.type is None:
                    continue
                if not isinstance(handler.type, ast.Name) or handler.type.id != "Exception":
                    fail("Only bare except or except Exception is allowed in the Swahili sandbox.")

            self.generic_visit(node)

    output_stream = io.StringIO()
    payload = {{"output": "", "error": None}}

    try:
        tree = ast.parse(USER_CODE, mode="exec")
        SafetyVisitor().visit(tree)
        safe_globals = {{"__builtins__": SAFE_BUILTINS}}
        safe_locals = {{}}
        with contextlib.redirect_stdout(output_stream):
            exec(compile(tree, "<swahili-sandbox>", "exec"), safe_globals, safe_locals)
    except Exception as exc:
        payload["error"] = str(exc)

    payload["output"] = output_stream.getvalue()[:MAX_OUTPUT_CHARS]
    sys.__stdout__.write(json.dumps(payload))
    """
)

_SAFE_BUILTINS = (
    "Exception",
    "abs",
    "bool",
    "dict",
    "enumerate",
    "float",
    "int",
    "len",
    "list",
    "max",
    "min",
    "print",
    "range",
    "reversed",
    "round",
    "set",
    "str",
    "sum",
    "tuple",
)

_BLOCKED_NAMES = (
    "__import__",
    "breakpoint",
    "compile",
    "callable",
    "delattr",
    "dir",
    "eval",
    "exec",
    "getattr",
    "globals",
    "hasattr",
    "help",
    "input",
    "locals",
    "object",
    "open",
    "setattr",
    "super",
    "type",
    "vars",
)

_BANNED_NODE_TYPES = (
    "Assert",
    "AsyncFor",
    "AsyncFunctionDef",
    "AsyncWith",
    "Await",
    "ClassDef",
    "Delete",
    "DictComp",
    "GeneratorExp",
    "Global",
    "Lambda",
    "ListComp",
    "Match",
    "Nonlocal",
    "Raise",
    "SetComp",
    "With",
    "Yield",
    "YieldFrom",
)


# Execute already-transpiled Python in an isolated subprocess with AST safety checks.
def execute_safely(code: str) -> tuple[str, str | None]:
    runner_code = _RUNNER_TEMPLATE.format(
        banned_node_types=_BANNED_NODE_TYPES,
        user_code=code,
        max_output_chars=settings.max_input_chars,
        blocked_names=_BLOCKED_NAMES,
        safe_builtins=_SAFE_BUILTINS,
    )

    try:
        with tempfile.TemporaryDirectory(prefix="swahili-sandbox-") as temp_dir:
            runner_path = os.path.join(temp_dir, "runner.py")
            with open(runner_path, "w", encoding="utf-8") as runner_file:
                runner_file.write(runner_code)

            completed = subprocess.run(
                [sys.executable, "-I", "-S", runner_path],
                capture_output=True,
                text=True,
                cwd=temp_dir,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                timeout=settings.code_exec_timeout_seconds,
                check=False,
            )
    except subprocess.TimeoutExpired as exc:
        partial_output = (exc.stdout or "")[: settings.max_input_chars]
        return partial_output, "Execution timed out."
    except Exception as exc:  # noqa: BLE001
        return "", f"Sandbox execution failed: {exc}"

    if completed.returncode != 0:
        error = completed.stderr.strip() or "Sandbox process failed."
        return "", error

    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        error = completed.stderr.strip() or "Sandbox returned invalid output."
        return "", error

    output = str(payload.get("output", ""))[: settings.max_input_chars]
    error = payload.get("error")
    if error is not None:
        error = str(error)

    return output, error
