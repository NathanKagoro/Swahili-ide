import unittest

from app.core.settings import settings
from app.services.swahili_service import run_swahili_code
from app.utils.sandbox import execute_safely


class SandboxExecutionTests(unittest.TestCase):
    def test_execute_safely_allows_basic_print(self) -> None:
        output, error = execute_safely('print("ok")')

        self.assertEqual(output, "ok\n")
        self.assertIsNone(error)

    def test_execute_safely_blocks_imports(self) -> None:
        output, error = execute_safely("import os")

        self.assertEqual(output, "")
        self.assertEqual(error, "Imports are not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_attribute_access(self) -> None:
        output, error = execute_safely("[].append(1)")

        self.assertEqual(output, "")
        self.assertEqual(error, "Attribute access is not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_getattr(self) -> None:
        output, error = execute_safely('getattr("abc", "upper")')

        self.assertEqual(output, "")
        self.assertEqual(error, "Use of 'getattr' is not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_class_definitions(self) -> None:
        output, error = execute_safely("class Kitu:\n    pass")

        self.assertEqual(output, "")
        self.assertEqual(error, "ClassDef is not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_lambda(self) -> None:
        output, error = execute_safely("f = lambda x: x + 1")

        self.assertEqual(output, "")
        self.assertEqual(error, "Lambda is not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_with_statements(self) -> None:
        output, error = execute_safely("with [1, 2, 3]:\n    print('x')")

        self.assertEqual(output, "")
        self.assertEqual(error, "With is not allowed in the Swahili sandbox.")

    def test_execute_safely_blocks_try_finally(self) -> None:
        output, error = execute_safely("try:\n    print('x')\nfinally:\n    print('y')")

        self.assertEqual(output, "")
        self.assertEqual(error, "try/finally is not allowed in the Swahili sandbox.")

    def test_execute_safely_times_out_infinite_loop(self) -> None:
        previous_timeout = settings.code_exec_timeout_seconds
        settings.code_exec_timeout_seconds = 1
        try:
            output, error = execute_safely("while True:\n    pass")
        finally:
            settings.code_exec_timeout_seconds = previous_timeout

        self.assertEqual(output, "")
        self.assertEqual(error, "Execution timed out.")

    def test_run_swahili_code_executes_supported_syntax(self) -> None:
        output, error = run_swahili_code('ikiwa i imo katiya(3):\n    andika(i)')

        self.assertEqual(output, "0\n1\n2\n")
        self.assertIsNone(error)

    def test_run_swahili_code_allows_functions(self) -> None:
        output, error = run_swahili_code('njia salimia(jina):\n    andika(jina)\n\nsalimia("Asha")')

        self.assertEqual(output, "Asha\n")
        self.assertIsNone(error)

    def test_run_swahili_code_allows_try_except(self) -> None:
        output, error = run_swahili_code('jaribu:\n    1 / 0\nila:\n    andika("imekamatwa")')

        self.assertEqual(output, "imekamatwa\n")
        self.assertIsNone(error)

    def test_run_swahili_code_allows_collections(self) -> None:
        output, error = run_swahili_code('orodha_ya_namba = [1, 2, 3]\nkamusi_ya_taarifa = {"jina": "Asha"}\nandika(len(orodha_ya_namba))\nandika(kamusi_ya_taarifa["jina"])')

        self.assertEqual(output, "3\nAsha\n")
        self.assertIsNone(error)


if __name__ == "__main__":
    unittest.main()