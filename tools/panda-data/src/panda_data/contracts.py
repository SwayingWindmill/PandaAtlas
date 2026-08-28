from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

CONTRACT_FILES = {
    "artifact-manifest": "artifact-manifest.v1.schema.json",
    "pipeline-job": "pipeline-job.v1.schema.json",
    "pipeline-result": "pipeline-result.v1.schema.json",
}


class ContractError(ValueError):
    """Raised when a panda-data wire/storage payload violates its canonical schema."""


def contract_directory() -> Path:
    configured = os.getenv("PANDA_DATA_CONTRACT_DIR")
    if configured:
        path = Path(configured).expanduser().resolve()
        if not path.is_dir():
            raise ContractError(f"PANDA_DATA_CONTRACT_DIR does not exist: {path}")
        return path

    for parent in Path(__file__).resolve().parents:
        candidate = parent / "contracts" / "panda-data"
        if candidate.is_dir():
            return candidate
    raise ContractError(
        "Could not locate contracts/panda-data. Set PANDA_DATA_CONTRACT_DIR "
        "when running outside the repository."
    )


@lru_cache(maxsize=len(CONTRACT_FILES))
def load_schema(name: str) -> dict[str, Any]:
    try:
        filename = CONTRACT_FILES[name]
    except KeyError as error:
        raise ContractError(f"Unknown panda-data contract: {name}") from error
    path = contract_directory() / filename
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ContractError(f"Contract root must be an object: {path}")
    Draft202012Validator.check_schema(payload)
    return payload


def validate_contract(name: str, value: object) -> None:
    validator = Draft202012Validator(load_schema(name), format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(value), key=lambda error: list(error.absolute_path))
    if not errors:
        return
    details = "; ".join(
        f"{'.'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.message}"
        for error in errors[:10]
    )
    raise ContractError(f"{name} contract validation failed: {details}")


def check_contracts() -> tuple[str, ...]:
    checked: list[str] = []
    for name in sorted(CONTRACT_FILES):
        load_schema(name)
        checked.append(name)
    return tuple(checked)
