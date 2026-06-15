#!/usr/bin/env bash
# scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
# Script maestro: regenera flags + buildea containers + sincroniza la DB.
# Los 3 pasos SIEMPRE se ejecutan juntos para evitar desincronización.
#
# Uso:
#   bash scripts/setup.sh           # regenera flags y reconstruye todo
#   bash scripts/setup.sh --no-regen  # mantiene las flags actuales del .env
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="$ROOT_DIR/.env"
REGEN=true

for arg in "$@"; do
  [[ "$arg" == "--no-regen" ]] && REGEN=false
done

cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         CTF Platform — Setup completo            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── PASO 1: Generar flags ────────────────────────────────────────────────────
if [[ "$REGEN" == true ]]; then
  echo "▶ Paso 1/3 — Generando nuevas flags..."
  bash "$SCRIPT_DIR/generate_flags.sh"
  echo "  ✓ Flags generadas y escritas en .env"
else
  echo "▶ Paso 1/3 — Saltando regeneración de flags (--no-regen)"
  [[ -f "$ENV_FILE" ]] || { echo "ERROR: .env no existe. Ejecuta sin --no-regen primero."; exit 1; }
fi
echo ""

# ── PASO 2: Buildear containers ──────────────────────────────────────────────
echo "▶ Paso 2/3 — Buildeando containers de challenges..."
bash "$SCRIPT_DIR/build_challenges.sh" "$ENV_FILE"
echo ""

# ── PASO 3: Sincronizar DB del backend ───────────────────────────────────────
echo "▶ Paso 3/3 — Sincronizando hashes en la base de datos del backend..."

# Cargar las flags del .env en el entorno para el management command
set -a; source "$ENV_FILE"; set +a

if [[ -f "$BACKEND_DIR/.venv/bin/activate" ]]; then
  source "$BACKEND_DIR/.venv/bin/activate"
fi

cd "$BACKEND_DIR"
python manage.py seed_challenges
cd "$ROOT_DIR"
echo ""

echo "╔══════════════════════════════════════════════════╗"
echo "║  ✓ Setup completo. Todo en sincronía.            ║"
echo "║                                                  ║"
echo "║  Flags, containers y DB ahora son consistentes.  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
