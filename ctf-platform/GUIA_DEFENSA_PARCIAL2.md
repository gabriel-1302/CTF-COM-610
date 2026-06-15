# GUÍA DE DEFENSA — SEGUNDO PARCIAL (PROYECTO FINAL CTF)
## ENFOQUE EXCLUSIVO EN INFRAESTRUCTURA, DESPLIEGUE, REDES Y OBSERVABILIDAD (15 MINUTOS)

**Universidad Mayor Real y Pontificia de San Francisco Xavier de Chuquisaca**  
**Asignatura:** Trabajando en la Nube (COM610)  
**Docente:** Ing. Marcelo Quispe Ortega  
**Estudiantes:** Gabriel Adrian Velasquez Mendia (DevOps / Redes) y Valeria Alexandra Cuellar Coca (Seguridad / Observabilidad)  

---

## 🛠️ Fase 0: Preparación Previa (15 minutos antes de ingresar)

Aseguren tener abiertas estas terminales y pestañas de navegador para demostrar la infraestructura de forma fluida:

*   **Terminal 1 (VPS 1 — Plataforma):** SSH en `admin243@192.168.100.243` (dentro del proxy).
*   **Terminal 2 (VPS 2 — Desafíos):** SSH en `admin244@192.168.100.244` (dentro del proxy).
*   **Navegador - Pestaña 1:** `https://server-243.rootcode.com.bo` (Acceso al Scoreboard y panel CTF).
*   **Navegador - Pestaña 2:** Grafana Dashboard `https://server-243.rootcode.com.bo/g/graf/` (Logueado para mostrar métricas).
*   **Navegador - Pestaña 3:** `INFORME_AVANCE_PARCIAL2.md` en PDF/Local para entregar al Ing. Quispe.

---

## ⏱️ Guión de Defensa enfocado en Infraestructura (15 Minutos)

### 1. Apertura e Introducción a la Topología (0:00 – 1:00) — [1 minuto]
*   **Acción:** Gabriel comparte pantalla mostrando el **Diagrama de Arquitectura** (Sección II del informe).
*   **Qué decir (Gabriel):**
    > *"Buenas noches Ing. Marcelo Quispe. Nuestro proyecto es la Plataforma CTF USFX. Para esta evaluación, nos hemos enfocado en el despliegue de una arquitectura multi-nodo distribuida sobre dos VPS de la facultad. La VM 1 (`server-243`) aloja el plano de control (Base de datos, Django ASGI y el stack centralizado de Grafana, Loki y Prometheus). La VM 2 (`server-244`) actúa como el plano de ejecución de desafíos efímeros y proxy dinámico. Ambas están aisladas por firewalls perimetrales UFW y protegidas con Fail2ban."*

---

### 2. Hito 1: Aprovisionamiento de Red y Puertos de Escucha (1:00 – 3:00) — [2 minutos]
*   **Objetivo:** Mostrar los servicios del sistema, conectividad y distribución de puertos en caliente.

*   **Paso 1 (Gabriel - VM 1 / Plataforma):**
    *   En **Terminal 1**, ejecuta:
        ```bash
        docker compose ps
        ```
    *   **Explicación:** *"Aquí vemos la plataforma levantada mediante Docker Compose. Los servicios de backend y celery exponen el socket de control local de forma segura mediante un proxy de socket local en el puerto `2375`, evitando mapear directamente el root socket del host."*

> [!NOTE]
> **Nota Explicativa (¿Qué es el `docker-socket-proxy`?):**
> Montar `/var/run/docker.sock` directamente en un contenedor le da privilegios equivalentes a root en la máquina host (se puede comprometer el host fácilmente). Usamos la imagen `tecnativa/docker-socket-proxy` para que actúe como un Firewall intermedio de la API de Docker: solo permite peticiones GET y POST específicas (como lanzar contenedores), bloqueando comandos destructivos (como borrar imágenes o volúmenes del sistema).

