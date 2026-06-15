"""
challenges/sqli/app.py
Challenge: The Database Whisperer (SQL Injection)

Vulnerabilidad intencional: query construida con f-string → sin parametrización.
NO corregir esta línea — es el objetivo del challenge.
"""
import json
import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)
DB_PATH = "database.db"


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ──────────────────────────────────────────────────────────────────────────────
# Página principal — formulario de login
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Database Whisperer — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d; color: #c9d1d9;
      font-family: 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 2rem; width: 360px;
    }
    h1 { color: #58a6ff; font-size: 1.2rem; margin-bottom: 0.4rem; }
    .subtitle { color: #8b949e; font-size: 0.8rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.85rem; color: #8b949e; margin-bottom: 0.25rem; }
    input {
      width: 100%; padding: 0.5rem; background: #0d1117;
      border: 1px solid #30363d; border-radius: 4px;
      color: #c9d1d9; font-family: inherit; margin-bottom: 1rem;
    }
    input:focus { outline: none; border-color: #58a6ff; }
    button {
      width: 100%; padding: 0.6rem; background: #238636;
      border: none; border-radius: 4px; color: #fff;
      cursor: pointer; font-family: inherit; font-size: 0.9rem;
    }
    button:hover { background: #2ea043; }
    .hint {
      margin-top: 1rem; padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🗄️ The Database Whisperer</h1>
    <p class="subtitle">Sistema legacy de autenticación — v1.0.0 (2009)</p>
    <form action="login" method="POST">
      <label for="username">Usuario</label>
      <input type="text" id="username" name="username" placeholder="admin" required>
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" placeholder="••••••" required>
      <button type="submit">Iniciar sesión</button>
    </form>
    <div class="hint">
      💡 Hint: el developer no confía en los ORMs y escribe SQL a mano.
    </div>
  </div>
</body>
</html>"""


# ──────────────────────────────────────────────────────────────────────────────
# Endpoint vulnerable — LÍNEA INTENCIONAL, NO MODIFICAR
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "")
    password = request.form.get("password", "")

    conn = get_db()
    c = conn.cursor()

    # ⚠️ VULNERABILIDAD INTENCIONAL: f-string sin parametrización
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"

    try:
        c.execute(query)
        rows = c.fetchall()
    except Exception as e:
        conn.close()
        return f"""<pre style='background:#0d0d0d;color:#f85149;padding:1rem;'>Error SQL: {e}

Query: {query}</pre>"""

    conn.close()

    if not rows:
        return _render_result("❌ Credenciales incorrectas.", rows=[], query=query, success=False)

    return _render_result("✅ Acceso concedido.", rows=[dict(r) for r in rows], query=query, success=True)


def _render_result(message, rows, query, success):
    color = "#3fb950" if success else "#f85149"
    rows_html = ""
    if rows:
        headers = list(rows[0].keys())
        rows_html = "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in headers) + "</tr></thead><tbody>"
        for row in rows:
            rows_html += "<tr>" + "".join(f"<td>{row[h]}</td>" for h in headers) + "</tr>"
        rows_html += "</tbody></table>"

    return f"""<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8">
  <title>Resultado</title>
  <style>
    body {{ background:#0d0d0d; color:#c9d1d9; font-family:'Courier New',monospace; padding:2rem; }}
    h2 {{ color:{color}; }}
    pre {{ background:#161b22; padding:1rem; border:1px solid #30363d; border-radius:4px; overflow-x:auto; font-size:0.8rem; }}
    table {{ border-collapse:collapse; margin-top:1rem; }}
    th,td {{ border:1px solid #30363d; padding:0.5rem 1rem; text-align:left; }}
    th {{ background:#161b22; color:#58a6ff; }}
    a {{ color:#58a6ff; }}
  </style>
</head><body>
  <h2>{message}</h2>
  <p>Query ejecutada:</p>
  <pre>{query}</pre>
  {rows_html}
  <p style="margin-top:1rem"><a href="./">← Volver</a></p>
</body></html>"""


# ──────────────────────────────────────────────────────────────────────────────
# Health check — usado por Docker HEALTHCHECK y por el backend en Fase 2
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # debug=False obligatorio — Werkzeug en debug expone el PIN del debugger (RCE real)
    app.run(host="0.0.0.0", port=5000, debug=False)
