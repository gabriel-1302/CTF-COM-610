# CONTEXT.md — Plataforma CTF USFX

## Propósito

Plataforma web de ciberseguridad desarrollada para la **Universidad Mayor Real y Pontificia de San Francisco Xavier de Chuquisaca (USFX)**, administrada por la **Dirección de Tecnologías de Información y Comunicación (DTIC)**.

Opera en **dos modos complementarios**:

1. **Modo Entrenamiento (individual)** — Los estudiantes resuelven retos de ciberseguridad de forma autónoma, acumulan puntos y son evaluados por el scoreboard. Permite a los docentes identificar a los participantes con mayor capacidad técnica para conformar el equipo representativo de la universidad.

2. **Modo Competencia (por equipos)** — La DTIC configura una ventana de tiempo (inicio/fin), activa `COMPETITION_MODE` y los estudiantes compiten en equipos de hasta 5 personas. Los puntos se acumulan por equipo, el scoreboard puede congelarse antes del cierre, y el sistema soporta scoring dinámico y bonificación por first blood.

El objetivo estratégico es **seleccionar y formar a los mejores estudiantes** para representar a la USFX en competiciones nacionales de CTF (OBI, torneos interuniversitarios).

---

## Contexto de Uso

- **Audiencia:** Estudiantes universitarios de la USFX, principalmente de carreras de Informática y Sistemas
- **Modos:** Individual (entrenamiento continuo) o por equipos (competencia formal con fechas)
- **Acceso:** Solo navegador, sin instalación; los entornos vulnerables son contenedores Docker efímeros
- **Administración:** Docentes/DTIC gestionan retos, estudiantes y configuración de competencia desde el panel `/admin`

---

## Stack Tecnológico

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| Astro | 6.1.9 | Framework SSG principal, rutas y layouts |
| React | 19 | Componentes interactivos (challenges, scoreboard, equipo, perfil) |
| Tailwind CSS | 3.4 | Sistema de estilos utilitario |
| Nanostores | 1.3 | Estado global ligero (token JWT, username, isAdmin) |
| Axios | 1.15 | Cliente HTTP con interceptor de refresh automático |
| Zod | 4.3 | Validación de schemas en runtime |
| TypeScript | — | Tipado estático en todo el frontend |

**Fuentes:** Manrope (UI general) + JetBrains Mono (código y flags).

---

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| Django | 5.0.14 | Framework principal, ORM, admin, migraciones |
| Django REST Framework | 3.15 | API REST |
| Django Channels | 4.1 | WebSockets (scoreboard en tiempo real, first blood) |
| Daphne | 4.1 | Servidor ASGI (HTTP + WS) |
| SimpleJWT | 5.3 | Autenticación JWT con refresh token en cookie httpOnly |
| Celery | 5.4 | Tareas asíncronas (limpieza de instancias, broadcasts WS) |
| Redis | 7 | Broker Celery + caché Django + channel layer WebSocket |
| PostgreSQL | 16 | Base de datos principal |
| docker-py | 7.1 | API Docker para spawn/kill de instancias |
| django-ratelimit | 4.1 | Rate limiting en endpoints sensibles |

---

### Infraestructura

| Servicio | Imagen | Propósito |
|---|---|---|
| `nginx` | nginx:alpine | Reverse proxy único punto de entrada (:80) |
| `backend` | build local | Django + Daphne (HTTP + WebSocket) |
| `celery` | build local | Worker + Beat para tareas programadas |
| `frontend` | build local | Astro compilado servido por nginx interno |
| `db` | postgres:16-alpine | Base de datos |
| `redis` | redis:7-alpine | Cache, broker Celery, channel layer WS |
| `docker-proxy` | tecnativa/docker-socket-proxy | Proxy seguro al socket Docker |

Todo orquestado con **Docker Compose**. Para desarrollo existe `docker-compose.override.yml` con hot-reload.

---

## Arquitectura del Sistema

