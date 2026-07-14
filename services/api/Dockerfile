FROM python:3.13-slim

WORKDIR /app

COPY services/api/pyproject.toml services/api/README.md ./
COPY services/api/app ./app
COPY services/api/tests ./tests
COPY contracts/golden-dataset/mei-xiang-family.v1.json ./contracts/golden-dataset/mei-xiang-family.v1.json

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
