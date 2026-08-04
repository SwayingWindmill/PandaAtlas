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
    _REPOSITORY_ROOT / "contracts" / "api-domain-storage-reads.v1.json"
)
_IDENTIFIER = r'"?[A-Za-z_][A-Za-z0-9_$]*"?'
_TARGET_PATTERN = re.compile(r"^[a-z_][a-z0-9_$]*\.[a-z_][a-z0-9_$]*$")
_READ_PATTERN = re.compile(
    rf"""
    \b(?P<clause>from|join)
    \s+
    (?:(?:only|lateral)\s+)*
    (?P<target>{_IDENTIFIER}(?:\s*\.\s*{_IDENTIFIER})?)
    (?P<call>\s*\()? 
    """,
    re.IGNORECASE | re.VERBOSE,
)
_DYNAMIC_READ_PATTERN = re.compile(
    r"\b(?:from|join)\s+(?:(?:only|lateral)\s+)*\{dynamic\}",
    re.IGNORECASE,
)
_CTE_PATTERN = re.compile(
    rf"(?:\bwith\s+(?:recursive\s+)?|,)\s*(?P<name>{_IDENTIFIER})\s+as\s*\(",
    re.IGNORECASE,
)
_NON_TABLE_TARGETS = frozenset({"select", "values"})


@dataclass(frozen=True)
class DomainDefinition:
    name: str
    root: str
    owned_schemas: tuple[str, ...]
    allowed_read_targets: tuple[str, ...]


@dataclass(frozen=True)
class ReadReference:
    domain: str
    module: str
    line: int
    clause: str
    schema: str
    table: str

    @property
    def target(self) -> str:
        return f"{self.schema}.{self.table}"


@dataclass(frozen=True)
class DomainStorageReadReport:
    domains: tuple[str, ...]
    modules: tuple[str, ...]
    reads: tuple[ReadReference, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "domains": list(self.domains),
            "modules_checked": len(self.modules),
            "modules": list(self.modules),
            "read_count": len(self.reads),
            "reads": [
                {
                    "domain": item.domain,
                    "module": item.module,
                    "line": item.line,
                    "clause": item.clause,
                    "target": item.target,
                }
                for item in self.reads
            ],
        }


