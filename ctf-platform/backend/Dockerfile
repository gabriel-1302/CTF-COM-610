FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Build deps for psycopg (production) and access to Docker socket
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# The Docker socket is mounted at runtime via docker-socket-proxy
EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["daphne", "-t", "8", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
