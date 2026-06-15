import hashlib
import os

from django.core.management.base import BaseCommand

from apps.challenges.models import Challenge

CHALLENGES = [
    {
        "slug": "sqli",
        "name": "El Susurrador de Bases de Datos",
        "points": 100,
        "image_name": "ctf-sqli:latest",
        "internal_port": 5000,
        "description": (
            "Un formulario de login clásico que esconde más de lo que muestra. "
            "Los desarrolladores pensaron que las consultas parametrizadas eran opcionales. "
            "Demuéstrales que se equivocaron — extrae la flag de la base de datos."
        ),
        "hints": [
            {"text": "¿Has oído hablar de UNION SELECT? Permite añadir consultas extra a la original.", "cost": 25},
            {"text": "La tabla de flags se llama 'flags'. Prueba: ' UNION SELECT flag FROM flags --", "cost": 40},
        ],
    },
    {
        "slug": "xss",
        "name": "El Libro de Visitas",
        "points": 150,
        "image_name": "ctf-xss:latest",
        "internal_port": 3000,
        "description": (
            "Un libro de visitas donde cualquiera puede dejar un comentario. "
            "Un bot administrador visita la página cada 30 segundos. "
            "La flag está en la cookie del admin. ¿Puedes robarla?"
        ),
        "hints": [
            {"text": "Los comentarios se renderizan con innerHTML — sin sanitización.", "cost": 30},
            {"text": "Necesitas exfiltrar la cookie. Piensa en: fetch() o document.cookie.", "cost": 50},
        ],
    },
    {
        "slug": "ssti",
        "name": "Bienvenido, {{ usuario }}",
        "points": 200,
        "image_name": "ctf-ssti:latest",
        "internal_port": 5000,
        "description": (
            "Una app de bienvenida que renderiza tu nombre directamente en una plantilla Jinja2. "
            "Los desarrolladores olvidaron la diferencia entre render_template y render_template_string. "
            "La flag está en /flag.txt en el servidor."
        ),
        "hints": [
            {"text": "Prueba visitando /?name={{7*7}} — si ves 49, tienes SSTI.", "cost": 25},
            {"text": "Busca una forma de acceder a os.popen() a través de la jerarquía de objetos de Python.", "cost": 50},
        ],
    },
    {
        "slug": "crypto-rsa",
        "name": "Claves Rotas",
        "points": 250,
        "image_name": "ctf-crypto-rsa:latest",
        "internal_port": 5001,
        "description": (
            "SecureMsg Corp cifró un mensaje confidencial con RSA usando un exponente público e=3 "
            "y RSA sin relleno (textbook RSA). El mensaje es tan corto que m³ < n, "
            "por lo que no hay reducción modular. "
            "Descarga el texto cifrado y calcula la raíz cúbica entera para recuperar el mensaje."
        ),
        "hints": [
            {"text": "Verifica que c < n. Si es así, m = iroot(c, 3). No necesitas factorizar.", "cost": 40},
            {"text": "En Python: usa gmpy2.iroot(c, 3) o implementa Newton/búsqueda binaria. Luego bytes.fromhex(hex(m)[2:]).decode()", "cost": 60},
        ],
    },
    {
        "slug": "crypto-vigenere",
        "name": "El Cifrado Perfecto",
        "points": 300,
        "image_name": "ctf-crypto-vigenere:latest",
        "internal_port": 5002,
        "description": (
            "Una transmisión interceptada cifrada con un cifrado polialfabético clásico. "
            "El emisor afirma que es 'perfectamente seguro'. "
            "Aplica el examen de Kasiski para encontrar la longitud de la clave, "
            "luego análisis de frecuencias en cada columna para recuperar la clave y descifrar el mensaje."
        ),
        "hints": [
            {"text": "Calcula el Índice de Coincidencia para longitudes de clave 2-15. La correcta da IoC ≈ 0.065.", "cost": 50},
            {"text": "La clave es una palabra inglesa común de 6 letras. Cada desplazamiento se recupera con análisis de frecuencias (E≈13%).", "cost": 75},
        ],
    },
    {
        "slug": "cmdi",
        "name": "El Diagnóstico de Red",
        "points": 125,
        "image_name": "ctf-cmdi:latest",
        "internal_port": 5003,
        "description": (
            "Una herramienta interna de diagnóstico de red ejecuta ping contra el host que le indiques. "
            "Los desarrolladores construyeron el comando concatenando directamente el input del usuario. "
            "¿Puedes hacer que el servidor ejecute algo más que un ping?"
        ),
        "hints": [
            {"text": "¿Qué pasa si el host contiene un punto y coma? En bash, ';' separa comandos.", "cost": 25},
            {"text": "shell=True ejecuta el comando en bash. Prueba: 127.0.0.1; id — luego busca la flag.", "cost": 40},
        ],
    },
    {
        "slug": "path-traversal",
        "name": "La Biblioteca Abierta",
        "points": 175,
        "image_name": "ctf-path-traversal:latest",
        "internal_port": 5004,
        "description": (
            "Un portal de documentación corporativa permite leer archivos internos mediante el parámetro ?file=. "
            "Los documentos se sirven desde /app/docs/ — pero nadie validó que la ruta resultante "
            "realmente permaneciera dentro de ese directorio. La flag está en /flag.txt."
        ),
        "hints": [
            {"text": "El parámetro 'file' se usa directamente con open(). ¿Qué ocurre con '../' en una ruta?", "cost": 30},
            {"text": "Prueba: /view?file=../../../flag.txt — el sistema lee desde /app/docs/, así que necesitas subir los niveles suficientes.", "cost": 50},
        ],
    },
    {
        "slug": "jwt",
        "name": "El Portal del Administrador",
        "points": 225,
        "image_name": "ctf-jwt:latest",
        "internal_port": 5005,
        "description": (
            "Un portal empresarial usa JWT para autenticación. Puedes obtener un token como 'guest', "
            "pero la flag solo es accesible con role=admin. "
            "El servidor acepta cualquier algoritmo declarado en el header del token — incluso ninguno."
        ),
        "hints": [
            {"text": "El header JWT contiene el campo 'alg'. ¿Qué pasa si lo cambias a 'none'?", "cost": 35},
            {"text": "Un JWT es header.payload.signature en base64url. Con alg=none la firma puede ser vacía: header.payload.", "cost": 60},
        ],
    },
    {
        "slug": "lfi",
        "name": "La Puerta Entreabierta",
        "points": 150,
        "image_name": "ctf-lfi:latest",
        "internal_port": 5000,
        "description": (
            "Un portal de documentación carga archivos usando el parámetro ?page=. "
            "El servidor construye la ruta uniendo un directorio base con el valor del parámetro. "
            "¿Puedes salir del directorio y leer archivos fuera de él? La flag está en secret.txt junto a la app."
        ),
        "hints": [
            {"text": "El parámetro ?page= es concatenado directamente con la ruta base de pages/.", "cost": 25},
            {"text": "Prueba con ../secret.txt para salir del directorio pages/ y leer el archivo raíz.", "cost": 15},
        ],
    },
    {
        "slug": "idor",
        "name": "Todos los Perfiles",
        "points": 200,
        "image_name": "ctf-idor:latest",
        "internal_port": 5000,
        "description": (
            "Un portal de usuarios permite ver perfiles por ID numérico en la URL: /profile/<id>. "
            "El sistema autentica correctamente, pero no verifica que el perfil solicitado "
            "pertenezca al usuario autenticado. Inicia sesión y explora otros perfiles."
        ),
        "hints": [
            {"text": "La URL /profile/<id> no verifica que el ID corresponda al usuario autenticado.", "cost": 30},
            {"text": "El usuario administrador tiene algo especial en sus notas. Su ID es 3.", "cost": 20},
        ],
    },
    {
        "slug": "xxe",
        "name": "Entidades Peligrosas",
        "points": 250,
        "image_name": "ctf-xxe:latest",
        "internal_port": 5000,
        "description": (
            "Un servicio procesa documentos XML y extrae el contenido de <data>. "
            "El parser tiene habilitada la resolución de entidades externas. "
            "Usa XXE para hacer que el servidor lea un archivo interno y lo devuelva como contenido de <data>."
        ),
        "hints": [
            {"text": "Define una entidad externa en el DOCTYPE: <!ENTITY xxe SYSTEM 'file:///ruta'>", "cost": 35},
            {"text": "La flag está en /tmp/flag.txt. Usa la entidad en el elemento <data>: <data>&xxe;</data>", "cost": 25},
        ],
    },
    {
        "slug": "forensics-pcap",
        "name": "El Tráfico Comprometido",
        "points": 150,
        "image_name": "ctf-forensics-pcap:latest",
        "internal_port": 5000,
        "description": (
            "El IDS universitario capturó tráfico sospechoso en el segmento de administración. "
            "Alguien se autenticó en un servicio de red transmitiendo sus credenciales en texto plano. "
            "Descarga la captura de red, analízala y encuentra la credencial transmitida."
        ),
        "hints": [
            {"text": "Abre el archivo en Wireshark. Busca un protocolo que transmita credenciales en texto claro.", "cost": 25},
            {"text": "Filtra por 'ftp' en Wireshark o sigue el TCP stream. La flag está en el comando PASS.", "cost": 40},
        ],
    },
    {
        "slug": "stego",
        "name": "La Imagen Silenciosa",
        "points": 200,
        "image_name": "ctf-stego:latest",
        "internal_port": 5000,
        "description": (
            "El equipo de respuesta a incidentes interceptó una imagen corporativa de los servidores de la DTIC. "
            "A simple vista parece un documento normal, pero los analistas sospechan que contiene información oculta. "
            "Encuentra la flag escondida dentro de la imagen."
        ),
        "hints": [
            {"text": "La esteganografía puede ocultar datos en los bits menos significativos de los píxeles de una imagen.", "cost": 30},
            {"text": "Extrae el LSB (bit menos significativo) del canal rojo de cada píxel en orden. Agrupa en bytes y convierte a texto.", "cost": 50},
        ],
    },
    {
        "slug": "format-string",
        "name": "El Logger Indiscreto",
        "points": 200,
        "image_name": "ctf-format-string:latest",
        "internal_port": 5000,
        "description": (
            "Un sistema de logging aplica str.format() con input del usuario sobre un diccionario de configuración interno. "
            "Python's .format() permite referenciar claves de un dict pasado como kwargs. "
            "Si conoces una clave del dict de configuración, puedes extraer su valor."
        ),
        "hints": [
            {"text": "El código hace: msg.format(**SECRET_CONFIG). Puedes referenciar cualquier clave del dict.", "cost": 25},
            {"text": "El dict tiene una clave llamada 'flag'. Envía {flag} como mensaje.", "cost": 20},
        ],
    },
]