*   **Paso 2 (Valeria - VM 2 / Desafíos):**
    *   En **Terminal 2**, ejecuta:
        ```bash
        ss -tlnp
        ```
    *   **Explicación:** *"En el nodo de desafíos, observamos que el daemon de Docker está expuesto en red en el puerto `2375` (para recibir comandos del Celery worker de la VM 1) y el servidor Nginx escucha en el puerto `80` para enrutar el tráfico HTTP de los retos hacia los puertos dinámicos mapeados."*

*   **Paso 3 (Valeria - Muestra Conectividad VM 1 -> VM 2):**
    *   En la **Terminal 1 (VM 1)** ejecuta:
        ```bash
        docker -H tcp://192.168.100.244:2375 info | grep "Kernel Version"
        ```
    *   **Explicación:** *"Con esto verificamos la conectividad del socket de Docker. El backend en la VM 1 puede interactuar directamente con la VM 2 a nivel de red privada sin bloqueos."*

---

### 3. Hito 2: Demostración de Servicios Core — Despliegue Dinámico y Observabilidad (3:00 – 9:00) — [6 minutos]

#### Paso A: Orquestación Distribuida y Proxy Dinámico de Nginx (Gabriel - 3 mins)
*   **Acción:** Gabriel va al navegador, entra a la plataforma y le da click a **"Iniciar Instancia"** en el reto SQLi.
    *   Inmediatamente cambia a la **Terminal 2 (VM 2)** y ejecuta:
        ```bash
        docker ps
        ```
        *(Se ve el contenedor `ctf-sqli` naciendo en vivo, por ejemplo en el puerto `32793`).*
    *   Gabriel va al navegador y muestra la URL del reto: `http://server-244.rootcode.com.bo/32793/login`
    *   Muestra el archivo de configuración de Nginx en la **Terminal 2 (VM 2)**:
        ```bash
        cat /etc/nginx/sites-available/ctf-platform
        ```
*   **Qué decir (Gabriel):**
    > *"El backend en VM 1 spawnear el contenedor remotamente en VM 2. Para exponer el reto sin abrir puertos aleatorios en el firewall al público, configuramos este proxy dinámico en Nginx en la VM 2. Mediante la expresión regular `location ~ ^/([0-9]+)/(.*)$`, Nginx captura el puerto en la URL y lo reenvía internamente al loopback `127.0.0.1:$challenge_port`. Lo más crítico aquí es el uso de `proxy_redirect / /$challenge_port/`: si el reto responde con una redirección HTTP absoluta (ej. `/login`), Nginx intercepta la cabecera `Location` y le reinyecta el puerto dinámico para que no se rompa la navegación del alumno."*

> [!NOTE]
> **Nota Explicativa (¿Cómo funciona la redirección de Nginx?):**
> 1. **Regex de Captura:** `location ~ ^/([0-9]+)/(.*)$` mapea el puerto (ej: `32793` en `$1`) y la ruta interna (ej: `login` en `$2`). Nginx proxea a `http://127.0.0.1:$1/$2`.
> 2. **proxy_redirect:** Si Flask en el contenedor responde con una redirección HTTP 302 a `/login` (ruta raíz absoluta interna), Nginx reescribe la cabecera HTTP `Location` de la respuesta para transformarla en `Location: /32793/login` antes de enviarla al navegador. Sin esto, el navegador buscaría la ruta `/login` en el puerto 80 del servidor web, rompiendo la sesión del estudiante.

#### Paso B: Telemetría, Logs y Raspado con Prometheus, Loki y Promtail (Valeria - 3 mins)
*   **Acción:** Valeria comparte pantalla y abre **Grafana** en el navegador (`https://server-243.rootcode.com.bo/g/graf/`).
    *   Muestra el panel de métricas de hardware de la VM 2 y los logs integrados de Loki.
    *   Muestra el archivo de raspado de Prometheus en la **Terminal 1 (VM 1)**:
        ```bash
        cat /home/admin243/ctf-monitoring/prometheus.yml
        ```
    *   Muestra la configuración del agente Promtail en la **Terminal 2 (VM 2)**:
        ```bash
        cat /home/admin244/ctf-agents/promtail-config.yml
        ```
