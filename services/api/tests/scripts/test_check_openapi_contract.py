from copy import deepcopy
from pathlib import Path

import pytest
from check_openapi_contract import (
    CONTRACT_PATH,
    ContractCheckError,
    assert_required_route_methods,
    check_contract,
    load_openapi_contract,
    validate_checked_contract_details,
)


def test_check_contract_passes_for_repo_contract() -> None:
    result = check_contract()

    assert result["status"] == "ok"
    assert result["contract_path"].endswith("panda-atlas-v1.yaml")


def test_load_openapi_contract_rejects_invalid_yaml(tmp_path: Path) -> None:
    invalid_contract = tmp_path / "invalid-openapi.yaml"
    invalid_contract.write_text("openapi: [", encoding="utf-8")

    with pytest.raises(ContractCheckError, match="Invalid YAML"):
        load_openapi_contract(invalid_contract)


def test_assert_required_route_methods_rejects_missing_required_path() -> None:
    schema = {"paths": {"/health": {"get": {}}}}

    with pytest.raises(ContractCheckError, match=r"GET /api/v1/pandas"):
        assert_required_route_methods("generated", schema)


def test_validate_checked_contract_details_rejects_missing_expected_response() -> None:
    contract = deepcopy(load_openapi_contract(CONTRACT_PATH))
    del contract["paths"]["/api/v1/admin/import-sources"]["get"]["responses"]["401"]

    with pytest.raises(ContractCheckError, match=r"\[401\].*GET /api/v1/admin/import-sources"):
        validate_checked_contract_details(contract)
