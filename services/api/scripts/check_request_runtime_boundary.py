from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import re
import sys
import tomllib
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CONTRACT_PATH = _REPOSITORY_ROOT / "contracts" / "api-request-runtime-boundary.v1.json"
_DISTRIBUTION_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+")


@dataclass(frozen=True)
class ImportReference:
    module: str
    line: int


@dataclass(frozen=True)
class RuntimeBoundaryReport:
    entrypoints: tuple[str, ...]
    modules: tuple[str, ...]
    external_import_roots: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "entrypoints": list(self.entrypoints),
            "modules_checked": len(self.modules),
            "modules": list(self.modules),
            "external_import_roots": list(self.external_import_roots),
        }


class RuntimeBoundaryError(RuntimeError):
    def __init__(self, violations: list[str]) -> None:
        ordered = sorted(set(violations))
        super().__init__(f"API request runtime boundary failed with {len(ordered)} violation(s)")
        self.violations = ordered


def _normalize_distribution_name(value: str) -> str:
    match = _DISTRIBUTION_PATTERN.match(value.strip())
    if match is None:
        return ""
    return re.sub(r"[-_.]+", "-", match.group(0)).lower()


def _matches_prefix(module: str, prefix: str) -> bool:
    return module == prefix or module.startswith(f"{prefix}.")


def _module_path(service_root: Path, application_package: str, module: str) -> Path | None:
    if not _matches_prefix(module, application_package):
        return None

    relative_parts = module.split(".")[1:]
    package_root = service_root / application_package
    module_file = package_root.joinpath(*relative_parts).with_suffix(".py")
    package_file = package_root.joinpath(*relative_parts, "__init__.py")

    if module_file.is_file():
        return module_file
    if package_file.is_file():
        return package_file
    return None


def _resolve_from_module(
    node: ast.ImportFrom,
    *,
    current_module: str,
    current_path: Path,
) -> str | None:
    if node.level == 0:
        return node.module

    package = (
        current_module
        if current_path.name == "__init__.py"
        else current_module.rpartition(".")[0]
    )
    if not package:
        return None

    relative_name = f"{'.' * node.level}{node.module or ''}"
    try:
        return importlib.util.resolve_name(relative_name, package)
    except (ImportError, ValueError):
        return None