```
NAVEGADOR
    │ HTTP / WebSocket
    ▼
NGINX :80
    ├── /ws/*         → backend:8000  (WebSocket upgrade)
    ├── /api/*        → backend:8000  (Django REST API)
    ├── /admin/*      → backend:8000  (Django Admin)
    └── /*            → frontend:80   (Astro estáticos)

BACKEND (Daphne ASGI)
    ├── apps/users       → Auth, registro, perfil, scoreboard, CompetitionConfig
    ├── apps/teams       → Equipos, scoreboard por equipos, gestión admin
    ├── apps/challenges  → Listado, submit flag (con scoring dinámico), unlock hints
    ├── apps/instances   → Spawn/kill contenedores Docker de retos
    └── apps/ws          → ScoreboardConsumer + FirstBloodConsumer (WebSocket)

CELERY BEAT (tareas programadas)
    ├── cleanup_expired_instances    → cada 60s: mata instancias vencidas
    ├── reconcile_orphan_containers  → cada 5min: limpia contenedores huérfanos
    ├── broadcast_scoreboard         → dispara tras cada solve
    └── broadcast_first_blood        → dispara al primer solver de un reto

DOCKER-PROXY
    └── Filtra el socket /var/run/docker.sock:
        solo permite CONTAINERS POST/DELETE, NETWORKS, VERSION, INFO
```

---

## Modelos de Datos

```
CompetitionConfig  (singleton pk=1)
├── start_time      (inicio de competencia, nullable)
├── end_time        (fin de competencia, nullable)
├── is_frozen       (freeze del scoreboard)
├── freeze_time     (momento exacto del freeze)
└── updated_at

User
├── username, email, password
├── score           (puntos acumulados, indexado DESC)
├── solved_count    (contador de retos resueltos)
└── is_staff        (True = docente/admin)

Team
├── name            (único)
├── join_code       (hex 8 chars, único, generado con secrets)
├── captain         (FK → User, nullable)
├── score, solved_count  (denormalizados)
├── is_banned, is_hidden
└── created_at

TeamMembership      (un usuario → un equipo)
├── team_id
├── user_id         (OneToOne)
└── joined_at

Challenge
├── slug            (único, usado en URLs)
├── name, description
├── points          (valor base)
├── min_points      (piso para scoring dinámico)
├── decay           (solves para llegar al mínimo)
├── image_name      (imagen Docker: ctf-<slug>:latest)
├── flag_hash       (SHA-256; NUNCA el flag en texto plano)
├── internal_port
├── hints           (JSON: [{text, cost}])
└── is_active

Solve
├── user_id, challenge_id
├── points_earned   (puntos reales al momento del solve)
├── is_first_blood  (True si fue el primer solver)
└── solved_at

HintUnlock
├── user_id, challenge_id, hint_index
└── unlocked_at

Instance  (contenedor Docker efímero por usuario)
├── user_id, challenge_id
├── container_id, host_port
├── status          (pending | running | stopped | expired | failed)
├── created_at
└── expires_at      (TTL: 30 minutos por defecto)
```

---

## Flujos Principales

### Entrenamiento individual

```
1. Estudiante se registra y hace login
2. Navega a /challenges → ve lista de retos ordenados por puntos
3. Selecciona un reto → inicia instancia Docker (TTL 30min)
4. Explota la vulnerabilidad, obtiene el flag
5. Lo envía → backend verifica con SHA-256, incrementa score atómicamente
6. Scoreboard se actualiza en tiempo real via WebSocket
```

### Competencia por equipos

```
1. Admin configura start_time / end_time y activa COMPETITION_MODE
2. CompetitionBanner muestra cuenta regresiva en la UI de cada estudiante
3. Al abrir la competencia, cada estudiante crea o se une a un equipo (código hex-8)
4. Los retos solo aceptan submits dentro de la ventana de tiempo
5. Cuando un miembro del equipo resuelve un reto, ningún otro miembro puede resolverlo
6. Los puntos se acumulan en el equipo; el scoreboard de equipos es público
7. Admin puede congelar el scoreboard antes del cierre (freeze_time)
8. Al terminar, CompetitionBanner muestra "La competencia ha finalizado"
9. Admin puede resetear scores y/o disolver equipos para una siguiente ronda
```

---

## Seguridad

### Autenticación
- JWT access token (15min) en **memoria** (no localStorage)
- Refresh token en cookie **httpOnly + Secure + SameSite=Lax**
- Rotación automática de refresh token + blacklist (simplejwt)

### Flags
- Solo hash SHA-256 en base de datos, nunca texto plano
- `hmac.compare_digest()` para prevenir timing attacks
- Generados con `openssl rand -hex 16` (128 bits de entropía)

### Contenedores de Retos
- Usuario no-root (UID 1000), `cap_drop=ALL`, `no-new-privileges`
- Filesystem read-only excepto `/tmp` (tmpfs en RAM)
- Límite de memoria: 128MB, CPU: 50% de un core, PID: 100

### Docker Socket
- Nunca montado directamente en Django; solo via `docker-socket-proxy`
- Solo permite operaciones mínimas: spawn, kill, networks, version, info

### Rate Limiting
- Registro: 5/hora · Login: 10/min · Submit flag: 10/min · Unlock hint: 20/min

