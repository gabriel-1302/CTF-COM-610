# CTF Platform — Frontend

Astro + islas React. Consume la API REST del backend (Fase 2).

## Stack

- **Astro** — SSG, rutas estáticas
- **React** — Component islands para interactividad (spawn, countdown, submit)
- **Tailwind CSS** — estilos
- **nanostores** — store compartido entre islas (auth state)
- **axios** — cliente HTTP con refresh interceptor deduplicado
- **zod** — validación runtime de responses del backend

## Desarrollo

```bash
npm install
npm run dev
# → http://localhost:4321
```

Requiere backend en `localhost:8000` (proxy `/api` configurado en `astro.config.mjs`).

## Build de producción

```bash
npm run build       # genera dist/
npm run preview     # sirve dist/ localmente
```

## Docker

```bash
docker build -t ctf-frontend .
docker run -p 8080:80 ctf-frontend
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PUBLIC_API_BASE` | `/api` | Base URL de la API. El prefijo `PUBLIC_` es obligatorio en Astro. |

## Decisiones de seguridad

- Access token en **memoria** — nunca en `localStorage` (previene XSS).
- Interceptor de refresh **deduplicado** — un solo refresh aunque N requests fallen 401 concurrentemente.
- **zod** en runtime — si el backend cambia una respuesta, el frontend falla explícitamente.