class DomainStorageReadError(RuntimeError):
    def __init__(self, violations: Iterable[str]) -> None:
        ordered = sorted(set(violations))
        super().__init__(
            f"API domain storage-read boundary failed with {len(ordered)} violation(s)"
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
    for field in ("service_root", "application_package"):
        if not isinstance(contract.get(field), str):
            violations.append(f"contract field {field} must be a string")
    if not isinstance(contract.get("domains"), dict) or not contract.get("domains"):
        violations.append("contract field domains must be a non-empty object")
    rules = contract.get("rules")
    if not isinstance(rules, dict):
        violations.append("contract field rules must be an object")
    else:
        for field in (
            "require_schema_qualified_reads",
            "forbid_dynamic_read_targets",
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
        allowed_read_targets = raw.get("allowed_read_targets")
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
                allowed_read_targets,
                field=f"domain {name} field allowed_read_targets",
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
        allowed = tuple(str(item).lower() for item in allowed_read_targets or [])
        for target in allowed:
            if _TARGET_PATTERN.fullmatch(target) is None:
                violations.append(
                    f"domain {name} allowed read target must be schema.table: {target}"
                )
                continue
            schema, _ = target.split(".", maxsplit=1)
            if schema in owned:
                violations.append(
                    f"domain {name} allowed read target is already owned: {target}"
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
            allowed_read_targets=allowed,
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
    root = package_root.joinpath(*domain.root.split(".")[1:])
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


def _cte_names(sql: str) -> set[str]:
    return {
        _normalize_identifier(match.group("name"))
        for match in _CTE_PATTERN.finditer(sql)
    }


def _is_delete_target(sql: str, start: int, clause: str) -> bool:
    if clause != "from":
        return False
    prefix = sql[max(0, start - 16) : start]
    return re.search(r"\bdelete\s*$", prefix, re.IGNORECASE) is not None


def _scan_module(
    *,
    path: Path,
    module: str,
    domain: DomainDefinition,
    require_schema_qualified_reads: bool,
    forbid_dynamic_read_targets: bool,
) -> tuple[list[ReadReference], list[str]]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    except (OSError, SyntaxError) as error:
        return [], [f"{module}: unable to parse {path}: {error}"]

    reads: list[ReadReference] = []
    violations: list[str] = []
    owned = set(domain.owned_schemas)
    allowed = set(domain.allowed_read_targets)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or _call_name(node.func) != "text":
            continue
        if not node.args:
            continue
        sql, dynamic = _sql_literal(node.args[0])
        if sql is None:
            continue

        if dynamic and forbid_dynamic_read_targets and _DYNAMIC_READ_PATTERN.search(sql):
            violations.append(
                f"{module}:{node.lineno}: dynamic SQL read target is forbidden"
            )

        cte_names = _cte_names(sql)
        for match in _READ_PATTERN.finditer(sql):
            clause = match.group("clause").lower()
            if _is_delete_target(sql, match.start(), clause):
                continue
            if match.group("call"):
                continue

            schema, table = _parse_target(match.group("target"))
            line = node.lineno + sql[: match.start()].count("\n")
            if schema is None:
                if table in cte_names or table in _NON_TABLE_TARGETS:
                    continue
                if require_schema_qualified_reads:
                    violations.append(
                        f"{module}:{line}: {clause} target must be schema-qualified: {table}"
                    )
                continue

            reference = ReadReference(
                domain=domain.name,
                module=module,
                line=line,
                clause=clause,
                schema=schema,
                table=table,
            )
            reads.append(reference)
            if schema not in owned and reference.target not in allowed:
                violations.append(
                    f"{module}:{line}: domain {domain.name} may not read "
                    f"{reference.target}; owned={list(domain.owned_schemas)} "
                    f"allowed={list(domain.allowed_read_targets)}"
                )

    return reads, violations


def analyze_domain_storage_reads(
    *,
    repository_root: Path = _REPOSITORY_ROOT,
    contract_path: Path = _DEFAULT_CONTRACT_PATH,
) -> DomainStorageReadReport:
    contract = _load_json(contract_path)
    violations = _validate_contract(contract)
    domains, domain_violations = _load_domains(contract)
    violations.extend(domain_violations)
    if violations:
        raise DomainStorageReadError(violations)

    service_root = repository_root / str(contract["service_root"])
    application_package = str(contract["application_package"])
    rules = contract["rules"]
    modules: set[str] = set()
    reads: list[ReadReference] = []

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
            module_reads, module_violations = _scan_module(
                path=path,
                module=module,
                domain=domain,
                require_schema_qualified_reads=bool(
                    rules["require_schema_qualified_reads"]
                ),
                forbid_dynamic_read_targets=bool(rules["forbid_dynamic_read_targets"]),
            )
            reads.extend(module_reads)
            violations.extend(module_violations)

    if violations:
        raise DomainStorageReadError(violations)

    return DomainStorageReadReport(
        domains=tuple(sorted(domains)),
        modules=tuple(sorted(modules)),
        reads=tuple(
            sorted(
                reads,
                key=lambda item: (
                    item.domain,
                    item.module,
                    item.line,
                    item.clause,
                    item.target,
                ),
            )
        ),
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate raw SQL read ownership in FastAPI domains."
    )
    parser.add_argument(
        "--contract",
        type=Path,
        default=_DEFAULT_CONTRACT_PATH,
        help="Path to the domain storage-read contract.",
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
        report = analyze_domain_storage_reads(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )
    except (OSError, ValueError, json.JSONDecodeError, DomainStorageReadError) as error:
        if isinstance(error, DomainStorageReadError):
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
            "[api-domain-storage-reads] passed "
            f"({len(report.modules)} modules; {len(report.reads)} raw SQL reads)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
