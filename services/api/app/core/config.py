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
    identity_auth_enabled: bool = Field(default=False, alias="IDENTITY_AUTH_ENABLED")
    admin_shell_enabled: bool = Field(default=False, alias="ADMIN_SHELL_ENABLED")
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_jwt_issuer_override: str | None = Field(
        default=None,
        alias="SUPABASE_JWT_ISSUER",
    )
    supabase_jwks_url_override: str | None = Field(
        default=None,
        alias="SUPABASE_JWKS_URL",
    )
    supabase_jwt_audience: str = Field(
        default="authenticated",
        alias="SUPABASE_JWT_AUDIENCE",
    )
    supabase_jwt_algorithms_csv: str = Field(
        default="ES256,RS256",
        alias="SUPABASE_JWT_ALGORITHMS",
    )
    identity_recent_auth_seconds: int = Field(
        default=900,
        ge=60,
        le=3600,
        alias="IDENTITY_RECENT_AUTH_SECONDS",
    )
    identity_bootstrap_admin_emails_csv: str = Field(
        default="",
        alias="IDENTITY_BOOTSTRAP_ADMIN_EMAILS",
    )

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
        actor_tokens = {UUID(actor_id): str(token) for actor_id, token in value.items()}
        if len(set(actor_tokens.values())) != len(actor_tokens):
            raise ValueError("Workflow actor bearer tokens must be unique")
        return actor_tokens

    def supabase_jwt_issuer(self) -> str:
        if self.supabase_jwt_issuer_override:
            return self.supabase_jwt_issuer_override.rstrip("/")
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL or SUPABASE_JWT_ISSUER is required")
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    def supabase_jwks_url(self) -> str:
        if self.supabase_jwks_url_override:
            return self.supabase_jwks_url_override
        return f"{self.supabase_jwt_issuer()}/.well-known/jwks.json"

    def supabase_jwt_algorithms(self) -> tuple[str, ...]:
        algorithms = tuple(
            algorithm.strip()
            for algorithm in self.supabase_jwt_algorithms_csv.split(",")
            if algorithm.strip()
        )
        if not algorithms:
            raise ValueError("SUPABASE_JWT_ALGORITHMS must not be empty")
        if any(algorithm.startswith("HS") for algorithm in algorithms):
            raise ValueError("SUPABASE_JWT_ALGORITHMS must use asymmetric algorithms")
        return algorithms

    def identity_bootstrap_admin_emails(self) -> frozenset[str]:
        return frozenset(
            email.strip().lower()
            for email in self.identity_bootstrap_admin_emails_csv.split(",")
            if email.strip()
        )


settings = Settings()
