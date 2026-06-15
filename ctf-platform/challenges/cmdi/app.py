"""
challenges/cmdi/app.py
Challenge: El Diagnóstico de Red (Command Injection)

Vulnerabilidad intencional: input del usuario concatenado directamente en
subprocess.run(shell=True) sin sanitización.
"""
import subprocess

from flask import Flask, jsonify, render_template_string, request

app = Flask(__name__)

PAGE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetDiag v2.1 — Diagnóstico de Red</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d; color: #c9d1d9;
      font-family: 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; flex-direction: column; gap: 1.5rem; padding: 2rem;
    }
    h1 { color: #58a6ff; font-size: 1.3rem; letter-spacing: 1px; }
    p  { color: #8b949e; font-size: 0.88rem; text-align: center; max-width: 540px; }
    .card {
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 1.5rem; width: 100%; max-width: 540px;
    }
    label { display: block; font-size: 0.8rem; color: #8b949e; margin-bottom: 0.4rem; }
    input[type=text] {
      width: 100%; padding: 0.5rem 0.75rem;
      background: #0d1117; border: 1px solid #30363d; border-radius: 4px;
      color: #c9d1d9; font-family: inherit; font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }
    input[type=text]:focus { outline: none; border-color: #58a6ff; }
    button {
      padding: 0.5rem 1.5rem; background: #1f6feb; border: none;
      border-radius: 4px; color: #fff; font-family: inherit;
      font-size: 0.9rem; cursor: pointer;
    }
    button:hover { background: #388bfd; }
    pre {
      background: #010409; border: 1px solid #21262d; border-radius: 4px;
      padding: 1rem; font-size: 0.82rem; color: #3fb950;
      white-space: pre-wrap; word-break: break-all; max-height: 340px;
      overflow-y: auto;
    }
    .hint {
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
    }
    .badge {
      display: inline-block; padding: 0.15rem 0.5rem;
      background: #0d419d; border-radius: 4px; font-size: 0.7rem;
      color: #79c0ff; margin-left: 0.5rem;
    }
  </style>
</head>
<body>
  <h1>📡 NetDiag v2.1 <span class="badge">INTERNAL TOOL</span></h1>
  <p>Herramienta de diagnóstico de conectividad de red para el equipo de operaciones.
     Introduce una IP o hostname para verificar su estado.</p>

  <div class="card">
    <form method="POST" action="ping">
      <label for="host">Host / IP destino</label>
      <input type="text" id="host" name="host"
             placeholder="ej. 192.168.1.1 o google.com"
             value="{{ host }}" autocomplete="off">
      <button type="submit">▶ Diagnosticar</button>
    </form>
  </div>

  {% if output %}
  <div class="card">
    <pre>{{ output }}</pre>
  </div>
  {% endif %}

  <div class="card hint">
    💡 Esta herramienta ejecuta <code>ping -c 2 &lt;host&gt;</code> directamente
    en el servidor. El equipo de ops la usa para comprobar conectividad rápida.
  </div>
</body>
</html>"""


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        return ping()
    return render_template_string(PAGE, host="", output=None)


# ⚠️ VULNERABILIDAD INTENCIONAL — NO MODIFICAR
@app.route("/ping", methods=["POST"])
def ping():
    host = request.form.get("host", "").strip()
    if not host:
        return render_template_string(PAGE, host="", output="Error: introduce un host.")

    result = subprocess.run(
        f"ping -c 2 {host}",
        shell=True,
        capture_output=True,
        text=True,
        timeout=10,
    )
    output = result.stdout + result.stderr
    return render_template_string(PAGE, host=host, output=output or "(sin salida)")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003, debug=False)