*   **Qué decir (Valeria):**
    > *"El stack de telemetría está centralizado en el VPS 1. Prometheus está configurado para realizar raspado de métricas cada 15 segundos a través de Node Exporter en la VM 1 y en la IP privada de la VM 2 (`192.168.100.244:9100`). Para los logs, Loki escucha en el puerto `3100` de la VM 1. En la VM 2, desplegamos un agente de **Promtail** que lee directamente las salidas estándar JSON de los contenedores Docker en el host (`/var/lib/docker/containers/*/*-json.log`) y los exfiltra mediante peticiones HTTP push hacia Loki. Esto nos permite ver en Grafana, en tiempo real, las trazas del sistema y los payloads que inyectan los estudiantes en los retos."*

> [!NOTE]
> **Nota Explicativa (¿Cómo obtiene Promtail los logs de Docker?):**
> Docker guarda la salida estándar (stdout) y de errores (stderr) de cada contenedor ejecutado en el host bajo el directorio `/var/lib/docker/containers/<id-contenedor>/<id-contenedor>-json.log`. Promtail utiliza una directiva wildcard `__path__: /var/lib/docker/containers/*/*-json.log` para monitorear estos archivos de log y transmitir en vivo cualquier nueva línea al servidor centralizado de Loki.

---

### 4. Hito 3: Firewall Hardening y Buenas Prácticas de Seguridad (9:00 – 11:00) — [2 minutos]
*   **Objetivo:** Demostrar que el clúster está protegido contra ataques externos e internos.

*   **Paso 1 (Valeria - Hardening de API Docker sin TLS):**
    *   En la **Terminal 2 (VM 2)** ejecuta:
        ```bash
        echo "DJJ5eE37HXFJxePz" | sudo -S ufw status verbose
        ```
    *   **Explicación:** *"Exponer la API de Docker en TCP 2375 sin cifrado TLS es un riesgo de seguridad de nivel root. Lo hemos mitigado a nivel de red implementando un firewall UFW estricto en la VM 2: las peticiones entrantes a los puertos `2375` (Docker) y `9100` (Node Exporter) están **restringidas y solo se permiten** si son originadas por la IP privada de la VM 1 (`192.168.100.243`). Cualquier otra IP de la red, los puertos aparecen cerrados."*

*   **Paso 2 (Gabriel - Seguridad de Sandboxes y Control de Fuerza Bruta):**
    *   En la **Terminal 2 (VM 2)** ejecuta:
        ```bash
        systemctl status fail2ban | grep Active
        ```
    *   **Explicación:** *"Fail2ban está activo a nivel de sistema operativo en ambos nodos, protegiendo el servicio SSH con la jaula `sshd`. Además, los contenedores efímeros se levantan con límites estrictos a nivel de kernel para evitar ataques de denegación de servicio (DoS): memoria limitada (`mem_limit` a 128MB y 512MB para XSS), cuota de CPU restringida al 50%, un límite de 100 procesos (`pids_limit`) para evitar bombas fork, y el sistema de archivos raíz montado en solo lectura, utilizando un volumen `tmpfs` limitado en RAM de 32MB para las escrituras necesarias de SQLite."*

> [!NOTE]
> **Nota Explicativa (Límites de Seguridad en Docker):**
> *   `cap_drop=['ALL']`: Elimina todas las capacidades avanzadas del Kernel del contenedor (como manipular interfaces de red o montar discos), evitando escapes de contenedor.
> *   `no-new-privileges:true`: Previene que procesos hijos del contenedor ganen nuevos privilegios a través de binarios con permisos `setuid` (evita escalaciones locales).
> *   `tmpfs={"/tmp": "size=32m"}`: SQLite en el reto SQLi necesita escribir datos. Para evitar montar carpetas del disco host (que son lentas y vulnerables), creamos un directorio `/tmp` efímero que se monta directamente en la memoria RAM del host, aislándolo completamente.

