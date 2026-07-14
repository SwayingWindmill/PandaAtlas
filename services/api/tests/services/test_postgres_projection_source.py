from datetime import UTC, datetime
from uuid import UUID

from app.projection import postgres_source


class _Result:
    def __init__(self, *, first=None, rows=None):
        self._first = first
        self._rows = rows or []

    def mappings(self):
        return self

    def first(self):
        return self._first

    def all(self):
        return self._rows


class _Connection:
    def __init__(self, batch_id: UUID):
        self.batch_id = batch_id
        self.queries: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, statement, parameters):
        query = str(statement)
        self.queries.append(query)
        assert parameters == {"batch_id": self.batch_id}
        if "from public.publication_batches" in query:
            return _Result(
                first={
                    "id": self.batch_id,
                    "public_schema_version": "1.0.0",
                    "data_version": "2026.07.14.9",
                    "database_migration_version": "0006",
                    "projection_code_version": "git:abc123",
                    "published_at": datetime(2026, 7, 14, 9, 0, tzinfo=UTC),
                }
            )
        return _Result(
            rows=[
                {
                    "entity_type": "pandas",
                    "entity_id": "panda-1",
                    "payload": {"public_record": {"name_zh": "测试熊猫"}},
                }
            ]
        )


class _Engine:
    def __init__(self, connection: _Connection):
        self.connection_instance = connection
        self.disposed = False

    def connect(self):
        return self.connection_instance

    def dispose(self):
        self.disposed = True


def test_postgres_source_accepts_only_published_release_batch(monkeypatch) -> None:
    batch_id = UUID("11111111-1111-4111-8111-111111111111")
    connection = _Connection(batch_id)
    engine = _Engine(connection)
    monkeypatch.setattr(postgres_source, "create_engine", lambda *_args, **_kwargs: engine)

    release_input = postgres_source.load_reviewed_postgres_release(
        database_url="postgresql+psycopg://example",
        publication_batch_id=batch_id,
    )

    assert release_input.publication_batch_id == str(batch_id)
    assert release_input.projection_code_version == "git:abc123"
    assert release_input.database_migration_version == "0006"
    assert release_input.source_state["dataset"]["version"] == "2026.07.14.9"
    assert release_input.source_state["records"] == [
        {"entity_type": "pandas", "id": "panda-1", "public": {"name_zh": "测试熊猫"}}
    ]
    assert "status = 'published'" in connection.queries[0]
    assert "operation = 'release'" in connection.queries[0]
    assert engine.disposed is True
