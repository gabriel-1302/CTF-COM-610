# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Fase 5 — Seguridad, deploy en VPS y QA checklist completo.

---

## [1.4.3] - 2026-05-26 — Hotfixes de Deploy: Rutas relativas en challenges + Race condition frontend ✅

### Corregido

**challenges/sqli — form action absoluto rompía nginx reverse proxy**
- `challenges/sqli/app.py` — el form tenía `action="/login"` (ruta absoluta); con el nginx de server-244 actuando como reverse proxy con prefijo de puerto (`/32786/...`), el browser resolvía el POST a `https://server-244.rootcode.com.bo/login` (sin puerto) → 404 del catch-all de nginx. Corregido a `action="login"` (ruta relativa). Imagen `ctf-sqli:latest` reconstruida en server-244.
- Misma causa raíz que el bug anterior de `cmdi` (documentado en `BUGFIX_CMDI_NGINX_PROXY.md`). **Regla general:** todos los challenges Flask/Node que usen forms o fetch interno deben usar rutas relativas (sin `/` inicial).

**`.env` en server-243 — entradas duplicadas con `INSTANCE_URL_PATTERN` incorrecta**
- El `.env` tenía dos bloques fusionados: el primero definía `INSTANCE_URL_PATTERN=https://server-243.rootcode.com.bo/retos/{port}/` (incorrecto), el segundo la URL correcta de server-244. `python-decouple` usa la primera ocurrencia, causando que las URLs generadas apuntaran a server-243 con un path `/retos/` inexistente.
- Limpiado el `.env` eliminando todas las entradas duplicadas. `INSTANCE_URL_PATTERN` queda como `https://server-244.rootcode.com.bo/{port}/`.

**`ChallengeDetail.tsx` — race condition entre AuthGuard y carga de datos**
- Al hacer hard-reload en `/challenges/<slug>`, el componente lanzaba `Promise.all([fetchChallenges, fetchInstances, ...])` antes de que el interceptor axios terminara de refrescar el token (vía cookie httpOnly), causando un flash de "Challenge no encontrado." seguido por la carga correcta.
- Corregido suscribiéndose al átomo `accessToken` vía `useStore`: el `useEffect` devuelve temprano (manteniendo `loading=true`) mientras `token === null`, y se re-ejecuta cuando el token queda disponible.

---

## [1.4.0] - 2026-05-22 — Página de Competencia + Separación Entrenamiento/Competencia ✅

Separación clara entre modo entrenamiento (todos los retos, sin restricciones) y modo competencia (retos seleccionados, con timer, equipo y scoring oficial).

### Añadido

**Backend**
- `ChallengeListView` acepta `?all=true` — devuelve todos los retos activos ignorando el filtro de `challenge_slugs`, para que el entrenamiento siempre muestre los 14 retos independientemente de si hay competencia activa

**Frontend**
- `CompetitionView.tsx` — componente principal de la página de competencia: header con fase/timer/equipo, barra de progreso, filtros por categoría, grid de retos filtrados; si no hay competencia activa muestra pantalla de espera; si terminó muestra los retos en modo lectura
- `/competencia` — nueva página protegida con `CompetitionView`; link "← Entrenamiento" para volver
- `CompetitionEntryBanner.tsx` — banner en `/challenges` que aparece cuando `competition_mode=true` y la competencia no ha terminado; muestra nombre, tiempo restante (o cuenta regresiva al inicio) y botón "Entrar →" hacia `/competencia`; desaparece automáticamente al terminar
- `/challenges` renombrado a "Entrenamiento" — llama `fetchChallenges(all=true)`, siempre muestra todos los retos
- Link "Competencia" añadido a la navbar para todos los usuarios logueados (no solo admins)

### Cambiado
- `ChallengeList` acepta prop `all?: boolean` que se pasa a `fetchChallenges(all)`
- `fetchChallenges(all?: boolean)` en `api.ts` añade `?all=true` cuando corresponde
- `CompetitionBanner` (timer de cuenta regresiva) eliminado de `/challenges` — su función la cubre `CompetitionEntryBanner`

---

## [1.3.0] - 2026-05-22 — Wizard de Inscripción Automatizado ✅

