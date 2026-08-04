from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CONTRACT_PATH = (
    _REPOSITORY_ROOT / "contracts" / "api-domain-storage-writes.v1.json"
)
_DYNAMIC_WRITE_PATTERN = re.compile(
    r"\b(?:insert\s+into|(?<!for\s)(?<!do\s)update|delete\s+from|merge\s+into|"
    r"truncate(?:\s+table)?)\s+\{dynamic\}",
    re.IGNORECASE,
)
_WRITE_PATTERN = re.compile(
    r"""
    \b(?P<operation>
        insert\s+into
        |(?<!for\s)(?<!do\s)update
        |delete\s+from
        |merge\s+into
        |truncate(?:\s+table)?
    )
    \s+
    (?P<target>
        (?:"?[A-Za-z_][A-Za-z0-9_$]*"?)
        (?:\s*\.\s*"?[A-Za-z_][A-Za-z0-9_$]*"?)?
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
_TARGET_PATTERN = re.compile(r"^[a-z_][a-z0-9_$]*\.[a-z_][a-z0-9_$]*$")


@dataclass(frozen=True)
class DomainDefinition:
    name: str
    root: str
    owned_schemas: tuple[str, ...]
    allowed_write_targets: tuple[str, ...]


@dataclass(frozen=True)
class WriteReference:
    domain: str
    module: str
    line: int
    operation: str
    schema: str
    table: str

    @property
    def target(self) -> str:
        return f"{self.schema}.{self.table}"


@dataclass(frozen=True)
class DomainStorageWriteReport:
    domains: tuple[str, ...]
    modules: tuple[str, ...]
    writes: tuple[WriteReference, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "domains": list(self.domains),
            "modules_checked": len(self.modules),
            "modules": list(self.modules),
            "write_count": len(self.writes),
            "writes": [
                {
                    "domain": item.domain,
                    "module": item.module,
                    "line": item.line,
                    "operation": item.operation,
                    "target": item.target,
                }
                for item in self.writes
            ],
        }


class DomainStorageWriteError(RuntimeError):
    def __init__(self, violations: Iterable[str]) -> None:
        ordered = sorted(set(violations))
        super().__init__(
            f"API domain storage-write boundary failed with {len(ordered)} violation(s)"
        )
        self.violations = ordered


def _matches_prefix(module: str, prefix: str) -> bool:
    return module == prefix or module.startswith(f"{prefix}.")


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def _validate_string_array(
    value: object,
    *,
    field: str,
    allow_empty: bool = True,
) -> list[str]:
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item for item in value
    ):
        return [f"{field} must be an array of non-empty strings"]
    if not allow_empty and not value:
        return [f"{field} must not be empty"]
    if len(value) != len(set(value)):
        return [f"{field} must not contain duplicates"]
    return []


def _validate_contract(contract: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    if contract.get("schema_version") != 1:
        violations.append("contract schema_version must be 1")
    if not isinstance(contract.get("service_root"), str):
        violations.append("contract field service_root must be a string")
    if not isinstance(contract.get("application_package"), str):
        violations.append("contract field application_package must be a string")
    if not isinstance(contract.get("domains"), dict) or not contract.get("domains"):
        violations.append("contract field domains must be a non-empty object")
    rules = contract.get("rules")
    if not isinstance(rules, dict):
        violations.append("contract field rules must be an object")
    else:
        for field in (
            "require_schema_qualified_writes",
            "forbid_dynamic_write_targets",
        ):
            if not isinstance(rules.get(field), bool):
                violations.append(f"contract rule {field} must be a boolean")
    return violations


def _load_domains(
    contract: dict[str, Any],
) -> tuple[dict[str, DomainDefinition], list[str]]:
    raw_domains = contract.get("domains", {})
    domains: dict[str, DomainDefinition] = {}
    violations: list[str] = []
    roots: dict[str, str] = {}
    schema_owners: dict[str, str] = {}

    for name, raw in raw_domains.items():
        if not isinstance(name, str) or not isinstance(raw, dict):
            violations.append("domain entries must map string names to objects")
            continue
        root = raw.get("root")
        owned_schemas = raw.get("owned_schemas")
        allowed_write_targets = raw.get("allowed_write_targets")
        if not isinstance(root, str) or not root:
            violations.append(f"domain {name} root must be a non-empty string")
            continue
        violations.extend(
            _validate_string_array(
                owned_schemas,
                field=f"domain {name} field owned_schemas",
                allow_empty=False,
            )
        )
        violations.extend(
            _validate_string_array(
                allowed_write_targets,
                field=f"domain {name} field allowed_write_targets",
            )
        )

        for existing_root, existing_name in roots.items():
            if (
                root == existing_root
                or _matches_prefix(root, existing_root)
                or _matches_prefix(existing_root, root)
            ):
                violations.append(
                    f"domain {name} root overlaps domain {existing_name}: {root}"
                )
        roots[root] = name

        owned = tuple(str(item).lower() for item in owned_schemas or [])
        allowed = tuple(str(item).lower() for item in allowed_write_targets or [])
        for target in allowed:
            if _TARGET_PATTERN.fullmatch(target) is None:
                violations.append(
                    f"domain {name} allowed write target must be schema.table: {target}"
                )
                continue
            schema, _ = target.split(".", maxsplit=1)
            if schema in owned:
                violations.append(
                    f"domain {name} allowed write target is already owned: {target}"
                )

        for schema in owned:
            previous = schema_owners.get(schema)
            if previous is not None:
                violations.append(
                    f"schema {schema} is owned by both {previous} and {name}"
                )
            schema_owners[schema] = name

        domains[name] = DomainDefinition(
            name=name,
            root=root,
            owned_schemas=owned,
            allowed_write_targets=allowed,
        )

    return domains, violations


def _module_name(
    service_root: Path,
    application_package: str,
    path: Path,
) -> str:
    package_root = service_root / application_package
    relative = path.relative_to(package_root)
    if relative.name == "__init__.py":
        parts = relative.parent.parts
    else:
        parts = (*relative.parent.parts, relative.stem)
    return ".".join((application_package, *parts)) if parts else application_package


def _module_paths(
    *,
    service_root: Path,
    application_package: str,
    domain: DomainDefinition,
) -> tuple[Path, ...]:
    package_root = service_root / application_package
    relative = domain.root.split(".")[1:]
    root = package_root.joinpath(*relative)
    if not root.is_dir():
        return ()
    return tuple(
        sorted(
            path
            for path in root.rglob("*.py")
            if "__pycache__" not in path.parts
        )
    )


def _call_name(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _sql_literal(node: ast.expr) -> tuple[str | None, bool]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value, False
    if isinstance(node, ast.JoinedStr):
        pieces: list[str] = []
        dynamic = False
        for value in node.values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                pieces.append(value.value)
            else:
                pieces.append("{dynamic}")
                dynamic = True
        return "".join(pieces), dynamic
    return None, False


def _normalize_identifier(value: str) -> str:
    return value.strip().strip('"').lower()


def _parse_target(value: str) -> tuple[str | None, str]:
    parts = [part.strip() for part in value.split(".", maxsplit=1)]
    if len(parts) == 1:
        return None, _normalize_identifier(parts[0])
    return _normalize_identifier(parts[0]), _normalize_identifier(parts[1])


def _operation(value: str) -> str:
    return " ".join(value.lower().split())


def _scan_module(
    *,
    path: Path,
    module: str,
    domain: DomainDefinition,
    require_schema_qualified_writes: bool,
    forbid_dynamic_write_targets: bool,
) -> tuple[list[WriteReference], list[str]]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    except (OSError, SyntaxError) as error:
        return [], [f"{module}: unable to parse {path}: {error}"]

    writes: list[WriteReference] = []
    violations: list[str] = []
    owned_schemas = set(domain.owned_schemas)
    allowed_targets = set(domain.allowed_write_targets)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or _call_name(node.func) != "text":
            continue
        if not node.args:
            continue
        sql, dynamic = _sql_literal(node.args[0])
        if sql is None:
            continue

        if dynamic and forbid_dynamic_write_targets and _DYNAMIC_WRITE_PATTERN.search(sql):
            violations.append(
                f"{module}:{node.lineno}: dynamic SQL write target is forbidden"
            )
            continue

        for match in _WRITE_PATTERN.finditer(sql):
            target_text = match.group("target")
            schema, table = _parse_target(target_text)
            line = node.lineno + sql[: match.start()].count("\n")
            operation = _operation(match.group("operation"))

            if dynamic and "{dynamic}" in target_text and forbid_dynamic_write_targets:
                violations.append(
                    f"{module}:{line}: dynamic SQL write target is forbidden"
                )
                continue
            if schema is None:
                if require_schema_qualified_writes:
                    violations.append(
                        f"{module}:{line}: {operation} target must be schema-qualified: "
                        f"{table}"
                    )
                continue

            reference = WriteReference(
                domain=domain.name,
                module=module,
                line=line,
                operation=operation,
                schema=schema,
                table=table,
            )
            writes.append(reference)
            if schema not in owned_schemas and reference.target not in allowed_targets:
                violations.append(
                    f"{module}:{line}: domain {domain.name} may not {operation} "
                    f"{reference.target}; owned={list(domain.owned_schemas)} "
                    f"allowed_targets={list(domain.allowed_write_targets)}"
                )

    return writes, violations


def analyze_domain_storage_writes(
    *,
    repository_root: Path = _REPOSITORY_ROOT,
    contract_path: Path = _DEFAULT_CONTRACT_PATH,
) -> DomainStorageWriteReport:
    contract = _load_json(contract_path)
    violations = _validate_contract(contract)
    domains, domain_violations = _load_domains(contract)
    violations.extend(domain_violations)
    if violations:
        raise DomainStorageWriteError(violations)

    service_root = repository_root / str(contract["service_root"])
    application_package = str(contract["application_package"])
    rules = contract["rules"]
    modules: set[str] = set()
    writes: list[WriteReference] = []

    for domain in domains.values():
        paths = _module_paths(
            service_root=service_root,
            application_package=application_package,
            domain=domain,
        )
        if not paths:
            violations.append(f"domain {domain.name} root does not exist: {domain.root}")
            continue
        for path in paths:
            module = _module_name(service_root, application_package, path)
            modules.add(module)
            module_writes, module_violations = _scan_module(
                path=path,
                module=module,
                domain=domain,
                require_schema_qualified_writes=bool(
                    rules["require_schema_qualified_writes"]
                ),
                forbid_dynamic_write_targets=bool(
                    rules["forbid_dynamic_write_targets"]
                ),
            )
            writes.extend(module_writes)
            violations.extend(module_violations)

    if violations:
        raise DomainStorageWriteError(violations)

    return DomainStorageWriteReport(
        domains=tuple(sorted(domains)),
        modules=tuple(sorted(modules)),
        writes=tuple(
            sorted(
                writes,
                key=lambda item: (
                    item.domain,
                    item.module,
                    item.line,
                    item.operation,
                    item.target,
                ),
            )
        ),
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate schema ownership for raw SQL writes in FastAPI domains."
    )
    parser.add_argument(
        "--contract",
        type=Path,
        default=_DEFAULT_CONTRACT_PATH,
        help="Path to the domain storage-write contract.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the passing report as JSON.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    contract_path = args.contract
    if not contract_path.is_absolute():
        contract_path = _REPOSITORY_ROOT / contract_path

    try:
        report = analyze_domain_storage_writes(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )
    except (OSError, ValueError, json.JSONDecodeError, DomainStorageWriteError) as error:
        if isinstance(error, DomainStorageWriteError):
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
            "[api-domain-storage-writes] passed "
            f"({len(report.modules)} modules; {len(report.writes)} raw SQL writes)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
