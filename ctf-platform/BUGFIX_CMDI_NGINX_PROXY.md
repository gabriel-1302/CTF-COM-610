# Bug Fix: Challenge cmdi — Form action rompía con nginx reverse proxy

## Síntoma

Al acceder al reto "Diagnóstico de Red" vía `https://server-244.rootcode.com.bo/32778/`
y hacer clic en **Diagnosticar**, el navegador redirigía a:

```
https://server-244.rootcode.com.bo/ping
→ {"error": "Challenge inactivo, no especificado o formato de URL invalido..."}
```

## Causa raíz

El form HTML en `challenges/cmdi/app.py` no tenía atributo `action`:

```html
<form method="POST">
```

Sin `action` explícito, el navegador hace POST a la URL actual del documento.
El problema es que en producción el nginx de server-244 actúa como reverse proxy
dinámico: captura el puerto en la URL (`/32778/...`) y lo reenvía al container local.

Cuando Flask devolvía la respuesta, algo causaba que el browser resolviera la
siguiente acción del form como `/ping` (ruta absoluta desde la raíz), en lugar
de `/32778/ping`. Esa ruta no coincide con el patrón del nginx:

```nginx
location ~ ^/([0-9]+)/(.*)$ { ... }   # necesita el prefijo /[puerto]/
```

Por eso nginx devolvía el error 404 personalizado.

**En localhost funcionaba** porque Flask escucha en `http://localhost:5003/`
y tanto `/` como `/ping` son rutas locales directas sin proxy de por medio.

## Fix

Agregar `action="ping"` (relativo, sin `/` inicial) al form en `challenges/cmdi/app.py`:

```html
<!-- antes -->
<form method="POST">

<!-- después -->
<form method="POST" action="ping">
```

Con una ruta relativa, el navegador la resuelve contra la URL actual:
- Desde `/32778/` → POST a `/32778/ping` ✓
- nginx captura `/32778/ping`, proxea a `http://127.0.0.1:32778/ping` ✓
- Flask maneja en `@app.route("/ping", methods=["POST"])` ✓

## Pasos de despliegue ejecutados

1. Corregir `challenges/cmdi/app.py` localmente (línea del `<form>`).
2. Subir el archivo corregido a **server-244** vía SFTP:
   ```
   /home/admin244/challenges/cmdi/app.py
   ```
3. Reconstruir la imagen en server-244:
   ```bash
   cd ~/challenges
   docker build --build-arg FLAG="CTF{...}" -t ctf-cmdi:latest ./cmdi
   ```
4. Eliminar containers viejos de cmdi para forzar uso de la imagen nueva:
   ```bash
   docker ps --filter "ancestor=ctf-cmdi" -q | xargs -r docker rm -f
   ```
5. Lanzar nueva instancia desde la plataforma → verificado funcionando.

## Nota para otros challenges

Revisar que **todos** los challenges Flask/Node que tengan forms o fetch internos
usen rutas **relativas** (sin `/` inicial) para que sean compatibles con el
nginx reverse proxy de server-244 que prefija `/[puerto]/` en todas las rutas.