Sistema de registro autoguiado que adapta el flujo según la modalidad de la competencia, sin intervención manual del administrador.

### Añadido

**Backend**
- `GET /api/auth/registration-status/` (público) — devuelve: `registration_open`, nombre y descripción de la competencia, modo (`individual`/`teams`/`mixed`), contadores de equipos creados y cupos restantes (`teams_count`, `teams_remaining`, `max_teams`, `max_members`)
- `RegisterView` verifica `registration_open` antes de crear la cuenta — si está en `False`, devuelve HTTP 403 con mensaje claro
- `TeamCreateView` verifica `registration_open` antes de crear equipo
- `TeamJoinView` verifica `registration_open` antes de unirse a equipo
- `GET /api/teams/lookup/?code=XXXX` — preview de equipo por código sin unirse (requiere auth): devuelve nombre, `member_count` y `max_members` para feedback en tiempo real

**Frontend**
- `RegistrationWizard.tsx` — wizard dinámico de 2-3 pasos:
  - **Paso 1 — Cuenta:** username, email, contraseña + confirmar; validación inline en tiempo real (✓/mensaje por campo); badge con info de la competencia y cupos disponibles
  - **Paso 2 — Equipo** (solo si `mode=teams` o `mode=mixed`): elegir entre "Crear equipo" o "Unirme con código"; preview del equipo al escribir el código (debounce 400ms, muestra nombre y X/Y miembros); modo mixto permite saltar este paso
  - **Paso 3 — Éxito:** animación de progreso, redirección automática a `/challenges` en 2.5s
- Si `registration_open=false`: pantalla de "Registro cerrado" en lugar del formulario
- `StepBar` visual con estados done/active/pending y etiquetas adaptables
- `RegistrationStatusSchema` en `schemas.ts` + `fetchRegistrationStatus()` y `previewTeamByCode()` en `api.ts`
- `/register` actualizado para usar `RegistrationWizard` en lugar de `AuthForm` simple

---

## [1.2.0] - 2026-05-22 — Panel de Competencia + Wizard de Configuración ✅

Gestión completa de competencias desde una interfaz dedicada. La configuración se movió del panel admin genérico a una página propia con wizard paso a paso y dashboard en tiempo real.

### Añadido

**Backend**
- `CompetitionConfig` extendido con nuevos campos: `name`, `description`, `mode` (individual/teams/mixed), `max_teams`, `max_members`, `registration_open`, `challenge_slugs` (JSONField), `dynamic_scoring`, `first_blood_bonus_pct` — todos controlables en runtime sin reiniciar el servidor
- `GET /api/auth/admin/competition/stats/` — fase actual (inactive/pending/active/frozen/ended), contadores de participantes/equipos/solves y últimas 10 actividades
- `ChallengeListView` filtra los retos por `challenge_slugs` cuando competition mode está activo y la lista no está vacía
- `SubmitFlagView` rechaza flags de retos no incluidos en la selección activa (HTTP 403)
- Variables de entorno `COMPETITION_MODE`, `DYNAMIC_SCORING`, `FIRST_BLOOD_BONUS_PCT`, `TEAM_MAX_MEMBERS` migradas a `CompetitionConfig` — los env vars quedaron como referencia, la DB es la fuente de verdad
- Comando de gestión `recalc_team_scores` para recalcular scores de equipos retroactivamente

**Frontend — `/admin/competencia`**
- Nueva página protegida (`adminOnly`) con `CompetitionManager.tsx`
- Dashboard en tiempo real: fase con badge de color, cuenta regresiva al inicio/fin, toggle rápido de modo competencia
- Stat cards: participantes, equipos, total solves, solves/última hora
- Actividad reciente (últimos 10 solves con equipo y first blood)
- Preview del scoreboard de equipos (top 8)
- Botón "🛑 Terminar competencia" — fija `end_time = ahora`
- Acciones rápidas (reset scores, reset equipos) con `ConfirmDialog`
- Link directo desde el panel `/admin` (ya no hay configuración redundante ahí)

