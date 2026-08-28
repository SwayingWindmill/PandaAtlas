from __future__ import annotations

import ast
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src" / "panda_data"
FORBIDDEN_IMPORT_ROOTS = {"app", "fastapi", "sqlalchemy", "uvicorn", "joblib", "pickle"}


def test_panda_data_has_no_api_runtime_or_unsafe_serialization_imports() -> None:
    violations: list[str] = []
    for path in sorted(SOURCE_ROOT.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.append(node.module)
            for name in names:
                root = name.split(".", 1)[0]
                if root in FORBIDDEN_IMPORT_ROOTS or name.startswith("services.api.app"):
                    violations.append(f"{path.relative_to(SOURCE_ROOT)}:{node.lineno}: {name}")
    assert violations == []
