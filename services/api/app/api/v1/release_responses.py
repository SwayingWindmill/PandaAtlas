PUBLIC_RELEASE_HEADERS = {
    "X-PandaAtlas-Dataset-Version": {
        "schema": {"type": "string"},
        "description": "Immutable dataset release version",
    },
    "X-PandaAtlas-Public-Schema-Version": {
        "schema": {"type": "string"},
        "description": "Public response schema version",
    },
    "X-PandaAtlas-Database-Migration-Version": {
        "schema": {"type": "string"},
        "description": "Source database migration version",
    },
}

PUBLIC_RELEASE_RESPONSES = {
    200: {
        "description": "Versioned public response",
        "headers": PUBLIC_RELEASE_HEADERS,
    },
    410: {"description": "Current public release was withdrawn"},
    503: {"description": "Active public release snapshot is unavailable"},
}
