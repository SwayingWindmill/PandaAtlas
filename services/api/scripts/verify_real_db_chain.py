import json

from fastapi.testclient import TestClient
from smoke_test_public_api import build_public_read_summary

from app.main import app


def main() -> None:
    with TestClient(app) as client:
        summary = build_public_read_summary(
            lambda path: client.get(f"/{path.lstrip('/')}").json()
        )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
