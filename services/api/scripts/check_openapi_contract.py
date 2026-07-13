from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from app.main import app

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parents[1]
CONTRACT_PATH = ROOT / "openapi" / "panda-atlas-v1.yaml"
PUBLIC_SCHEMA_PATH = REPOSITORY_ROOT / "contracts" / "public-api-v1.json"

REQUIRED_ROUTE_METHODS: tuple[tuple[str, str], ...] = (
    ("/health", "get"),
    ("/api/v1/pandas", "get"),
    ("/api/v1/pandas/{panda_ref}", "get"),
    ("/api/v1/pandas/{panda_ref}/lineage", "get"),
    ("/api/v1/map/distribution", "get"),
    ("/api/v1/map/habitats", "get"),
    ("/api/v1/map/snapshots", "get"),
    ("/api/v1/stats/overview", "get"),
    ("/api/v1/admin/import-sources", "get"),
    ("/api/v1/admin/import-jobs", "post"),
    ("/api/v1/admin/import-jobs/{job_id}", "get"),
    ("/api/v1/admin/import-jobs/{job_id}/run", "post"),
)

REQUIRED_PARAMETERS: tuple[tuple[str, str, str], ...] = (
    ("/api/v1/pandas", "get", "page_size"),
    ("/api/v1/map/distribution", "get", "snapshot_date"),
    ("/api/v1/pandas/{panda_ref}/lineage", "get", "ancestor_depth"),
    ("/api/v1/pandas/{panda_ref}/lineage", "get", "descendant_depth"),
)

REQUIRED_RESPONSES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("/api/v1/pandas/{panda_ref}", "get", ("404",)),
    ("/api/v1/pandas/{panda_ref}/lineage", "get", ("404",)),
    ("/api/v1/admin/import-sources", "get", ("401", "503")),
    ("/api/v1/admin/import-jobs", "post", ("401", "503")),
    ("/api/v1/admin/import-jobs/{job_id}", "get", ("401", "404", "503")),
    ("/api/v1/admin/import-jobs/{job_id}/run", "post", ("401", "404", "409", "503")),
)


class ContractCheckError(RuntimeError):
    pass


def load_openapi_contract(contract_path: Path = CONTRACT_PATH) -> dict[str, Any]:
    try:
        content = contract_path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ContractCheckError(f"OpenAPI contract not found: {contract_path}") from exc

    try:
        document = yaml.safe_load(content)
    except yaml.YAMLError as exc:
        raise ContractCheckError(f"Invalid YAML in {contract_path}: {exc}") from exc

    if not isinstance(document, dict):
        raise ContractCheckError(f"OpenAPI contract must parse to an object: {contract_path}")

    return document


