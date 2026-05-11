import json
import os
import urllib.error

from smoke_test_admin_import import run_admin_import_smoke
from smoke_test_public_api import run_public_read_smoke


def _admin_smoke_enabled() -> bool:
    return os.getenv("RUN_ADMIN_IMPORT_SMOKE", "0").strip().lower() in {"1", "true", "yes", "on"}


def main() -> None:
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/") + "/"
    summary = {
        "public": run_public_read_smoke(base_url),
        "admin_import_enabled": _admin_smoke_enabled(),
    }

    if summary["admin_import_enabled"]:
        summary["admin_import"] = run_admin_import_smoke(base_url)

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP error {err.code}: {detail}") from err
