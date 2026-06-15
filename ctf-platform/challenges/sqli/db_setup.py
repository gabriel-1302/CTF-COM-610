"""
db_setup.py — Ejecutado en build-time (ver Dockerfile).
Crea database.db con tabla users y tabla flags.
La flag viene de la variable de entorno FLAG (inyectada por ARG en Dockerfile).
"""
import os
import sqlite3

FLAG = os.environ.get("FLAG")
if not FLAG:
    raise SystemExit("ERROR: Variable de entorno FLAG no definida. "
                     "Buildear con --build-arg FLAG=CTF{...}")

DB_PATH = "database.db"

# Borrar si existe → builds reproducibles
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Tabla de usuarios dummy (ruido para el jugador)
c.execute("""
CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL
)
""")

dummy_users = [
    ("admin",   "s3cr3t_p4ss"),
    ("alice",   "alice123"),
    ("bob",     "hunter2"),
    ("charlie", "qwerty"),
    ("dave",    "password1"),
]
c.executemany("INSERT INTO users (username, password) VALUES (?, ?)", dummy_users)

# Tabla flags — solo una fila con la flag real
c.execute("""
CREATE TABLE flags (
    id    INTEGER PRIMARY KEY,
    value TEXT NOT NULL
)
""")
c.execute("INSERT INTO flags (value) VALUES (?)", (FLAG,))

conn.commit()
conn.close()

print(f"[db_setup] database.db creada con {len(dummy_users)} usuarios y 1 flag.")
