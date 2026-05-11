import json
import os
import urllib.error

from smoke_test_public_api import request_json


def run_admin_import_smoke(base_url: str) -> dict[str, object]:
    normalized_base = base_url.rstrip("/") + "/"
    token = os.getenv("ADMIN_API_TOKEN", "dev-admin-token")
    source_name = os.getenv("SMOKE_IMPORT_SOURCE_NAME", "0001_demo_seed.sql")

    sources = request_json(normalized_base, "api/v1/admin/import-sources", token=token)
    approved_names = {item["name"] for item in sources.get("items", []) if isinstance(item, dict)}
    if source_name not in approved_names:
        raise RuntimeError(f"SMOKE_IMPORT_SOURCE_NAME is not approved: {source_name}")

    created_job = request_json(
        normalized_base,
        "api/v1/admin/import-jobs",
        method="POST",
        token=token,
        payload={"source_name": source_name},
    )
    job_id = created_job.get("id")
    if not isinstance(job_id, str):
        raise RuntimeError(f"Create import job failed: {created_job}")

    run_job = request_json(
        normalized_base,
        f"api/v1/admin/import-jobs/{job_id}/run",
        method="POST",
        token=token,
    )
    fetched_job = request_json(
        normalized_base,
        f"api/v1/admin/import-jobs/{job_id}",
        token=token,
    )

    if run_job.get("status") != "succeeded":
        raise RuntimeError(f"Import run did not succeed: {run_job}")
    if fetched_job.get("status") != "succeeded":
        raise RuntimeError(f"Import status check did not succeed: {fetched_job}")

    summary = fetched_job.get("summary", {})
    return {
        "import_job_id": job_id,
        "import_status": fetched_job.get("status"),
        "import_source_name": summary.get("source_name"),
        "import_source_path": summary.get("source_path"),
        "import_mode": summary.get("mode"),
    }


def main() -> None:
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    print(json.dumps(run_admin_import_smoke(base_url), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP error {err.code}: {detail}") from err
