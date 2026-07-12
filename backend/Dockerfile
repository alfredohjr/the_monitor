FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Versão exata do build (o CI injeta a tag, ex.: 0.4.0). Vira env para o app
# reportar em /version qual patch está rodando.
ARG APP_VERSION=""
ENV APP_VERSION=${APP_VERSION}

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
