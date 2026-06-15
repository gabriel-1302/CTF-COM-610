"""
challenges/ssti/app.py
Challenge: Welcome, {{ user }} (Server-Side Template Injection)

Vulnerabilidad intencional: render_template_string con f-string de input del usuario.
El objetivo es leer /flag.txt usando payloads Jinja2.
"""
from flask import Flask, request, render_template_string, jsonify

app = Flask(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Página principal
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome, {{ user }} — SSTI Challenge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d; color: #c9d1d9;
      font-family: 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; flex-direction: column; gap: 1.5rem; padding: 2rem;
    }
    h1 { color: #58a6ff; font-size: 1.4rem; }
    p { color: #8b949e; font-size: 0.9rem; text-align: center; max-width: 500px; }
    .card {
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 1.5rem; width: 100%; max-width: 500px;
    }
    input {
      width: 100%; padding: 0.5rem; background: #0d1117;
      border: 1px solid #30363d; border-radius: 4px;
      color: #c9d1d9; font-family: inherit; margin-bottom: 0.75rem;
    }
    input:focus { outline: none; border-color: #58a6ff; }
    a.btn {
      display: inline-block; padding: 0.5rem 1.5rem;
      background: #1f6feb; border-radius: 4px; color: #fff;
      text-decoration: none; font-size: 0.9rem;
    }
    a.btn:hover { background: #388bfd; }
    .hint {
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
    }
  </style>
</head>
<body>
  <h1>🧩 Welcome, {{ user }}</h1>
  <p>Una app Flask personaliza tu bienvenida. El desarrollador tomó un atajo peligroso con los templates.</p>
  <div class="card">
    <form action="hello" method="GET">
      <input type="text" name="name" placeholder="Tu nombre..." value="world">
      <a class="btn" href="hello?name=world">Probar →</a>
    </form>
  </div>
  <div class="card hint">
    💡 Hint: <code>/hello?name={{7*7}}</code> — ¿qué devuelve?
    La flag está en el filesystem del servidor.
  </div>
</body>
</html>"""


# ──────────────────────────────────────────────────────────────────────────────
# Endpoint vulnerable — LÍNEA INTENCIONAL, NO MODIFICAR
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/hello", methods=["GET"])
def hello():
    name = request.args.get("name", "world")

    # ⚠️ VULNERABILIDAD INTENCIONAL: f-string dentro de render_template_string
    # El input del usuario se interpola directamente en el template Jinja2.
    return render_template_string(f"<h1>Hello, {name}!</h1>")


# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
