from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "run_commons_media_discovery.py"
SPEC = importlib.util.spec_from_file_location("run_commons_media_discovery", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_text_evidence_descriptor_is_stable_across_lf_and_crlf() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        lf_path = root / "lf.json"
        crlf_path = root / "crlf.json"
        lf_path.write_bytes(b'{\n  "schema_version": 1\n}\n')
        crlf_path.write_bytes(b'{\r\n  "schema_version": 1\r\n}\r\n')

        lf_descriptor = MODULE.file_descriptor(lf_path)
        crlf_descriptor = MODULE.file_descriptor(crlf_path)

        assert lf_descriptor["bytes"] == crlf_descriptor["bytes"]
        assert lf_descriptor["sha256"] == crlf_descriptor["sha256"]
        assert lf_descriptor["bytes"] == len(lf_path.read_bytes())
