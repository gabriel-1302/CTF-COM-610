#!/bin/sh
# backend/entrypoint.sh
# Ejecutado antes de gunicorn/celery en el container.
# Garantiza que la DB esté lista y los datos iniciales existan.
set -e

echo "[entrypoint] Esperando a que PostgreSQL esté disponible..."
# Esperar a que el host de la DB acepte conexiones (max 30s)
RETRIES=30
until python -c "
import os, sys, psycopg2
try:
    psycopg2.connect(
        dbname=os.environ.get('POSTGRES_DB', 'ctf_db'),
        user=os.environ.get('POSTGRES_USER', 'ctf_user'),
        password=os.environ.get('POSTGRES_PASSWORD', ''),
        host=os.environ.get('POSTGRES_HOST', 'db'),
        port=os.environ.get('POSTGRES_PORT', '5432'),
        connect_timeout=1,
    )
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -eq 0 ]; then
        echo "[entrypoint] ERROR: PostgreSQL no respondió a tiempo." >&2
        exit 1
    fi
    echo "[entrypoint] PostgreSQL no disponible aún, reintentando ($RETRIES)..."
    sleep 1
done
echo "[entrypoint] PostgreSQL listo."

if [ "${SKIP_INIT:-0}" != "1" ]; then
    echo "[entrypoint] Aplicando migraciones..."
    python manage.py migrate --noinput

    echo "[entrypoint] Sincronizando challenges (flags → hashes en DB)..."
    python manage.py seed_challenges

    echo "[entrypoint] Garantizando usuario admin..."
    python manage.py ensure_admin
else
    echo "[entrypoint] SKIP_INIT=1 — omitiendo migrate y seed."
fi

echo "[entrypoint] Iniciando: $*"
exec "$@"