---

## Sistema de Retos (14 challenges)

### Web (10 retos)

| Slug | Nombre | Pts | Vulnerabilidad |
|---|---|---|---|
| `sqli` | El Susurrador de Bases de Datos | 100 | SQL Injection (UNION-based) |
| `cmdi` | El Diagnóstico de Red | 125 | Command Injection |
| `xss` | El Libro de Visitas | 150 | Stored XSS + cookie hijacking |
| `lfi` | La Puerta Entreabierta | 150 | Local File Inclusion |
| `path-traversal` | La Biblioteca Abierta | 175 | Directory Traversal |
| `ssti` | Bienvenido, {{ usuario }} | 200 | SSTI Jinja2 |
| `idor` | Todos los Perfiles | 200 | IDOR |
| `format-string` | El Logger Indiscreto | 200 | Python Format String |
| `jwt` | El Portal del Administrador | 225 | JWT None Algorithm |
| `xxe` | Entidades Peligrosas | 250 | XXE |

### Criptografía (2 retos)

| Slug | Pts | Vulnerabilidad |
|---|---|---|
| `crypto-rsa` | 250 | RSA e=3 small-exponent attack |
| `crypto-vigenere` | 300 | Vigenère + Kasiski + análisis de frecuencias |

### Forense (2 retos)

| Slug | Pts | Técnica |
|---|---|---|
| `forensics-pcap` | 150 | Análisis PCAP — credenciales FTP en texto plano |
| `stego` | 200 | Esteganografía LSB en canal rojo de PNG |

**Puntuación base máxima: 2.680 pts** (puede variar con scoring dinámico activo)

---

## API REST

```
# Autenticación
POST   /api/auth/register/
POST   /api/auth/login/             → access token + refresh cookie
POST   /api/auth/logout/
POST   /api/auth/token/refresh/
GET    /api/auth/me/
GET    /api/auth/profile/           Rank, solves, hints, insignias
GET    /api/auth/scoreboard/        Top 100 individual (público)
GET    /api/auth/competition/       Estado de competencia (público)
PATCH  /api/auth/competition/       Configurar start/end/freeze (admin)

# Retos
GET    /api/challenges/
GET    /api/challenges/<slug>/
POST   /api/challenges/<slug>/submit/
POST   /api/challenges/<slug>/hints/<n>/unlock/

# Instancias Docker
POST   /api/instances/spawn/
GET    /api/instances/active/
DELETE /api/instances/<id>/

# Equipos
POST   /api/teams/                  Crear equipo
POST   /api/teams/join/             Unirse con código
DELETE /api/teams/leave/
GET    /api/teams/me/               Equipo del usuario autenticado
GET    /api/teams/scoreboard/       Top 100 equipos (público)
POST   /api/teams/kick/<user_id>/   Expulsar miembro (solo capitán)
POST   /api/teams/transfer/<user_id>/  Transferir capitanía

# Admin
GET    /api/auth/admin/students/
GET    /api/challenges/admin/
PATCH  /api/challenges/admin/<slug>/toggle/
GET    /api/challenges/admin/<slug>/solucionario/  → HTML del writeup (IsAdminUser)
GET    /api/teams/admin/
PATCH  /api/teams/admin/<pk>/ban/
PATCH  /api/teams/admin/<pk>/hide/
POST   /api/auth/admin/reset/scores/
POST   /api/auth/admin/reset/teams/

# WebSocket
WS     /ws/scoreboard/
```

---

## Settings de Competencia

| Variable | Default | Descripción |
|---|---|---|
| `COMPETITION_MODE` | `False` | Activa deduplicación por equipo en submit flag |
| `DYNAMIC_SCORING` | `False` | Puntos decaen con el número de solvers (fórmula CTFd) |
| `FIRST_BLOOD_BONUS_PCT` | `0` | % de bonus en puntos al primer solver de un reto |
| `TEAM_MAX_MEMBERS` | `5` | Máximo de miembros por equipo |

---

## Variables de Entorno (`.env`)

