from app.schemas.panda import ImportSourceOption

APPROVED_IMPORT_SOURCES: tuple[ImportSourceOption, ...] = (
    ImportSourceOption(
        name="0001_demo_seed.sql",
        label="Demo seed dataset",
        source_path="infra/supabase/seed/0001_demo_seed.sql",
    ),
    ImportSourceOption(
        name="0002_atlas_catalog_seed.sql",
        label="Atlas catalog seed dataset",
        source_path="infra/supabase/seed/0002_atlas_catalog_seed.sql",
    ),
)


def list_import_sources() -> list[ImportSourceOption]:
    return [item.model_copy(deep=True) for item in APPROVED_IMPORT_SOURCES]


def resolve_import_source(source_name: str) -> ImportSourceOption | None:
    normalized = source_name.strip()
    if not normalized:
        return None

    for item in APPROVED_IMPORT_SOURCES:
        if item.name == normalized:
            return item.model_copy(deep=True)

    return None
