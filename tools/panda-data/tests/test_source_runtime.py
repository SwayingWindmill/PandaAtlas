from __future__ import annotations

from panda_data.acquisition import bundles
from panda_data.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from panda_data.acquisition.contracts import AcquisitionMode
from panda_data.acquisition.runner import AdapterRunRequest, run_adapter
from panda_data.acquisition.wikimedia_commons import ADAPTER_ID, SOURCE_ID


def test_reviewed_source_adapter_runs_from_panda_data_fixture_runtime(
    tmp_path,
    monkeypatch,
) -> None:
    monkeypatch.setattr(bundles, "LOCAL_BUNDLE_ROOT", tmp_path)
    output = tmp_path / "bundle.json"
    result = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle=output,
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
    )
    assert result.output_path == output
    assert result.bundle.run.source_id == SOURCE_ID
    assert result.bundle.run.adapter_id == ADAPTER_ID
    assert result.bundle.candidates
    assert output.is_file()
