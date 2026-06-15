#!/usr/bin/env bash
# scripts/generate_flags.sh
# Genera 12 flags aleatorias con 128 bits de entropía y las escribe en .env.
# Idempotente: re-ejecutar rota las flags sin duplicar líneas.
#
# Nota especial: FLAG_CRYPTO_VIGENERE se genera con hex MAYÚSCULA porque
# el cifrado Vigenère solo cifra [A-Z] — el flag debe ser uppercase para que
# la parte hexadecimal quede cifrada correctamente (no pase en claro).
set -euo pipefail

gen_lower() { echo "CTF{$(openssl rand -hex 16)}"; }
gen_upper() { echo "CTF{$(openssl rand -hex 16 | tr '[:lower:]' '[:upper:]')}"; }

ENV_FILE="${1:-.env}"
touch "$ENV_FILE"

# ── Flags con hex minúscula (formato estándar) ───────────────────────────────
for slug in SQLI XSS SSTI CRYPTO_RSA CMDI PATH_TRAVERSAL JWT LFI IDOR XXE FORMAT_STRING FORENSICS_PCAP STEGO; do
  flag=$(gen_lower)
  key="FLAG_${slug}"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${flag}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${flag}" >> "$ENV_FILE"
  fi
  echo "Generated ${key}=${flag}"
done

# ── Flag Vigenère: hex MAYÚSCULA ─────────────────────────────────────────────
slug="CRYPTO_VIGENERE"
flag=$(gen_upper)
key="FLAG_${slug}"
if grep -q "^${key}=" "$ENV_FILE"; then
  sed -i.bak "s|^${key}=.*|${key}=${flag}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
else
  echo "${key}=${flag}" >> "$ENV_FILE"
fi
echo "Generated ${key}=${flag}  ← uppercase hex (required by Vigenère cipher)"

echo ""
echo "✓ Flags escritas en ${ENV_FILE}  (14 challenges)"
echo "  IMPORTANTE: No commitees este archivo. Está en .gitignore."
