from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CONTRACT_PATH = _REPOSITORY_ROOT / "contracts" / "api-domain-dependencies.v1.json"


@dataclass(frozen=True)
class ImportReference:
    module: str
    line: int


@dataclass(frozen=True)
class DomainDefinition:
    name: str
    root: str
    may_depend_on: tuple[str, ...]
    public_surfaces: tuple[str, ...]
    api_surfaces: tuple[str, ...]


@dataclass(frozen=True)
class DomainDependencyReport:
    domains: tuple[str, ...]
    modules: tuple[str, ...]
    domain_edges: tuple[str, ...]
    api_imports: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "domains": list(self.domains),
            "modules_checked": len(self.modules),
            "modules": list(self.modules),
            "domain_edges": list(self.domain_edges),
            "api_imports": list(self.api_imports),
        }


class DomainDependencyError(RuntimeError):
    def __init__(self, violations: Iterable[str]) -> None:
        ordered = sorted(set(violations))
        super().__init__(f"API domain dependency boundary failed with {len(ordered)} violation(s)")
        self.violations = ordered


def _matches_prefix(module: str, prefix: str) -> bool:
    return module == prefix or module.startswith(f"{prefix}.")


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


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


def _module_name(service_root: Path, application_package: str, path: Path) -> str:
    package_root = service_root / application_package
    relative = path.relative_to(package_root)
    if relative.name == "__init__.py":
        parts = relative.parent.parts
    else:
        parts = (*relative.parent.parts, relative.stem)
    return ".".join((application_package, *parts)) if parts else application_package


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
    path: Path,
    service_root: Path,
    application_package: str,
    forbid_dynamic_imports: bool,
) -> tuple[tuple[ImportReference, ...], tuple[str, ...]]:
    try:
        source = path.read_text(encoding="utf-8-sig")
        tree = ast.parse(source, filename=str(path))
    except (OSError, SyntaxError) as error:
        return (), (f"{module}: unable to parse {path}: {error}",)

    references: set[ImportReference] = set()
    dynamic_import_aliases = {"__import__"}
    importlib_aliases = {"importlib"}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                references.add(ImportReference(module=alias.name, line=node.lineno))
                if alias.name == "importlib":
                    importlib_aliases.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom):
            base_module = _resolve_from_module(node, current_module=module, current_path=path)
            if base_module:
                references.add(ImportReference(module=base_module, line=node.lineno))
                for alias in node.names:
                    if alias.name == "*":
                        continue
                    candidate = f"{base_module}.{alias.name}"
                    if _module_path(service_root, application_package, candidate) is not None:
                        references.add(ImportReference(module=candidate, line=node.lineno))
                    if base_module == "importlib" and alias.name == "import_module":
                        dynamic_import_aliases.add(alias.asname or alias.name)

    violations: list[str] = []
    if forbid_dynamic_imports:
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            function = node.func
            if isinstance(function, ast.Name) and function.id in dynamic_import_aliases:
                violations.append(
                    f"{module}:{node.lineno}: dynamic import through "
                    f"{function.id} is forbidden"
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

    return tuple(sorted(references, key=lambda item: (item.module, item.line))), tuple(violations)


def _validate_contract(contract: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    if contract.get("schema_version") != 1:
        violations.append("contract schema_version must be 1")
    if not isinstance(contract.get("service_root"), str):
        violations.append("contract field service_root must be a string")
    if not isinstance(contract.get("application_package"), str):
        violations.append("contract field application_package must be a string")
    if not isinstance(contract.get("api_prefixes"), list):
        violations.append("contract field api_prefixes must be an array")
    if not isinstance(contract.get("domains"), dict) or not contract.get("domains"):
        violations.append("contract field domains must be a non-empty object")
    if not isinstance(contract.get("rules"), dict):
        violations.append("contract field rules must be an object")
    return violations


def _load_domains(contract: dict[str, Any]) -> tuple[dict[str, DomainDefinition], list[str]]:
    raw_domains = contract.get("domains", {})
    violations: list[str] = []
    domains: dict[str, DomainDefinition] = {}
    roots: dict[str, str] = {}

    for name, raw in raw_domains.items():
        if not isinstance(name, str) or not isinstance(raw, dict):
            violations.append("domain entries must map string names to objects")
            continue
        root = raw.get("root")
        may_depend_on = raw.get("may_depend_on")
        public_surfaces = raw.get("public_surfaces")
        api_surfaces = raw.get("api_surfaces")
        if not isinstance(root, str) or not root:
            violations.append(f"domain {name} root must be a non-empty string")
            continue
        for field, value in (
            ("may_depend_on", may_depend_on),
            ("public_surfaces", public_surfaces),
            ("api_surfaces", api_surfaces),
        ):
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                violations.append(f"domain {name} field {field} must be an array of strings")
        overlaps_existing = any(
            root == existing
            or _matches_prefix(root, existing)
            or _matches_prefix(existing, root)
            for existing in roots
        )
        if overlaps_existing:
            violations.append(f"domain {name} root overlaps another domain root: {root}")
        roots[root] = name
        domains[name] = DomainDefinition(
            name=name,
            root=root,
            may_depend_on=tuple(str(item) for item in may_depend_on or []),
            public_surfaces=tuple(str(item) for item in public_surfaces or []),
            api_surfaces=tuple(str(item) for item in api_surfaces or []),
        )

    for domain in domains.values():
        unknown = sorted(set(domain.may_depend_on) - set(domains))
        violations.extend(
            f"domain {domain.name} may_depend_on references unknown domain {item}"
            for item in unknown
        )
        if domain.name in domain.may_depend_on:
            violations.append(f"domain {domain.name} must not depend on itself")
    return domains, violations


def _domain_for_module(
    module: str,
    domains: dict[str, DomainDefinition],
) -> DomainDefinition | None:
    matches = [domain for domain in domains.values() if _matches_prefix(module, domain.root)]
    if not matches:
        return None
    return max(matches, key=lambda item: len(item.root))


def _surface_allowed(module: str, domain: DomainDefinition, surfaces: tuple[str, ...]) -> bool:
    if module == domain.root:
        relative = ""
    else:
        relative = module[len(domain.root) + 1 :]
    return any(relative == surface or relative.startswith(f"{surface}.") for surface in surfaces)


def _find_cycles(edges: set[tuple[str, str]]) -> list[tuple[str, ...]]:
    adjacency: dict[str, set[str]] = {}
    nodes: set[str] = set()
    for source, target in edges:
        adjacency.setdefault(source, set()).add(target)
        nodes.update((source, target))

    cycles: set[tuple[str, ...]] = set()

    def visit(node: str, path: tuple[str, ...]) -> None:
        for target in sorted(adjacency.get(node, set())):
            if target in path:
                start = path.index(target)
                cycle = (*path[start:], target)
                body = cycle[:-1]
                rotations = [body[index:] + body[:index] for index in range(len(body))]
                normalized = min(rotations)
                cycles.add((*normalized, normalized[0]))
                continue
            visit(target, (*path, target))

    for node in sorted(nodes):
        visit(node, (node,))
    return sorted(cycles)


def analyze_domain_dependencies(
    *,
    repository_root: Path = _REPOSITORY_ROOT,
    contract_path: Path = _DEFAULT_CONTRACT_PATH,
) -> DomainDependencyReport:
    contract = _load_json(contract_path)
    violations = _validate_contract(contract)
    domains, domain_violations = _load_domains(contract)
    violations.extend(domain_violations)
    if violations:
        raise DomainDependencyError(violations)

    service_root = repository_root / str(contract["service_root"])
    application_package = str(contract["application_package"])
    api_prefixes = tuple(str(item) for item in contract["api_prefixes"])
    rules = contract["rules"]
    forbid_dynamic_imports = rules.get("forbid_dynamic_imports") is True
    forbid_domain_to_api = rules.get("forbid_domain_to_api_imports") is True
    reject_cycles = rules.get("reject_dependency_cycles") is True

    paths: set[Path] = set()
    for prefix in api_prefixes:
        prefix_path = _module_path(service_root, application_package, prefix)
        if prefix_path is None:
            violations.append(f"API prefix does not exist: {prefix}")
            continue
        directory = prefix_path.parent if prefix_path.name == "__init__.py" else prefix_path
        if directory.is_file():
            paths.add(directory)
        else:
            paths.update(directory.rglob("*.py"))

    for domain in domains.values():
        root_path = _module_path(service_root, application_package, domain.root)
        if root_path is None:
            violations.append(f"domain root does not exist: {domain.root}")
            continue
        directory = root_path.parent if root_path.name == "__init__.py" else root_path
        if directory.is_file():
            paths.add(directory)
        else:
            paths.update(directory.rglob("*.py"))

    modules: set[str] = set()
    domain_edges: set[tuple[str, str]] = set()
    api_imports: set[str] = set()

    for path in sorted(paths):
        module = _module_name(service_root, application_package, path)
        modules.add(module)
        source_domain = _domain_for_module(module, domains)
        source_is_api = any(_matches_prefix(module, prefix) for prefix in api_prefixes)
        references, parse_violations = _parse_imports(
            module=module,
            path=path,
            service_root=service_root,
            application_package=application_package,
            forbid_dynamic_imports=forbid_dynamic_imports,
        )
        violations.extend(parse_violations)

        for reference in references:
            target_domain = _domain_for_module(reference.module, domains)
            target_is_api = any(
                _matches_prefix(reference.module, prefix) for prefix in api_prefixes
            )

            if source_domain is not None and target_is_api and forbid_domain_to_api:
                violations.append(
                    f"{module}:{reference.line}: domain {source_domain.name} must not "
                    "import API module "
                    f"{reference.module}"
                )
                continue

            if target_domain is None:
                continue

            if source_is_api:
                api_imports.add(f"{module} -> {reference.module}")
                if not _surface_allowed(
                    reference.module,
                    target_domain,
                    target_domain.api_surfaces,
                ):
                    violations.append(
                        f"{module}:{reference.line}: API import reaches private surface of "
                        f"{target_domain.name}: {reference.module}"
                    )
                continue

            if source_domain is None or source_domain.name == target_domain.name:
                continue

            domain_edges.add((source_domain.name, target_domain.name))
            if target_domain.name not in source_domain.may_depend_on:
                violations.append(
                    f"{module}:{reference.line}: undeclared domain dependency "
                    f"{source_domain.name} -> {target_domain.name} through {reference.module}"
                )
                continue
            if not _surface_allowed(reference.module, target_domain, target_domain.public_surfaces):
                violations.append(
                    f"{module}:{reference.line}: domain dependency reaches private surface of "
                    f"{target_domain.name}: {reference.module}"
                )

    if reject_cycles:
        for cycle in _find_cycles(domain_edges):
            violations.append(f"domain dependency cycle is forbidden: {' -> '.join(cycle)}")

    if violations:
        raise DomainDependencyError(violations)

    return DomainDependencyReport(
        domains=tuple(sorted(domains)),
        modules=tuple(sorted(modules)),
        domain_edges=tuple(f"{source} -> {target}" for source, target in sorted(domain_edges)),
        api_imports=tuple(sorted(api_imports)),
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate FastAPI domain import dependencies.")
    parser.add_argument(
        "--contract",
        type=Path,
        default=_DEFAULT_CONTRACT_PATH,
        help="Path to the domain-dependency contract.",
    )
    parser.add_argument("--json", action="store_true", help="Print the passing report as JSON.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    contract_path = args.contract
    if not contract_path.is_absolute():
        contract_path = _REPOSITORY_ROOT / contract_path
    try:
        report = analyze_domain_dependencies(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )
    except (OSError, ValueError, json.JSONDecodeError, DomainDependencyError) as error:
        if isinstance(error, DomainDependencyError):
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
            "[api-domain-dependencies] passed "
            f"({len(report.domains)} domains, {len(report.modules)} modules)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