---

### 5. Hito 4: Planificación, Defensa Individual y Cierre (11:00 – 13:00) — [2 minutos]
*   **Objetivo:** Presentación del estado actual y roles individuales de 30 segundos.

*   **Gabriel Adrian Velasquez Mendia (30 segundos):**
    > *"Durante este hito, mi rol se centró en el aprovisionamiento de red de ambas máquinas virtuales, el despliegue del clúster de la plataforma y el diseño de las reglas de proxy reverso dinámico en Nginx en el Nodo 2, garantizando el enrutamiento correcto de puertos dinámicos. Para la entrega final, me enfocaré en la implementación de HTTPS utilizando certificados SSL institucionales en Nginx y en la automatización del despliegue mediante Ansible."*

*   **Valeria Alexandra Cuellar Coca (30 segundos):**
    > *"Mi rol se enfocó en la integración del stack de observabilidad, configurando el servidor Prometheus para realizar el scraping distribuido del hardware y levantando el agente Promtail en el Nodo 2 para centralizar los logs de Docker en Loki. Además, configuré el cortafuegos restrictivo UFW y el servicio Fail2ban en los hosts. Para la entrega final, configuraré las alertas críticas en Grafana y automatizaré los backups periódicos de PostgreSQL."*

---

## ⚡ BANCO DE COMANDOS RÁPIDOS ("Cheat Sheet" de Defensa)

Si el docente solicita demostraciones adicionales en vivo, utilicen estas tablas de referencia de comandos rápidos:

### A. Para demostrar puertos y sockets de red
| Qué te pide el docente | Comando a ejecutar | Nodo | Explicación del comando |
| :--- | :--- | :--- | :--- |
| *"Muéstrame qué puertos están escuchando"* | `ss -tlnp` o `netstat -tlnp` | Ambos | Lista puertos TCP activos en escucha, sockets y procesos. |
| *"Verifica si el puerto 2375 de Docker responde"* | `nc -zvw3 192.168.100.244 2375` | VM 1 | Realiza un escaneo rápido de puerto en red para confirmar apertura. |
| *"Comprueba si Nginx está redirigiendo retos"* | `curl -I http://localhost/32768/` | VM 2 | Envía cabeceras HTTP de prueba al proxy de Nginx de la VM 2. |

### B. Para demostrar reglas del Firewall (UFW)
| Qué te pide el docente | Comando a ejecutar | Nodo | Explicación del comando |
| :--- | :--- | :--- | :--- |
| *"Muéstrame las reglas del firewall"* | `echo "clave" \| sudo -S ufw status verbose` | Ambos | Muestra la política por defecto (deny) y las reglas aplicadas. |
| *"Muéstrame el log de UFW bloqueando tráfico"* | `tail -n 20 /var/log/ufw.log` | Ambos | Muestra los últimos 20 paquetes rechazados por el firewall. |

### C. Para demostrar Observabilidad y Telemetría
| Qué te pide el docente | Comando a ejecutar | Nodo | Explicación del comando |
| :--- | :--- | :--- | :--- |
| *"Muéstrame el archivo de scraping de Prometheus"*| `cat /home/admin243/ctf-monitoring/prometheus.yml`| VM 1 | Muestra la IP de VM 2 declarada en los targets de scraping. |
| *"Comprueba la configuración de Promtail"* | `cat /home/admin244/ctf-agents/promtail-config.yml` | VM 2 | Muestra a dónde envía los logs (IP Loki) y de dónde los extrae. |
| *"Verifica si Loki está recibiendo logs"* | `curl http://localhost:3100/loki/api/v1/labels` | VM 1 | Consulta a la API de Loki las etiquetas de logs indexadas. |
| *"Muestra logs de Promtail en vivo"* | `docker compose logs -f promtail` | VM 1 | Muestra el estado del daemon local enviando logs. |

