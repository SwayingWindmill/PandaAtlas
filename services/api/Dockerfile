FROM python:3.13-slim

WORKDIR /app

COPY services/api/pyproject.toml services/api/README.md ./
COPY services/api/app ./app
COPY services/api/tests ./tests
COPY services/api/scripts/apply_production_migrations.py ./scripts/apply_production_migrations.py
COPY infra/supabase/migrations ./infra/supabase/migrations
COPY contracts/golden-dataset/mei-xiang-family.v1.json ./contracts/golden-dataset/mei-xiang-family.v1.json

RUN pip install --no-cache-dir . \
    && addgroup --system zhipanda \
    && adduser --system --ingroup zhipanda --home /nonexistent --no-create-home zhipanda

USER zhipanda

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
