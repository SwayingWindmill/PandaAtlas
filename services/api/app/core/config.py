import json
from collections.abc import Sequence
from uuid import UUID

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development", alias="APP_ENV")
    app_port: int = Field(default=8000, alias="APP_PORT")
    cors_allow_origins: str = Field(default="http://localhost:3000", alias="CORS_ALLOW_ORIGINS")
    admin_api_token: str = Field(default="dev-admin-token", alias="ADMIN_API_TOKEN")
    workflow_actor_tokens_json: str = Field(
        default="{}",
        alias="WORKFLOW_ACTOR_TOKENS_JSON",
    )
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    db_use_mock_fallback: bool | None = Field(default=None, alias="DB_USE_MOCK_FALLBACK")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def apply_runtime_defaults(self) -> "Settings":
        if self.db_use_mock_fallback is None:
            env = self.app_env.lower().strip()
            self.db_use_mock_fallback = env in {"development", "dev", "local", "test"}
        return self

    def cors_origins(self) -> Sequence[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    def is_local_environment(self) -> bool:
        return self.app_env.lower().strip() in {"development", "dev", "local", "test"}

    def workflow_actor_tokens(self) -> dict[UUID, str]:
        value = json.loads(self.workflow_actor_tokens_json)
        if not isinstance(value, dict):
            raise ValueError("WORKFLOW_ACTOR_TOKENS_JSON must be a JSON object")
        return {UUID(actor_id): str(token) for actor_id, token in value.items()}


settings = Settings()