### D. Para demostrar Docker y Recursos
| Qué te pide el docente | Comando a ejecutar | Nodo | Explicación del comando |
| :--- | :--- | :--- | :--- |
| *"Muéstrame los contenedores ocultos o caídos"* | `docker ps -a` | Ambos | Lista todos los contenedores sin importar su estado. |
| *"Muéstrame el consumo de RAM/CPU del host"* | `free -h` o `htop` o `top` | Ambos | Muestra el estado de la RAM y carga de vCPUs en tiempo real. |
| *"Inspecciona los límites de memoria de un reto"* | `docker inspect <id-container> \| grep -i memory` | VM 2 | Verifica en JSON la cuota de RAM aplicada al sandbox en runtime. |

---

## 🙋 PREGUNTAS AVANZADAS ADICIONALES DEL DOCENTE (Y cómo responderlas)

*   **1. ¿Por qué decidieron usar Daphne ASGI en lugar de Gunicorn como servidor de aplicación en la VM 1?**
    *   *Respuesta:* *"Daphne es un servidor ASGI compatible con protocolos asíncronos. Dado que la plataforma CTF utiliza WebSockets para actualizar el Scoreboard y emitir notificaciones de First Blood de manera instantánea a todos los estudiantes sin obligar al navegador a realizar polling HTTP constante, necesitábamos Daphne para manejar las conexiones asíncronas de Django Channels, mientras que Gunicorn está limitado a llamadas síncronas HTTP."*
*   **2. ¿Cómo manejan el almacenamiento persistente de PostgreSQL si el contenedor de base de datos se destruye?**
    *   *Respuesta:* *"Hemos configurado un volumen de datos con nombre de Docker (`postgres_data`) montado en `/var/lib/postgresql/data`. De esta manera, el ciclo de vida del contenedor está completamente desacoplado del de los datos. Si el contenedor de Postgres se detiene o se recrea durante una actualización del pipeline de CI/CD, los datos permanecen intactos en el sistema de archivos persistente de la VM 1."*
*   **3. ¿Qué pasaría si la base de datos de Redis en la VM 1 se satura o se cae?**
    *   *Respuesta:* *"Redis cumple tres roles en nuestra arquitectura: caché de Django, backend de mensajería para Celery y el channel layer de WebSockets. Si Redis se cae, la plataforma no podrá procesar el spawn de retos en segundo plano (las tareas de Celery fallarían) y se perdería la conexión en tiempo real de los marcadores. Sin embargo, la persistencia de usuarios y solves no se vería afectada ya que estos datos transaccionales se escriben directamente en PostgreSQL de forma síncrona."*
*   **4. ¿Por qué configuraron el Nginx de la VM 2 para escuchar en el puerto 80 y no directamente los contenedores en el puerto de cara al estudiante?**
    *   *Respuesta:* *"Si expusiéramos los puertos efímeros (`32768-60999`) directamente al estudiante sin pasar por Nginx, tendríamos que abrir ese enorme rango de puertos en el firewall perimetral y cada contenedor negociaría con el host directamente, exponiendo los banners de versión del servidor Flask o Werkzeug. Al pasar por Nginx, centralizamos el punto de entrada en el puerto 80, ocultamos las tecnologías subyacentes con `server_tokens off`, optimizamos el buffer contra ataques lentos (Slowloris) y garantizamos la reescritura de cabeceras de redirección dinámicas."*
*   **5. ¿Qué estrategia tienen si un estudiante intenta inyectar código para comprometer la VM de desafíos desde un reto SQLi o LFI?**
    *   *Respuesta:* *"Los retos están empaquetados en contenedores con permisos reducidos. El sistema de archivos del contenedor está montado en solo lectura, lo que previene la inyección de WebShells persistentes. Asimismo, el uso de `cap_drop=['ALL']` y `no-new-privileges` asegura que, aunque el estudiante logre ejecutar comandos arbitrarios dentro del contenedor (por ejemplo, a través de un RCE en LFI), no podrá interactuar con el hardware de la VM ni escalar privilegios para afectar a los contenedores de otros estudiantes."*
