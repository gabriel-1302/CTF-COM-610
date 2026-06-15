#!/usr/bin/env bash
# scripts/build_challenges.sh
# Buildea las 12 imágenes Docker de los challenges inyectando las flags desde .env.
# Prerequisito: ejecutar generate_flags.sh primero.
set -euo pipefail

ENV_FILE="${1:-.env}"
[[ -f "$ENV_FILE" ]] || {
  echo "ERROR: Archivo $ENV_FILE no encontrado."
  echo "       Ejecuta primero: scripts/generate_flags.sh"
  exit 1
}

# shellcheck disable=SC1090
source "$ENV_FILE"

# Mapeo slug → variable de entorno
declare -A FLAG_VAR=(
  [sqli]=FLAG_SQLI
  [xss]=FLAG_XSS
  [ssti]=FLAG_SSTI
  [crypto-rsa]=FLAG_CRYPTO_RSA
  [crypto-vigenere]=FLAG_CRYPTO_VIGENERE
  [cmdi]=FLAG_CMDI
  [path-traversal]=FLAG_PATH_TRAVERSAL
  [jwt]=FLAG_JWT
  [lfi]=FLAG_LFI
  [idor]=FLAG_IDOR
  [xxe]=FLAG_XXE
  [format-string]=FLAG_FORMAT_STRING
  [forensics-pcap]=FLAG_FORENSICS_PCAP
  [stego]=FLAG_STEGO
)

for slug in sqli xss ssti crypto-rsa crypto-vigenere cmdi path-traversal jwt lfi idor xxe format-string forensics-pcap stego; do
  var="${FLAG_VAR[$slug]}"
  flag="${!var:-}"
  [[ -n "$flag" ]] || {
    echo "ERROR: Variable $var está vacía en $ENV_FILE"
    exit 1
  }

  echo "==> Building ctf-${slug}:latest"
  docker build \
    --build-arg FLAG="$flag" \
    -t "ctf-${slug}:latest" \
    "./challenges/${slug}"

  # Tag inmutable para rollback
  docker tag "ctf-${slug}:latest" "ctf-${slug}:v1"
done

echo ""
echo "✓ All 14 challenges built."
docker images | grep -E '^ctf-(sqli|xss|ssti|crypto-rsa|crypto-vigenere|cmdi|path-traversal|jwt|lfi|idor|xxe|format-string|forensics-pcap|stego)'