**Wizard de creación de competencia (5 pasos)**
- **Paso 1 — Modalidad**: individual / equipos / mixto + nombre + descripción
- **Paso 2 — Tiempo**: inicio, fin y freeze opcional con explicación del freeze
- **Paso 3 — Equipos**: max equipos, max miembros, registro siempre abierto (se omite en modalidad individual)
- **Paso 4 — Retos**: selección por categoría (Web/Criptografía/Forense) con checkboxes, botones "Todos"/"Ninguno", toggle por categoría con estado indeterminado
- **Paso 5 — Scoring**: scoring dinámico + bonus first blood (%) + resumen completo antes de guardar
- `StepBar` visual con estados done/active/pending
- Validación por paso: nombre obligatorio, rango de fechas válido, al menos un reto seleccionado

### Corregido
- Scoreboard de equipos no aparecía en `/scoreboard` — las tabs usaban `onclick` inline que no funciona en módulos ES de Astro; reemplazado con `addEventListener`
- Hydration mismatch en `NavbarAuth` — servidor renderizaba estado no autenticado mientras el cliente tenía tokens en localStorage; solucionado con flag `mounted` + `useEffect`

### Cambiado
- Sección de config de competencia eliminada de `AdminDashboard` para evitar redundancia
- Link "Competencia" añadido a la navbar (visible solo para admins)

---

## [1.1.0] - 2026-05-22 — Solucionarios para Administradores ✅

Visualización de solucionarios en Markdown directamente desde el panel de administración, accesible solo para staff.

### Añadido
- `GET /api/challenges/admin/<slug>/solucionario/` — endpoint protegido (`IsAdminUser`) que localiza el archivo `soluciones/*_{slug}.md`, lo renderiza a HTML con `python-markdown` (extensiones: `fenced_code`, `tables`, `toc`) y lo devuelve
- `frontend/src/pages/solucionario/[slug].astro` + `SolucionarioView.tsx` — página dedicada con markdown renderizado, breadcrumb de vuelta al panel y estilos consistentes con el design system
- Botón 📖 en cada fila de la tabla "Gestión de Retos" del `AdminDashboard` → navega a `/solucionario/<slug>`
- `fetchSolucionario(slug)` en `api.ts`
- Volumen `./soluciones:/soluciones:ro` montado en el contenedor backend
- Red `internal` añadida al servicio `frontend` en `docker-compose.override.yml` (fix: el proxy Vite `/api → backend:8000` no funcionaba por aislamiento de red)

### Dependencias
- `Markdown==3.7` añadido a `requirements.txt`

---

## [1.0.0] - 2026-05-21 — Soporte de Competencias: Equipos + Config + Scoring Dinámico ✅

La plataforma deja de ser solo un entorno de entrenamiento individual y pasa a soportar
**competencias formales por equipos** con ventana de tiempo, freeze de scoreboard y
scoring dinámico.

### Añadido

**App `teams` (nueva)**
- Modelos `Team` (nombre, código de invitación hex-8, capitán, score/solved_count denormalizados, flags `is_banned`/`is_hidden`) + `TeamMembership` (OneToOne usuario→equipo)
- 8 endpoints: crear, unirse con código, salir, `GET /teams/me/`, scoreboard público, kick, transferir capitanía, y vistas admin ban/hide
- Límite configurable `TEAM_MAX_MEMBERS` (default 5); un usuario solo puede pertenecer a un equipo a la vez

**CompetitionConfig (singleton)**
- Modelo en `apps/users`: `start_time`, `end_time`, `is_frozen`, `freeze_time`
- `GET /api/auth/competition/` público — estado actual; `PATCH` solo admins (ISO 8601)
- `POST /api/auth/admin/reset/scores/` — borra solves + hints, resetea scores de usuarios y equipos
- `POST /api/auth/admin/reset/teams/` — disuelve todos los equipos

**Scoring dinámico y first blood**
- `Challenge.compute_points(solve_count)` — fórmula cuadrática estilo CTFd; se activa con `DYNAMIC_SCORING=True`
- `Solve.points_earned` + `Solve.is_first_blood` — campos nuevos en el modelo
- `SubmitFlagView` actualizado: valida ventana de tiempo, deduplica por equipo (`COMPETITION_MODE=True`), aplica bonus `FIRST_BLOOD_BONUS_PCT`, actualiza `Team.score` atómicamente, emite `broadcast_first_blood` via Celery

