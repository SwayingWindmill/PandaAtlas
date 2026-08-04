from __future__ import annotations

import argparse
import ast
import fnmatch
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CONTRACT_PATH = _REPOSITORY_ROOT / "contracts" / "api-serverless-runtime.v1.json"
_BOUNDARY_CHECKER_PATH = Path(__file__).with_name("check_request_runtime_boundary.py")
_DISTRIBUTION_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+")
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def _load_boundary_checker() -> Any:
    spec = importlib.util.spec_from_file_location(
        "api_request_runtime_boundary_for_serverless",
        _BOUNDARY_CHECKER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load request boundary checker: {_BOUNDARY_CHECKER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


_BOUNDARY_CHECKER = _load_boundary_checker()


@dataclass(frozen=True)
class ServerlessClosureReport:
    payload: dict[str, Any]

    def to_json(self) -> str:
        return json.dumps(self.payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


class ServerlessClosureError(RuntimeError):
    def __init__(self, violations: list[str]) -> None:
        ordered = sorted(set(violations))
        super().__init__(f"API serverless closure failed with {len(ordered)} violation(s)")
        self.violations = ordered


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def _normalize_distribution_name(value: str) -> str:
    match = _DISTRIBUTION_PATTERN.match(value.strip())
    if match is None:
        return ""
    return re.sub(r"[-_.]+", "-", match.group(0)).lower()


def _repository_path(repository_root: Path, value: str) -> Path:
    normalized = value.strip().replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    candidate = repository_root.joinpath(*normalized.split("/")).resolve()
    try:
        candidate.relative_to(repository_root.resolve())
    except ValueError as error:
        raise ValueError(f"repository path escapes root: {value}") from error
    return candidate


def _relative_path(repository_root: Path, path: Path) -> str:
    return path.resolve().relative_to(repository_root.resolve()).as_posix()


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _validate_contract(contract: dict[str, Any]) -> list[str]:
    violations: list[str] = []
    required_fields = {
        "schema_version",
        "platform",
        "project_root",
        "entrypoint",
        "python",
        "vercel_configuration",
        "request_boundary_contract",
        "default_artifact_path",
        "runtime_dependencies",
        "allowed_transitive_import_roots",
        "forbidden_base_dependencies",
        "required_optional_dependencies",
        "required_service_files",
        "forbidden_artifact_prefixes",
        "rules",
    }
    missing = sorted(required_fields - contract.keys())
    unknown = sorted(contract.keys() - (required_fields | {"title"}))
    violations.extend(f"contract is missing field: {field}" for field in missing)
    violations.extend(f"contract contains unknown field: {field}" for field in unknown)
    if contract.get("schema_version") != 1:
        violations.append("contract schema_version must be 1")
    if contract.get("platform") != "vercel":
        violations.append("contract platform must be vercel")

    entrypoint = contract.get("entrypoint")
    if not isinstance(entrypoint, dict):
        violations.append("contract entrypoint must be an object")
    else:
        if set(entrypoint) != {"file", "module", "symbol", "target"}:
            violations.append("contract entrypoint fields must be file, module, symbol, and target")
        for field in ("file", "module", "symbol", "target"):
            if not isinstance(entrypoint.get(field), str) or not entrypoint[field].strip():
                violations.append(f"contract entrypoint.{field} must be a non-empty string")

    python = contract.get("python")
    if not isinstance(python, dict) or set(python) != {"version_file", "version"}:
        violations.append("contract python fields must be version_file and version")
    elif not re.fullmatch(r"3\.(12|13|14)", str(python.get("version", ""))):
        violations.append("contract python.version must be a supported Vercel Python version")

    vercel_configuration = contract.get("vercel_configuration")
    if not isinstance(vercel_configuration, dict):
        violations.append("contract vercel_configuration must be an object")
    else:
        if set(vercel_configuration) != {"file", "function", "exclude_files"}:
            violations.append(
                "contract vercel_configuration fields must be file, function, and exclude_files"
            )
        if not isinstance(vercel_configuration.get("file"), str):
            violations.append("contract vercel_configuration.file must be a string")
        if not isinstance(vercel_configuration.get("function"), str):
            violations.append("contract vercel_configuration.function must be a string")
        if not isinstance(vercel_configuration.get("exclude_files"), list):
            violations.append("contract vercel_configuration.exclude_files must be an array")

    for field in (
        "runtime_dependencies",
        "allowed_transitive_import_roots",
        "forbidden_base_dependencies",
        "required_optional_dependencies",
        "required_service_files",
        "forbidden_artifact_prefixes",
    ):
        if not isinstance(contract.get(field), list):
            violations.append(f"contract field {field} must be an array")
    if not isinstance(contract.get("rules"), dict):
        violations.append("contract rules must be an object")
    return violations


def _validate_entrypoint(
    *,
    entrypoint_path: Path,
    target: str,
    exported_symbol: str,
) -> list[str]:
    violations: list[str] = []
    try:
        tree = ast.parse(entrypoint_path.read_text(encoding="utf-8"), filename=str(entrypoint_path))
    except (OSError, SyntaxError) as error:
        return [f"unable to parse serverless entrypoint {entrypoint_path}: {error}"]

    try:
        target_module, target_symbol = target.split(":", maxsplit=1)
    except ValueError:
        return [f"entrypoint target must use module:symbol syntax: {target}"]
    if target_symbol != exported_symbol:
        violations.append(
            f"entrypoint target symbol {target_symbol} must match exported symbol {exported_symbol}"
        )

    import_count = 0
    for index, statement in enumerate(tree.body):
        if (
            index == 0
            and isinstance(statement, ast.Expr)
            and isinstance(statement.value, ast.Constant)
            and isinstance(statement.value.value, str)
        ):
            continue
        if isinstance(statement, ast.ImportFrom):
            names = [(alias.name, alias.asname) for alias in statement.names]
            if statement.level != 0 or statement.module != target_module:
                violations.append(
                    f"entrypoint may only import from {target_module}: line {statement.lineno}"
                )
            elif names != [(target_symbol, None)]:
                violations.append(
                    f"entrypoint must import only {target_symbol} from {target_module}: "
                    f"line {statement.lineno}"
                )
            else:
                import_count += 1
            continue
        if isinstance(statement, ast.Assign):
            valid_all = (
                len(statement.targets) == 1
                and isinstance(statement.targets[0], ast.Name)
                and statement.targets[0].id == "__all__"
                and isinstance(statement.value, (ast.List, ast.Tuple))
                and [
                    element.value
                    for element in statement.value.elts
                    if isinstance(element, ast.Constant) and isinstance(element.value, str)
                ]
                == [exported_symbol]
                and len(statement.value.elts) == 1
            )
            if valid_all:
                continue
        violations.append(
            f"entrypoint contains executable or unsupported statement at line {statement.lineno}"
        )

    if import_count != 1:
        violations.append(
            f"entrypoint must re-export {target} exactly once: found {import_count} imports"
        )
    return violations


def _exclude_expression(patterns: list[str]) -> str:
    return "{" + ",".join(patterns) + "}"


def _validate_vercel_configuration(
    *,
    config_path: Path,
    function_name: str,
    exclude_files: list[str],
) -> list[str]:
    violations: list[str] = []
    try:
        payload = _load_json(config_path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return [f"unable to read Vercel configuration {config_path}: {error}"]

    allowed_top_level = {"$schema", "git", "functions"}
    unknown = sorted(set(payload) - allowed_top_level)
    violations.extend(f"Vercel configuration contains unknown field: {field}" for field in unknown)
    if payload.get("$schema") != "https://openapi.vercel.sh/vercel.json":
        violations.append("Vercel configuration must use the official schema")

    git_config = payload.get("git")
    if git_config is not None:
        if not isinstance(git_config, dict) or set(git_config) != {"deploymentEnabled"}:
            violations.append(
                "Vercel git configuration must define only deploymentEnabled"
            )
        elif git_config.get("deploymentEnabled") is not False:
            violations.append("Vercel automatic Git deployments must be disabled")

    functions = payload.get("functions")
    if not isinstance(functions, dict) or set(functions) != {function_name}:
        violations.append(
            f"Vercel configuration must define exactly one function: {function_name}"
        )
        return violations
    function_config = functions.get(function_name)
    if not isinstance(function_config, dict) or set(function_config) != {"excludeFiles"}:
        violations.append(
            f"Vercel function {function_name} must define only excludeFiles"
        )
        return violations
    expected = _exclude_expression(exclude_files)
    if function_config.get("excludeFiles") != expected:
        violations.append(
            f"Vercel excludeFiles must equal the serverless contract: {expected}"
        )
    return violations


def _git_executable(repository_root: Path) -> str:
    git_marker = repository_root / ".git"
    if git_marker.is_file():
        contents = git_marker.read_text(encoding="utf-8", errors="replace").strip()
        if re.match(r"^gitdir:\s*[A-Za-z]:[\\/]", contents):
            return "git.exe"
    return "git"


def _tracked_project_files(repository_root: Path, project_root: Path) -> list[Path]:
    project_relative = _relative_path(repository_root, project_root)
    result = subprocess.run(
        [
            _git_executable(repository_root),
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
            "--",
            project_relative,
        ],
        cwd=repository_root,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"git ls-files failed: {stderr or result.returncode}")
    return sorted(
        repository_root.joinpath(*item.split("/")).resolve()
        for item in result.stdout.decode("utf-8").split("\0")
        if item
    )


def _classify_tracked_file_coverage(
    *,
    repository_root: Path,
    project_root: Path,
    included_files: set[Path],
    config_path: Path,
    exclude_files: list[str],
) -> tuple[list[str], list[str]]:
    excluded: list[str] = []
    violations: list[str] = []
    for tracked_path in _tracked_project_files(repository_root, project_root):
        if tracked_path in included_files or tracked_path == config_path:
            continue
        project_relative = tracked_path.relative_to(project_root).as_posix()
        if any(fnmatch.fnmatchcase(project_relative, pattern) for pattern in exclude_files):
            excluded.append(_relative_path(repository_root, tracked_path))
            continue
        violations.append(
            f"tracked API file is neither in the request closure nor excluded by Vercel: "
            f"{_relative_path(repository_root, tracked_path)}"
        )
    return sorted(excluded), violations


def _parse_project_dependencies(
    pyproject: dict[str, Any],
) -> tuple[dict[str, str], dict[str, set[str]]]:
    project = pyproject.get("project", {})
    requirements: dict[str, str] = {}
    for item in project.get("dependencies", []):
        if not isinstance(item, str):
            continue
        normalized = _normalize_distribution_name(item)
        if normalized:
            requirements[normalized] = item

    optional_groups: dict[str, set[str]] = {}
    for group, items in project.get("optional-dependencies", {}).items():
        if not isinstance(items, list):
            continue
        optional_groups[str(group)] = {
            normalized
            for item in items
            if isinstance(item, str) and (normalized := _normalize_distribution_name(item))
        }
    return requirements, optional_groups


def _validate_dependencies(
    *,
    contract: dict[str, Any],
    requirements: dict[str, str],
    optional_groups: dict[str, set[str]],
    external_import_roots: tuple[str, ...],
) -> list[str]:
    violations: list[str] = []
    runtime_dependencies = contract["runtime_dependencies"]
    expected_distributions: set[str] = set()
    classified_import_roots: set[str] = set()

    for item in runtime_dependencies:
        if not isinstance(item, dict):
            violations.append("runtime_dependencies entries must be objects")
            continue
        distribution = _normalize_distribution_name(str(item.get("distribution", "")))
        import_roots = item.get("import_roots")
        if not distribution or not isinstance(import_roots, list):
            violations.append(
                "runtime_dependencies entries require distribution and import_roots"
            )
            continue
        expected_distributions.add(distribution)
        classified_import_roots.update(str(root) for root in import_roots)

    actual_distributions = set(requirements)
    if actual_distributions != expected_distributions:
        missing = sorted(expected_distributions - actual_distributions)
        extra = sorted(actual_distributions - expected_distributions)
        if missing:
            violations.append(f"base runtime dependencies are missing: {', '.join(missing)}")
        if extra:
            violations.append(
                f"base runtime dependencies contain undeclared items: {', '.join(extra)}"
            )

    forbidden = {
        _normalize_distribution_name(str(item)) for item in contract["forbidden_base_dependencies"]
    }
    for distribution in sorted(actual_distributions & forbidden):
        violations.append(f"forbidden base serverless dependency: {distribution}")

    for item in contract["required_optional_dependencies"]:
        if not isinstance(item, dict):
            violations.append("required_optional_dependencies entries must be objects")
            continue
        distribution = _normalize_distribution_name(str(item.get("distribution", "")))
        group = str(item.get("group", ""))
        if distribution not in optional_groups.get(group, set()):
            violations.append(
                f"distribution {distribution or '<missing>'} must remain in optional group {group}"
            )

    stdlib_roots = set(sys.stdlib_module_names) | {"__future__"}
    allowed_transitive = {
        str(item) for item in contract["allowed_transitive_import_roots"]
    }
    unclassified = sorted(
        set(external_import_roots) - stdlib_roots - classified_import_roots - allowed_transitive
    )
    if unclassified:
        violations.append(
            "request closure contains unclassified external import roots: "
            + ", ".join(unclassified)
        )

    unused_classifications = sorted(
        classified_import_roots - set(external_import_roots)
    )
    if unused_classifications:
        violations.append(
            "runtime dependency import roots are not present in the request closure: "
            + ", ".join(unused_classifications)
        )
    return violations


def _collect_package_data(service_root: Path, pyproject: dict[str, Any]) -> list[Path]:
    package_data = pyproject.get("tool", {}).get("setuptools", {}).get("package-data", {})
    files: set[Path] = set()
    if not isinstance(package_data, dict):
        return []
    for package, patterns in package_data.items():
        if not isinstance(package, str) or not isinstance(patterns, list):
            continue
        package_root = service_root.joinpath(*package.split("."))
        for pattern in patterns:
            if not isinstance(pattern, str):
                continue
            files.update(path for path in package_root.glob(pattern) if path.is_file())
    return sorted(files)


def _file_record(repository_root: Path, path: Path, kind: str) -> dict[str, Any]:
    digest = _sha256(path)
    if not _SHA256_PATTERN.fullmatch(digest):
        raise AssertionError(f"invalid SHA-256 digest for {path}")
    return {
        "bytes": path.stat().st_size,
        "kind": kind,
        "path": _relative_path(repository_root, path),
        "sha256": digest,
    }


def build_serverless_closure(
    *,
    repository_root: Path = _REPOSITORY_ROOT,
    contract_path: Path = _DEFAULT_CONTRACT_PATH,
) -> ServerlessClosureReport:
    repository_root = repository_root.resolve()
    contract = _load_json(contract_path)
    violations = _validate_contract(contract)
    if violations:
        raise ServerlessClosureError(violations)

    project_root = _repository_path(repository_root, str(contract["project_root"]))
    entrypoint = contract["entrypoint"]
    entrypoint_path = _repository_path(repository_root, str(entrypoint["file"]))
    if not entrypoint_path.is_file():
        violations.append(f"serverless entrypoint does not exist: {entrypoint['file']}")
    else:
        violations.extend(
            _validate_entrypoint(
                entrypoint_path=entrypoint_path,
                target=str(entrypoint["target"]),
                exported_symbol=str(entrypoint["symbol"]),
            )
        )

    python = contract["python"]
    version_file = _repository_path(repository_root, str(python["version_file"]))
    if not version_file.is_file():
        violations.append(f"Python version file does not exist: {python['version_file']}")
    elif version_file.read_text(encoding="utf-8").strip() != str(python["version"]):
        violations.append(
            f"Python version file must contain exactly {python['version']}: "
            f"{python['version_file']}"
        )

    vercel_configuration = contract["vercel_configuration"]
    vercel_config_path = _repository_path(
        repository_root,
        str(vercel_configuration["file"]),
    )
    exclude_files = [str(item) for item in vercel_configuration["exclude_files"]]
    violations.extend(
        _validate_vercel_configuration(
            config_path=vercel_config_path,
            function_name=str(vercel_configuration["function"]),
            exclude_files=exclude_files,
        )
    )

    pyproject_path = project_root / "pyproject.toml"
    try:
        pyproject = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise ServerlessClosureError([f"unable to read {pyproject_path}: {error}"]) from error

    boundary_contract_path = _repository_path(
        repository_root,
        str(contract["request_boundary_contract"]),
    )
    try:
        boundary_report = _BOUNDARY_CHECKER.analyze_request_runtime_boundary(
            repository_root=repository_root,
            contract_path=boundary_contract_path,
        )
    except _BOUNDARY_CHECKER.RuntimeBoundaryError as error:
        violations.extend(error.violations)
        boundary_report = None

    requirements, optional_groups = _parse_project_dependencies(pyproject)
    if boundary_report is not None:
        violations.extend(
            _validate_dependencies(
                contract=contract,
                requirements=requirements,
                optional_groups=optional_groups,
                external_import_roots=boundary_report.external_import_roots,
            )
        )

    for required_file in contract["required_service_files"]:
        required_path = _repository_path(repository_root, str(required_file))
        if not required_path.is_file():
            violations.append(f"required serverless service file does not exist: {required_file}")

    if violations:
        raise ServerlessClosureError(violations)
    assert boundary_report is not None

    application_package = _load_json(boundary_contract_path)["application_package"]
    file_kinds: dict[Path, str] = {
        entrypoint_path: "entrypoint",
        version_file: "runtime-metadata",
        pyproject_path: "runtime-metadata",
        project_root / "uv.lock": "runtime-lock",
    }
    for module in boundary_report.modules:
        module_path = _BOUNDARY_CHECKER._module_path(
            project_root,
            str(application_package),
            module,
        )
        if module_path is None:
            raise ServerlessClosureError([f"request module has no source file: {module}"])
        file_kinds[module_path] = "request-module"
        package_directory = module_path.parent
        while package_directory != project_root:
            initializer = package_directory / "__init__.py"
            if initializer.is_file():
                file_kinds.setdefault(initializer, "package-initializer")
            package_directory = package_directory.parent
    for package_data_path in _collect_package_data(project_root, pyproject):
        file_kinds[package_data_path] = "package-data"

    excluded_tracked_files, coverage_violations = _classify_tracked_file_coverage(
        repository_root=repository_root,
        project_root=project_root,
        included_files=set(file_kinds),
        config_path=vercel_config_path,
        exclude_files=exclude_files,
    )
    if coverage_violations:
        raise ServerlessClosureError(coverage_violations)

    records = [
        _file_record(repository_root, path, kind)
        for path, kind in sorted(
            file_kinds.items(), key=lambda item: _relative_path(repository_root, item[0])
        )
    ]
    forbidden_prefixes = tuple(str(item) for item in contract["forbidden_artifact_prefixes"])
    forbidden_files = sorted(
        record["path"]
        for record in records
        if any(record["path"].startswith(prefix) for prefix in forbidden_prefixes)
    )
    if forbidden_files:
        raise ServerlessClosureError(
            ["serverless closure contains forbidden files: " + ", ".join(forbidden_files)]
        )

    runtime_dependencies = []
    for item in contract["runtime_dependencies"]:
        distribution = _normalize_distribution_name(str(item["distribution"]))
        runtime_dependencies.append(
            {
                "distribution": distribution,
                "import_roots": sorted(str(root) for root in item["import_roots"]),
                "requirement": requirements[distribution],
            }
        )

    optional_dependencies = [
        {
            "distributions": sorted(distributions),
            "group": group,
        }
        for group, distributions in sorted(optional_groups.items())
    ]
    contract_records = [
        _file_record(repository_root, contract_path, "serverless-contract"),
        _file_record(repository_root, boundary_contract_path, "request-boundary-contract"),
        _file_record(repository_root, vercel_config_path, "vercel-configuration"),
    ]

    payload: dict[str, Any] = {
        "contracts": contract_records,
        "entrypoint": entrypoint,
        "excluded_tracked_files": excluded_tracked_files,
        "files": records,
        "optional_dependencies_excluded": optional_dependencies,
        "platform": contract["platform"],
        "project_root": contract["project_root"],
        "python_version": python["version"],
        "request_boundary": boundary_report.to_dict(),
        "runtime_dependencies": runtime_dependencies,
        "schema_version": 1,
        "vercel_configuration": vercel_configuration,
        "summary": {
            "excluded_tracked_file_count": len(excluded_tracked_files),
            "file_count": len(records),
            "module_count": len(boundary_report.modules),
            "package_data_file_count": sum(
                record["kind"] == "package-data" for record in records
            ),
            "runtime_dependency_count": len(runtime_dependencies),
            "total_bytes": sum(int(record["bytes"]) for record in records),
        },
    }
    return ServerlessClosureReport(payload=payload)


def _resolve_output_path(repository_root: Path, output_path: Path) -> Path:
    if output_path.is_absolute():
        resolved = output_path.resolve()
        try:
            resolved.relative_to(repository_root.resolve())
        except ValueError as error:
            raise ValueError(
                f"output path must stay inside the repository: {output_path}"
            ) from error
        return resolved
    try:
        return _repository_path(repository_root, output_path.as_posix())
    except ValueError as error:
        raise ValueError(
            f"output path must stay inside the repository: {output_path}"
        ) from error


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the deterministic Vercel FastAPI request-closure artifact."
    )
    parser.add_argument(
        "--contract",
        type=Path,
        default=_DEFAULT_CONTRACT_PATH,
        help="Path to the serverless runtime contract.",
    )
    parser.add_argument("--output", type=Path, help="Write the artifact to this path.")
    parser.add_argument("--json", action="store_true", help="Print the artifact as JSON.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    contract_path = args.contract
    if not contract_path.is_absolute():
        contract_path = _REPOSITORY_ROOT / contract_path
    try:
        report = build_serverless_closure(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )
        rendered = report.to_json()
        output_path = None
        if args.output is not None:
            output_path = _resolve_output_path(_REPOSITORY_ROOT, args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered, encoding="utf-8", newline="\n")
    except (OSError, ValueError, json.JSONDecodeError, ServerlessClosureError) as error:
        if isinstance(error, ServerlessClosureError):
            print(str(error), file=sys.stderr)
            for violation in error.violations:
                print(f"- {violation}", file=sys.stderr)
        else:
            print(str(error), file=sys.stderr)
        return 1

    if args.json:
        print(rendered, end="")
    elif output_path is not None:
        print(
            "[api-serverless-closure] passed "
            f"({report.payload['summary']['module_count']} modules; "
            f"{report.payload['summary']['file_count']} files; output={output_path})"
        )
    else:
        print(
            "[api-serverless-closure] passed "
            f"({report.payload['summary']['module_count']} modules; "
            f"{report.payload['summary']['file_count']} files; "
            f"{report.payload['summary']['runtime_dependency_count']} direct dependencies)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
