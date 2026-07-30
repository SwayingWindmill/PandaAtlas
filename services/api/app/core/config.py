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
    archive_single_accountable_approver_enabled: bool = Field(
        default=False,
        alias="ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED",
    )
    engagement_enabled: bool = Field(default=False, alias="ENGAGEMENT_ENABLED")
    activity_enabled: bool = Field(default=False, alias="ACTIVITY_ENABLED")
    feed_enabled: bool = Field(default=False, alias="FEED_ENABLED")
    notification_enabled: bool = Field(default=False, alias="NOTIFICATION_ENABLED")
    notification_email_enabled: bool = Field(
        default=False,
        alias="NOTIFICATION_EMAIL_ENABLED",
    )
    notification_transport: str = Field(default="resend", alias="NOTIFICATION_TRANSPORT")
    notification_public_base_url: str = Field(
        default="http://localhost:3000",
        alias="NOTIFICATION_PUBLIC_BASE_URL",
    )
    notification_worker_visibility_timeout_seconds: int = Field(
        default=120,
        ge=30,
        le=1800,
        alias="NOTIFICATION_WORKER_VISIBILITY_TIMEOUT_SECONDS",
    )
    notification_worker_max_attempts: int = Field(
        default=5,
        ge=1,
        le=20,
        alias="NOTIFICATION_WORKER_MAX_ATTEMPTS",
    )
    notification_worker_base_backoff_seconds: int = Field(
        default=30,
        ge=1,
        le=3600,
        alias="NOTIFICATION_WORKER_BASE_BACKOFF_SECONDS",
    )
    notification_queue_alert_depth: int = Field(
        default=100,
        ge=1,
        alias="NOTIFICATION_QUEUE_ALERT_DEPTH",
    )
    notification_queue_alert_age_seconds: int = Field(
        default=300,
        ge=1,
        alias="NOTIFICATION_QUEUE_ALERT_AGE_SECONDS",
    )
    resend_api_url: str = Field(
        default="https://api.resend.com/emails",
        alias="RESEND_API_URL",
    )
    resend_api_key: str | None = Field(default=None, alias="RESEND_API_KEY")
    resend_from_email: str | None = Field(default=None, alias="RESEND_FROM_EMAIL")
    resend_webhook_secret: str | None = Field(default=None, alias="RESEND_WEBHOOK_SECRET")
    auth_smtp_username: str | None = Field(default=None, alias="AUTH_SMTP_USERNAME")
    auth_smtp_password: str | None = Field(default=None, alias="AUTH_SMTP_PASSWORD")
    community_intake_enabled: bool = Field(default=False, alias="COMMUNITY_INTAKE_ENABLED")
    review_moderation_enabled: bool = Field(default=False, alias="REVIEW_MODERATION_ENABLED")
    review_first_response_business_days: int = Field(
        default=3,
        ge=1,
        le=10,
        alias="REVIEW_FIRST_RESPONSE_BUSINESS_DAYS",
    )
    community_intake_storage_signing_key: str = Field(
        default="local-community-intake-storage-signing-key-change-me",
        min_length=32,
        alias="COMMUNITY_INTAKE_STORAGE_SIGNING_KEY",
    )
    community_intake_storage_reference_ttl_seconds: int = Field(
        default=300,
        ge=30,
        le=900,
        alias="COMMUNITY_INTAKE_STORAGE_REFERENCE_TTL_SECONDS",
    )
    community_intake_max_scan_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        alias="COMMUNITY_INTAKE_MAX_SCAN_ATTEMPTS",
    )
    notification_cursor_signing_key: str = Field(
        default="local-notification-cursor-signing-key-change-me",
        min_length=32,
        alias="NOTIFICATION_CURSOR_SIGNING_KEY",
    )
    feed_cursor_signing_key: str = Field(
        default="local-feed-cursor-signing-key-change-me",
        min_length=32,
        alias="FEED_CURSOR_SIGNING_KEY",
    )
    pending_follow_ttl_seconds: int = Field(
        default=3600,
        ge=60,
        le=3600,
        alias="PENDING_FOLLOW_TTL_SECONDS",
    )
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
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
        env = self.app_env.lower().strip()
        if self.db_use_mock_fallback is None:
            self.db_use_mock_fallback = env in {"development", "dev", "local", "test"}
        if (
            self.feed_enabled
            and env not in {"development", "dev", "local", "test"}
            and self.feed_cursor_signing_key == "local-feed-cursor-signing-key-change-me"
        ):
            raise ValueError(
                "FEED_CURSOR_SIGNING_KEY must be configured outside local environments"
            )
        if (
            self.notification_enabled
            and env not in {"development", "dev", "local", "test"}
            and self.notification_cursor_signing_key
            == "local-notification-cursor-signing-key-change-me"
        ):
            raise ValueError(
                "NOTIFICATION_CURSOR_SIGNING_KEY must be configured outside local environments"
            )
        transport = self.notification_transport.lower().strip()
        if transport != "resend":
            raise ValueError("NOTIFICATION_TRANSPORT must be resend")
        self.notification_transport = transport
        if self.notification_email_enabled and not self.notification_enabled:
            raise ValueError("NOTIFICATION_EMAIL_ENABLED requires NOTIFICATION_ENABLED")
        if self.notification_email_enabled:
            if not self.resend_api_key or not self.resend_from_email:
                raise ValueError(
                    "Resend email delivery requires RESEND_API_KEY and RESEND_FROM_EMAIL"
                )
            if not self.resend_webhook_secret:
                raise ValueError(
                    "Resend email delivery requires RESEND_WEBHOOK_SECRET for signed callbacks"
                )
        if (
            self.resend_api_key
            and self.resend_webhook_secret
            and self.resend_api_key == self.resend_webhook_secret
        ):
            raise ValueError("Resend API and webhook credentials must differ")
        if (
            self.resend_api_key
            and self.auth_smtp_password
            and self.resend_api_key == self.auth_smtp_password
        ):
            raise ValueError("Resend API and Supabase Auth SMTP credentials must differ")
        if (
            self.community_intake_enabled
            and env not in {"development", "dev", "local", "test"}
            and self.community_intake_storage_signing_key
            == "local-community-intake-storage-signing-key-change-me"
        ):
            raise ValueError(
                "COMMUNITY_INTAKE_STORAGE_SIGNING_KEY must be configured outside local environments"
            )
        if (
            self.community_intake_enabled
            and env not in {"development", "dev", "local", "test"}
            and (not self.supabase_url or not self.supabase_service_role_key)
        ):
            raise ValueError(
                "Community Intake upload requires backend Supabase Storage credentials"
            )
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