def _parse_imports(
    *,
    module: str,
    module_path: Path,
    service_root: Path,
    application_package: str,
) -> tuple[list[ImportReference], list[str]]:
    try:
        source = module_path.read_text(encoding="utf-8-sig")
        tree = ast.parse(source, filename=str(module_path))
    except (OSError, SyntaxError) as error:
        return [], [f"{module}: unable to parse {module_path}: {error}"]

    references: list[ImportReference] = []
    dynamic_import_aliases = {"__import__"}
    importlib_aliases = {"importlib"}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                references.append(ImportReference(module=alias.name, line=node.lineno))
                if alias.name == "importlib":
                    importlib_aliases.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom):
            base_module = _resolve_from_module(
                node,
                current_module=module,
                current_path=module_path,
            )
            if base_module:
                references.append(ImportReference(module=base_module, line=node.lineno))
                for alias in node.names:
                    if alias.name == "*":
                        continue
                    candidate = f"{base_module}.{alias.name}"
                    if _module_path(service_root, application_package, candidate) is not None:
                        references.append(ImportReference(module=candidate, line=node.lineno))
                    if base_module == "importlib" and alias.name == "import_module":
                        dynamic_import_aliases.add(alias.asname or alias.name)

    violations: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if isinstance(function, ast.Name) and function.id in dynamic_import_aliases:
            violations.append(
                f"{module}:{node.lineno}: dynamic import through {function.id} is forbidden"
            )
        elif (
            isinstance(function, ast.Attribute)
            and function.attr == "import_module"
            and isinstance(function.value, ast.Name)
            and function.value.id in importlib_aliases
        ):
            violations.append(
                f"{module}:{node.lineno}: dynamic import through "
                f"{function.value.id}.import_module is forbidden"
            )

    deduplicated = sorted(set(references), key=lambda item: (item.module, item.line))
    return deduplicated, violations


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def _validate_contract(contract: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    if contract.get("schema_version") != 1:
        violations.append("contract schema_version must be 1")

    for field in (
        "entrypoints",
        "batch_only_prefixes",
        "forbidden_local_roots",
        "forbidden_request_import_roots",
        "separated_dependencies",
    ):
        value = contract.get(field)
        if not isinstance(value, list):
            violations.append(f"contract field {field} must be an array")

    if not isinstance(contract.get("service_root"), str):
        violations.append("contract field service_root must be a string")
    if not isinstance(contract.get("application_package"), str):
        violations.append("contract field application_package must be a string")
    return violations


def _validate_dependency_separation(
    *,
    service_root: Path,
    separated_dependencies: list[dict[str, Any]],
) -> list[str]:
    pyproject_path = service_root / "pyproject.toml"
    try:
        pyproject = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        return [f"unable to read {pyproject_path}: {error}"]

    project = pyproject.get("project", {})
    base_dependencies = {
        _normalize_distribution_name(item)
        for item in project.get("dependencies", [])
        if isinstance(item, str)
    }
    optional_groups = {
        str(group): {
            _normalize_distribution_name(item)
            for item in dependencies
            if isinstance(item, str)
        }
        for group, dependencies in project.get("optional-dependencies", {}).items()
        if isinstance(dependencies, list)
    }

    violations: list[str] = []
    for item in separated_dependencies:
        if not isinstance(item, dict):
            violations.append("separated_dependencies entries must be objects")
            continue
        distribution = _normalize_distribution_name(str(item.get("distribution", "")))
        required_group = str(item.get("required_optional_group", ""))
        if not distribution or not required_group:
            violations.append(
                "separated_dependencies entries require distribution and required_optional_group"
            )
            continue
        if distribution in base_dependencies:
            violations.append(
                f"distribution {distribution} must not be a base request dependency"
            )
        if distribution not in optional_groups.get(required_group, set()):
            violations.append(
                f"distribution {distribution} must remain in optional group {required_group}"
            )
    return violations


def analyze_request_runtime_boundary(
    *,
    repository_root: Path = _REPOSITORY_ROOT,
    contract_path: Path = _DEFAULT_CONTRACT_PATH,
) -> RuntimeBoundaryReport:
    contract = _load_json(contract_path)
    violations = _validate_contract(contract)
    if violations:
        raise RuntimeBoundaryError(violations)

    service_root = repository_root / str(contract["service_root"])
    application_package = str(contract["application_package"])
    entrypoints = tuple(str(item) for item in contract["entrypoints"])
    batch_only_prefixes = tuple(str(item) for item in contract["batch_only_prefixes"])
    forbidden_local_roots = set(str(item) for item in contract["forbidden_local_roots"])
    forbidden_import_roots = set(
        str(item) for item in contract["forbidden_request_import_roots"]
    )

    separated_dependencies = contract["separated_dependencies"]
    violations.extend(
        _validate_dependency_separation(
            service_root=service_root,
            separated_dependencies=separated_dependencies,
        )
    )

    queue: deque[tuple[str, tuple[str, ...]]] = deque(
        (entrypoint, (entrypoint,)) for entrypoint in entrypoints
    )
    visited: set[str] = set()
    external_roots: set[str] = set()

    while queue:
        module, chain = queue.popleft()
        if module in visited:
            continue
        visited.add(module)

        module_path = _module_path(service_root, application_package, module)
        if module_path is None:
            violations.append(f"entrypoint or local module does not exist: {module}")
            continue

        references, parse_violations = _parse_imports(
            module=module,
            module_path=module_path,
            service_root=service_root,
            application_package=application_package,
        )
        violations.extend(parse_violations)

        for reference in references:
            imported_module = reference.module
            root = imported_module.split(".", maxsplit=1)[0]
            import_chain = " -> ".join((*chain, imported_module))

            if any(_matches_prefix(imported_module, prefix) for prefix in batch_only_prefixes):
                violations.append(
                    f"{module}:{reference.line}: request import reaches batch-only module: "
                    f"{import_chain}"
                )
                continue
            if root in forbidden_local_roots:
                violations.append(
                    f"{module}:{reference.line}: request import reaches local script package: "
                    f"{import_chain}"
                )
                continue
            if root in forbidden_import_roots:
                violations.append(
                    f"{module}:{reference.line}: request import reaches forbidden "
                    f"optional dependency {root}: {import_chain}"
                )
                continue

            if _matches_prefix(imported_module, application_package):
                if _module_path(service_root, application_package, imported_module) is not None:
                    queue.append((imported_module, (*chain, imported_module)))
            else:
                external_roots.add(root)

    if violations:
        raise RuntimeBoundaryError(violations)

    return RuntimeBoundaryReport(
        entrypoints=entrypoints,
        modules=tuple(sorted(visited)),
        external_import_roots=tuple(sorted(external_roots)),
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the transitive FastAPI request-runtime import boundary."
    )
    parser.add_argument(
        "--contract",
        type=Path,
        default=_DEFAULT_CONTRACT_PATH,
        help="Path to the runtime-boundary contract.",
    )
    parser.add_argument("--json", action="store_true", help="Print the passing report as JSON.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    contract_path = args.contract
    if not contract_path.is_absolute():
        contract_path = _REPOSITORY_ROOT / contract_path

    try:
        report = analyze_request_runtime_boundary(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )
    except (OSError, ValueError, json.JSONDecodeError, RuntimeBoundaryError) as error:
        if isinstance(error, RuntimeBoundaryError):
            print(str(error), file=sys.stderr)
            for violation in error.violations:
                print(f"- {violation}", file=sys.stderr)
        else:
            print(str(error), file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(
            "[api-request-runtime-boundary] passed "
            f"({len(report.modules)} modules reachable from {', '.join(report.entrypoints)})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