**Scoreboard congelado**
- `ScoreboardView` usa `_frozen_entries(freeze_time)` cuando `is_frozen=True`; calcula el ranking desde `Solve.points_earned` anterior al freeze_time (no desde `User.score`)

**Frontend**
- `TeamPanel.tsx` — crear equipo / unirse con código / gestionar miembros (kick, transferir, salir) con confirmaciones inline
- `TeamScoreboard.tsx` — ranking de equipos con medallas top 3
- `CompetitionBanner.tsx` — banner en tiempo real: cuenta regresiva al inicio (`pending`), tiempo restante en verde/rojo <30min (`active`), mensaje de cierre (`ended`)
- Nuevos schemas Zod y funciones API para todo lo anterior
- `AdminDashboard` actualizado con config de competencia (fechas, freeze) y botones de reset

### Settings de Competencia

| Variable | Default | Descripción |
|---|---|---|
| `COMPETITION_MODE` | `False` | Activa deduplicación por equipo en submit |
| `DYNAMIC_SCORING` | `False` | Scoring que decae conforme más solvers resuelven el reto |
| `FIRST_BLOOD_BONUS_PCT` | `0` | % de bonus sobre los puntos en first blood |
| `TEAM_MAX_MEMBERS` | `5` | Máximo de miembros por equipo |

---

## [0.9.1] - 2026-05-21 — Hotfix: login y autenticación frontend ✅

- **`frontend/src/lib/api.ts`** — `fetchMe()` usaba `await import("./auth")` (import dinámico) que fallaba en el entorno de build estático de Astro, bloqueando la hidratación de todos los componentes React. Corregido con import estático en la cabecera del módulo.
- Contraseña del superusuario reseteada vía `manage.py shell`.

---

## [0.9.0] - 2026-05-20 — Panel de Administración ✅

Panel completo para docente/DTIC: lista de estudiantes con desglose por categoría, gestión de retos (activar/desactivar), protegido con `is_staff=True`.

### Añadido
- `GET /api/auth/admin/students/` — lista estudiantes con score, solved_count, hints_used, desglose Web/Crypto/Forense (anotaciones SQL)
- `GET /api/challenges/admin/` — todos los retos con solve_count y ratio de resolución
- `PATCH /api/challenges/admin/<slug>/toggle/` — activa/desactiva reto
- `frontend/src/pages/admin.astro` + `AdminDashboard.tsx` — 4 stat cards, tabla de estudiantes con buscador, tabla de retos con toggle
- `isAdmin` atom en `auth.ts`; navbar muestra link `/admin` solo a staff

---

## [0.8.0] - 2026-05-20 — Perfil de Usuario Mejorado ✅

Rediseño del perfil con niveles/rango, avatar dinámico por username, barras de progreso por categoría, 8 insignias académicas y stats de percentil.

### Añadido
- **5 rangos:** Estudiante / Analista / Hacker / Especialista / Elite USFX (por puntos)
- **Avatar** con color único por hash del username
- **Barras de progreso** general (X/14) y por categoría Web/Crypto/Forense
- **8 insignias:** Primer Paso, Sin Ayuda, Explorador, Dominador Web, Criptógrafo, Forense Digital, Perfección, Sin Penalización
- **Stats:** puntos brutos, puntos perdidos en pistas, percentil `Top X%`, distancia al top 3
- 3 campos nuevos en `ProfileView`: `hints_used_slugs`, `total_players`, `top3_score`

---

## [0.7.0] - 2026-05-20 — Categoría Forense + Solucionario Completo ✅

2 nuevos retos Forense, solucionario completado a 14 retos, y fix de rutas 404 para los retos 9–14.

### Añadido
- **`forensics-pcap`** (150 pts) — PCAP FTP con credenciales en texto plano (generado con `struct`, sin deps)
- **`stego`** (200 pts) — Esteganografía LSB en canal rojo de PNG (Pillow)
- Solucionarios `reto9` al `reto14`

