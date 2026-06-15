#!/usr/bin/env bash
# scripts/rebuild_challenges_vps.sh
# Script para reconstruir todos los retos inyectando las flags desde el archivo .env.
# Funciona tanto en local como en servidores de retos remotos (VPS 2).
set -euo pipefail

# 1. Cargar el archivo .env del directorio actual para leer las flags
ENV_FILE="${1:-.env}"
if [[ -f "$ENV_FILE" ]]; then
    echo "Cargando flags desde el archivo $ENV_FILE..."
    # shellcheck disable=SC1090
    source "$ENV_FILE"
else
    echo "ERROR: Archivo $ENV_FILE no encontrado."
    echo "       Asegúrate de ejecutar este script en el directorio que contiene el archivo .env"
    echo "       o pásalo como argumento: $0 /ruta/al/.env"
    exit 1
fi

# Determinar la ubicación de la carpeta de challenges (./challenges o ~/challenges)
CHALLENGES_DIR=""
if [[ -d "./challenges" ]]; then
    CHALLENGES_DIR="./challenges"
elif [[ -d "$HOME/challenges" ]]; then
    CHALLENGES_DIR="$HOME/challenges"
else
    echo "ERROR: No se encontró la carpeta 'challenges' en ./challenges ni en ~/challenges"
    exit 1
fi

echo "Usando directorio de retos: $CHALLENGES_DIR"

# Mapear el nombre de la carpeta con la variable de entorno correspondiente
declare -A FLAG_MAP=(
    [sqli]="${FLAG_SQLI:-}"
    [xss]="${FLAG_XSS:-}"
    [ssti]="${FLAG_SSTI:-}"
    [crypto-rsa]="${FLAG_CRYPTO_RSA:-}"
    [crypto-vigenere]="${FLAG_CRYPTO_VIGENERE:-}"
    [cmdi]="${FLAG_CMDI:-}"
    [path-traversal]="${FLAG_PATH_TRAVERSAL:-}"
    [jwt]="${FLAG_JWT:-}"
    [lfi]="${FLAG_LFI:-}"
    [idor]="${FLAG_IDOR:-}"
    [xxe]="${FLAG_XXE:-}"
    [format-string]="${FLAG_FORMAT_STRING:-}"
    [forensics-pcap]="${FLAG_FORENSICS_PCAP:-}"
    [stego]="${FLAG_STEGO:-}"
)

# Compilar cada reto pasando la flag correspondiente como --build-arg
for dir in "$CHALLENGES_DIR"/*/ ; do
    # Remover slash del final para obtener el nombre base de la carpeta
    dir="${dir%/}"
    if [[ -f "$dir/Dockerfile" ]]; then
        slug=$(basename "$dir")
        flag="${FLAG_MAP[$slug]:-}"
        
        if [[ -z "$flag" ]]; then
            echo "ADVERTENCIA: No se encontró la flag para el reto '$slug' en el .env. Saltando..."
            continue
        fi

        echo "--------------------------------------------------"
        echo "Construyendo reto: ctf-$slug con flag inyectada..."
        echo "--------------------------------------------------"
        
        docker build \
            --build-arg FLAG="$flag" \
            -t "ctf-$slug:latest" \
            "$dir"
            
        # Tag alternativo para versiones/rollback
        docker tag "ctf-$slug:latest" "ctf-$slug:v1"
    fi
done

echo ""
echo "✓ Reconstrucción de retos finalizada con éxito."