```bash
# Django
DJANGO_SECRET_KEY=...
JWT_SIGNING_KEY=...
DJANGO_SETTINGS_MODULE=config.settings.production

# Base de datos
POSTGRES_DB=ctf_db
POSTGRES_USER=ctf_user
POSTGRES_PASSWORD=...
POSTGRES_HOST=db

# Redis
REDIS_URL=redis://redis:6379/0

# Docker
DOCKER_HOST=tcp://docker-proxy:2375
DOCKER_NETWORK=ctf-challenges-net
INSTANCE_TTL_MINUTES=30
PUBLIC_HOSTNAME=localhost

# CORS y hosts
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGINS=http://localhost

# Competencia (opcionales)
COMPETITION_MODE=False
DYNAMIC_SCORING=False
FIRST_BLOOD_BONUS_PCT=0
TEAM_MAX_MEMBERS=5

# Flags (generadas con scripts/generate_flags.sh)
FLAG_SQLI=CTF{...}
FLAG_CMDI=CTF{...}
FLAG_XSS=CTF{...}
FLAG_LFI=CTF{...}
FLAG_PATH_TRAVERSAL=CTF{...}
FLAG_SSTI=CTF{...}
FLAG_IDOR=CTF{...}
FLAG_FORMAT_STRING=CTF{...}
FLAG_JWT=CTF{...}
FLAG_XXE=CTF{...}
FLAG_CRYPTO_RSA=CTF{...}
FLAG_CRYPTO_VIGENERE=CTF{...}
FLAG_FORENSICS_PCAP=CTF{...}
FLAG_STEGO=CTF{...}
```

---

## Scripts de Gestión

```bash
# Generar nuevas flags aleatorias
scripts/generate_flags.sh

# Construir todas las imágenes Docker (14 retos)
scripts/build_challenges.sh

# Setup completo (flags + build + seed) — siempre los 3 juntos
scripts/setup.sh

# Levantar plataforma completa
docker compose up -d --build

# Operaciones comunes
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_challenges
docker compose exec backend python manage.py createsuperuser
docker compose logs -f backend
```

---

## Estructura de Directorios

```
ctf-platform/
├── backend/
│   ├── apps/
│   │   ├── users/        Auth, perfil, scoreboard, CompetitionConfig
│   │   ├── teams/        Equipos, membresías, scoreboard por equipos
│   │   ├── challenges/   Retos, submit flag, scoring dinámico, hints
│   │   ├── instances/    Gestión de contenedores Docker
│   │   └── ws/           WebSocket: scoreboard + first blood
│   ├── config/
│   │   ├── settings/     base.py / development.py / production.py
│   │   ├── asgi.py
│   │   ├── urls.py
│   │   └── celery.py
│   ├── Dockerfile
│   └── entrypoint.sh     Espera DB, migra, seedea, arranca
│
├── frontend/src/
│   ├── pages/            index, login, register, challenges/[slug], scoreboard,
│   │                     profile, team, admin, solucionario/[slug]
│   ├── components/
│   │   ├── astro/        Navbar, AuthGuard, BaseLayout
│   │   └── react/        ChallengeList, ChallengeDetail, FlagSubmit,
│   │                     InstancePanel, Scoreboard, UserProfile,
│   │                     TeamPanel, TeamScoreboard, CompetitionBanner,
│   │                     AdminDashboard, SolucionarioView, ToastContainer
│   └── lib/              api.ts, auth.ts, schemas.ts, toast.ts
│
├── challenges/           14 retos Docker (Flask)
├── soluciones/           14 writeups en Markdown
├── nginx/nginx.conf
├── scripts/              generate_flags.sh, build_challenges.sh, setup.sh
├── docker-compose.yml
├── docker-compose.override.yml
└── CONTEXT.md
```

---

## Solucionarios

Los writeups están en `ctf-platform/soluciones/` con formato `reto{N}_{slug}.md` (14 archivos).

El endpoint `GET /api/challenges/admin/<slug>/solucionario/` los sirve renderizados a HTML usando `python-markdown` con extensiones `fenced_code`, `tables` y `toc`. El slug se normaliza (guiones → guiones bajos) para hacer match con los nombres de archivo.

En el frontend, la página `/solucionario/<slug>` (solo admins) muestra el contenido con estilos del design system. El `AdminDashboard` incluye un botón 📖 por reto que navega a esta página.

---

## Estado Actual del Proyecto

- **Versión:** 1.1.0
- **Modos:** Entrenamiento individual + Competencia por equipos
- **Retos:** 14 (10 web + 2 cripto + 2 forense)
- **Solucionarios:** 14 writeups en Markdown, accesibles solo para admins
- **Capacidad estimada:** 50–100 estudiantes concurrentes

**Pendiente para producción:**
- HTTPS con certificado (Let's Encrypt o institucional)
- `DJANGO_SECRET_KEY` y `JWT_SIGNING_KEY` seguros en producción
- `PUBLIC_HOSTNAME` con el dominio real
- Backups automáticos del volumen `postgres_data`
- Crear superusuario: `docker compose exec backend python manage.py createsuperuser`