### Corregido
- `[slug].astro` — `getStaticPaths()` solo tenía 8 slugs; extendido a 14, eliminando 404 en retos nuevos

---

## [0.6.0] - 2026-05-20 — Retos Faltantes: LFI, IDOR, XXE, Format String ✅

Completado el set de 14 retos. Las 4 imágenes Docker faltantes buildeadas; frontend actualizado con `CATEGORY_GROUPS` y `ORDER` extendidos.

### Corregido
- Flags `FLAG_LFI`, `FLAG_IDOR`, `FLAG_XXE`, `FLAG_FORMAT_STRING` faltaban en `.env`, causando que `seed_challenges` las saltara silenciosamente

---

## [0.5.0] - 2026-04-25 — Dockerización Completa ✅

`docker compose up -d` levanta los 7 servicios. Entrypoint automatiza migrate + seed. Scripts de setup atómico.

### Añadido
- `docker-compose.yml` — 7 servicios: db, redis, docker-proxy, backend, celery, frontend, nginx
- `docker-compose.override.yml` — hot-reload para desarrollo
- `backend/entrypoint.sh` — wait-for-db + migrate + seed automático
- `scripts/setup.sh` — genera flags + build imágenes + seed en un solo comando atómico

### Corregido
- `docker-proxy` bloqueaba `/version` e `/info` → `DockerException: 403` en todo spawn; habilitados `VERSION=1` e `INFO=1`
- `npm ci` falla en Docker por peer conflict `@astrojs/tailwind` con Astro 6; cambiado a `--legacy-peer-deps`
- Astro 6 requiere Node ≥ 22; base image actualizada de `node:20-alpine` a `node:22-alpine`

### Seguridad
- Backend nunca monta `/var/run/docker.sock` directamente; todo pasa por `docker-socket-proxy`

---

## [0.4.0] - 2026-04-24 — Retos de Criptografía + UI en Español ✅

2 nuevos retos de criptografía (550 pts combinados); UI completamente en español.

### Añadido
- **`crypto-rsa`** (250 pts) — RSA e=3 small-exponent attack; clave privada nunca escrita a disco
- **`crypto-vigenere`** (300 pts) — Vigenère clave `BEACON`; Kasiski + análisis de frecuencias

### Cambiado
- Internacionalización completa al español en todas las páginas y componentes

---

## [0.3.0] - 2026-04-24 — Frontend Astro + Islas React ✅

Frontend completo SSG + islas React interactivas. Validado end-to-end.

### Añadido
- Astro 6 + React 19 + Tailwind, con Nanostores, Axios, Zod
- Componentes: AuthForm, ChallengeList, ChallengeDetail, InstancePanel, CountdownTimer, FlagSubmit, Scoreboard, UserProfile, ToastContainer, Navbar, AuthGuard

### Corregido (críticos)
- **Auth loop** — `TokenRefreshView` esperaba refresh en body JSON pero estaba en cookie httpOnly → `CookieTokenRefreshView` inyecta el cookie en `request._full_data`
- **Navbar mostraba `"null"`** — `persistentAtom` serializa `null` como string `"null"` (truthy); corregido con encoder/decoder JSON explícito
- **Kill endpoint 404** — frontend llamaba `/instances/{id}/kill/`; URL correcta es `/instances/{id}/`

---

## [0.2.0] - 2026-04-23 — Backend Django ✅

API REST completa: auth JWT, challenges con flag verify SHA-256, instancias Docker efímeras, Celery cleanup, 10 tests automatizados.

---

## [0.1.0] - 2026-04-23 — Challenges Docker ✅

3 challenges Docker iniciales (sqli, xss, ssti) con scripts de automatización de flags y builds.

---

[Unreleased]: https://github.com/user/ctf-platform/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/user/ctf-platform/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/ctf-platform/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/ctf-platform/compare/v0.9.1...v1.0.0
[0.9.1]: https://github.com/user/ctf-platform/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/user/ctf-platform/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/user/ctf-platform/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/user/ctf-platform/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/user/ctf-platform/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/user/ctf-platform/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/user/ctf-platform/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/user/ctf-platform/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/user/ctf-platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/user/ctf-platform/releases/tag/v0.1.0