def load_public_schema(public_schema_path: Path = PUBLIC_SCHEMA_PATH) -> dict[str, Any]:
    try:
        document = json.loads(public_schema_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContractCheckError(f"Public schema not found: {public_schema_path}") from exc
    except json.JSONDecodeError as exc:
        raise ContractCheckError(f"Invalid JSON in {public_schema_path}: {exc}") from exc

    if not isinstance(document, dict) or not isinstance(document.get("schemas"), dict):
        raise ContractCheckError(
            f"Public schema must contain a schemas object: {public_schema_path}"
        )
    return document


def schema_allows_null(field_schema: dict[str, Any]) -> bool:
    if field_schema.get("nullable") is True:
        return True
    for keyword in ("anyOf", "oneOf"):
        variants = field_schema.get(keyword, [])
        if isinstance(variants, list) and any(
            isinstance(variant, dict) and variant.get("type") == "null" for variant in variants
        ):
            return True
    return False


def validate_public_schema(
    schema_name: str,
    document: dict[str, Any],
    public_schema: dict[str, Any],
) -> None:
    components = document.get("components", {}).get("schemas", {})
    if not isinstance(components, dict):
        raise ContractCheckError(f"{schema_name} schema has no component schemas")

    for public_name, public_definition in public_schema["schemas"].items():
        actual_definition = components.get(public_name)
        if not isinstance(actual_definition, dict):
            raise ContractCheckError(f"{schema_name} schema is missing public schema {public_name}")

        expected_fields = public_definition.get("fields", {})
        actual_fields = actual_definition.get("properties", {})
        if not isinstance(expected_fields, dict) or not isinstance(actual_fields, dict):
            raise ContractCheckError(
                f"{schema_name} public schema {public_name} has invalid fields"
            )

        expected_names = set(expected_fields)
        actual_names = set(actual_fields)
        if actual_names != expected_names:
            raise ContractCheckError(
                f"{schema_name} public schema {public_name} fields drifted: "
                f"expected {sorted(expected_names)}, got {sorted(actual_names)}"
            )

        expected_required = {
            field_name
            for field_name, field_definition in expected_fields.items()
            if field_definition.get("required") is True
        }
        actual_required = set(actual_definition.get("required", []))
        if actual_required != expected_required:
            raise ContractCheckError(
                f"{schema_name} public schema {public_name} required fields drifted: "
                f"expected {sorted(expected_required)}, got {sorted(actual_required)}"
            )

        for field_name, field_definition in expected_fields.items():
            expected_nullable = field_definition.get("nullable") is True
            actual_nullable = schema_allows_null(actual_fields[field_name])
            if actual_nullable != expected_nullable:
                raise ContractCheckError(
                    f"{schema_name} public schema {public_name}.{field_name} nullability drifted: "
                    f"expected nullable={expected_nullable}, got nullable={actual_nullable}"
                )


def build_generated_schema() -> dict[str, Any]:
    schema = app.openapi()
    if not isinstance(schema, dict):
        raise ContractCheckError("Generated FastAPI schema is not an object")
    return schema


def assert_required_route_methods(schema_name: str, schema: dict[str, Any]) -> None:
    paths = schema.get("paths")
    if not isinstance(paths, dict):
        raise ContractCheckError(f"{schema_name} schema has no paths object")

    missing: list[str] = []
    for path, method in REQUIRED_ROUTE_METHODS:
        path_item = paths.get(path)
        if not isinstance(path_item, dict) or method not in path_item:
            missing.append(f"{method.upper()} {path}")

    if missing:
        raise ContractCheckError(
            f"{schema_name} schema is missing required route methods: {', '.join(missing)}"
        )


def get_operation(document: dict[str, Any], path: str, method: str) -> dict[str, Any]:
    path_item = document.get("paths", {}).get(path)
    if not isinstance(path_item, dict):
        raise ContractCheckError(f"Checked-in contract is missing path: {path}")

    operation = path_item.get(method)
    if not isinstance(operation, dict):
        raise ContractCheckError(
            f"Checked-in contract is missing operation {method.upper()} {path}"
        )

    return operation


def validate_checked_contract_details(contract: dict[str, Any]) -> None:
    security_schemes = contract.get("components", {}).get("securitySchemes", {})
    if "BearerAuth" not in security_schemes:
        raise ContractCheckError("Checked-in contract is missing BearerAuth security scheme")

    for path, method, parameter_name in REQUIRED_PARAMETERS:
        operation = get_operation(contract, path, method)
        parameters = operation.get("parameters", [])
        if not isinstance(parameters, list):
            raise ContractCheckError(
                f"Checked-in contract parameters are invalid for {method.upper()} {path}"
            )

        if not any(
            isinstance(parameter, dict) and parameter.get("name") == parameter_name
            for parameter in parameters
        ):
            raise ContractCheckError(
                "Checked-in contract is missing parameter "
                f"'{parameter_name}' for {method.upper()} {path}"
            )

    for path, method, response_codes in REQUIRED_RESPONSES:
        operation = get_operation(contract, path, method)
        responses = operation.get("responses", {})
        if not isinstance(responses, dict):
            raise ContractCheckError(
                f"Checked-in contract responses are invalid for {method.upper()} {path}"
            )

        missing_codes = [code for code in response_codes if code not in responses]
        if missing_codes:
            missing_list = ", ".join(missing_codes)
            raise ContractCheckError(
                "Checked-in contract is missing response codes "
                f"[{missing_list}] for {method.upper()} {path}"
            )


def check_contract(
    contract_path: Path = CONTRACT_PATH,
    public_schema_path: Path = PUBLIC_SCHEMA_PATH,
) -> dict[str, Any]:
    checked_contract = load_openapi_contract(contract_path)
    generated_schema = build_generated_schema()
    public_schema = load_public_schema(public_schema_path)

    assert_required_route_methods("checked-in", checked_contract)
    assert_required_route_methods("generated", generated_schema)
    validate_checked_contract_details(checked_contract)
    validate_public_schema("checked-in", checked_contract, public_schema)
    validate_public_schema("generated", generated_schema, public_schema)

    return {
        "contract_path": str(contract_path),
        "public_schema_path": str(public_schema_path),
        "required_routes": len(REQUIRED_ROUTE_METHODS),
        "public_schemas": len(public_schema["schemas"]),
        "status": "ok",
    }


def main() -> None:
    result = check_contract()
    route_count = result["required_routes"]
    contract_path = result["contract_path"]
    print(f"OpenAPI contract check passed for {route_count} required routes: {contract_path}")


if __name__ == "__main__":
    main()
