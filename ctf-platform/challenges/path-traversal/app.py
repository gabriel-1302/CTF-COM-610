"""
challenges/path-traversal/app.py
Challenge: La Biblioteca Abierta (Path Traversal / LFI)

Vulnerabilidad intencional: el parámetro 'file' se concatena directamente en
la ruta del sistema de archivos sin validar que el resultado permanezca dentro
del directorio /app/docs/.
"""
import os

from flask import Flask, jsonify, render_template_string, request

app = Flask(__name__)

DOCS_DIR = "/app/docs"

DOCS = ["readme.txt", "manual.txt", "changelog.txt"]

BASE_PAGE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocPortal — Biblioteca Interna</title>
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
      border-radius: 8px; padding: 1.5rem; width: 100%; max-width: 560px;
    }
    ul { list-style: none; padding: 0; }
    ul li { padding: 0.4rem 0; border-bottom: 1px solid #21262d; }
    ul li:last-child { border-bottom: none; }
    a { color: #58a6ff; text-decoration: none; font-size: 0.9rem; }
    a:hover { text-decoration: underline; }
    pre {
      background: #010409; border: 1px solid #21262d; border-radius: 4px;
      padding: 1rem; font-size: 0.82rem; color: #c9d1d9;
      white-space: pre-wrap; word-break: break-all; max-height: 400px;
      overflow-y: auto;
    }
    .breadcrumb { font-size: 0.78rem; color: #8b949e; margin-bottom: 0.75rem; }
    .breadcrumb a { color: #8b949e; }
    .hint {
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
    }
    .error { color: #f85149; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>📚 DocPortal — Biblioteca Interna</h1>
  <p>Sistema de documentación corporativa. Acceso restringido al personal autorizado.</p>

  {% block content %}{% endblock %}

  <div class="card hint">
    💡 Los documentos se sirven desde <code>/app/docs/</code>.
       Usa el parámetro <code>?file=</code> para seleccionar el documento.
  </div>
</body>
</html>"""

INDEX_PAGE = BASE_PAGE.replace(
    "{% block content %}{% endblock %}",
    """
  <div class="card">
    <p style="margin-bottom:1rem; font-size:0.85rem; color:#8b949e;">
      Documentos disponibles:
    </p>
    <ul>
      {% for doc in docs %}
      <li>📄 <a href="view?file={{ doc }}">{{ doc }}</a></li>
      {% endfor %}
    </ul>
  </div>
""",
)

VIEW_PAGE = BASE_PAGE.replace(
    "{% block content %}{% endblock %}",
    """
  <div class="card">
    <div class="breadcrumb"><a href="./">← Volver al índice</a> / {{ filename }}</div>
    {% if error %}
      <p class="error">{{ error }}</p>
    {% else %}
      <pre>{{ content }}</pre>
    {% endif %}
  </div>
""",
)


@app.route("/", methods=["GET"])
def index():
    return render_template_string(INDEX_PAGE, docs=DOCS)


# ⚠️ VULNERABILIDAD INTENCIONAL — NO MODIFICAR
@app.route("/view", methods=["GET"])
def view():
    filename = request.args.get("file", "")
    if not filename:
        return render_template_string(VIEW_PAGE, filename="", error="Parámetro 'file' requerido.", content=None), 400

    filepath = os.path.join(DOCS_DIR, filename)

    try:
        with open(filepath) as f:
            content = f.read()
        return render_template_string(VIEW_PAGE, filename=filename, content=content, error=None)
    except FileNotFoundError:
        return render_template_string(VIEW_PAGE, filename=filename, error="Documento no encontrado.", content=None), 404
    except PermissionError:
        return render_template_string(VIEW_PAGE, filename=filename, error="Acceso denegado.", content=None), 403


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5004, debug=False)
