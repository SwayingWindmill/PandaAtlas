FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv

WORKDIR /app/services/collector

COPY services/collector/pyproject.toml services/collector/uv.lock services/collector/README.md ./
COPY services/collector/src ./src

RUN uv sync --frozen --no-dev --no-editable

WORKDIR /app
COPY data/collector ./data/collector
COPY data/curation/learning/published-pandas.json ./data/curation/learning/published-pandas.json

RUN useradd --system --create-home --home-dir /home/collector collector \
 && mkdir -p /var/lib/collector \
 && chown -R collector:collector /app /var/lib/collector

USER collector

ENV COLLECTOR_TARGETS=/app/data/collector/targets.yaml \
    COLLECTOR_ALIASES=/app/data/collector/aliases.yaml \
    COLLECTOR_PUBLISHED_PANDAS=/app/data/curation/learning/published-pandas.json \
    COLLECTOR_STATE_DIR=/var/lib/collector

HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 \
  CMD ["/app/services/collector/.venv/bin/collector", "doctor"]

ENTRYPOINT ["/app/services/collector/.venv/bin/collector"]
CMD ["run"]