class Command(BaseCommand):
    help = "Seed or update challenges from environment FLAGS (FLAG_SQLI, FLAG_XSS, FLAG_SSTI, FLAG_CRYPTO_RSA, FLAG_CRYPTO_VIGENERE, FLAG_CMDI, FLAG_PATH_TRAVERSAL, FLAG_JWT, FLAG_LFI, FLAG_IDOR, FLAG_XXE, FLAG_FORMAT_STRING)"

    def handle(self, *args, **opts):
        env_map = {
            "sqli": "FLAG_SQLI",
            "xss": "FLAG_XSS",
            "ssti": "FLAG_SSTI",
            "crypto-rsa": "FLAG_CRYPTO_RSA",
            "crypto-vigenere": "FLAG_CRYPTO_VIGENERE",
            "cmdi": "FLAG_CMDI",
            "path-traversal": "FLAG_PATH_TRAVERSAL",
            "jwt": "FLAG_JWT",
            "lfi": "FLAG_LFI",
            "idor": "FLAG_IDOR",
            "xxe": "FLAG_XXE",
            "format-string": "FLAG_FORMAT_STRING",
            "forensics-pcap": "FLAG_FORENSICS_PCAP",
            "stego": "FLAG_STEGO",
        }

        for data in CHALLENGES:
            env_var = env_map[data["slug"]]
            flag = os.environ.get(env_var)
            if not flag:
                self.stderr.write(
                    self.style.ERROR(f"✗ {env_var} not set in environment — skipping {data['slug']}")
                )
                continue

            flag_hash = hashlib.sha256(flag.strip().encode()).hexdigest()
            challenge, created = Challenge.objects.update_or_create(
                slug=data["slug"],
                defaults={**data, "flag_hash": flag_hash},
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"✓ {verb} {data['slug']} (hash={flag_hash[:12]}...)"))
