import os
from flask import Flask, request, render_template_string

app = Flask(__name__)
FLAG = os.environ.get("FLAG", "CTF{test_flag}")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(BASE_DIR, "pages")

os.makedirs(PAGES_DIR, exist_ok=True)
with open(os.path.join(PAGES_DIR, "home.txt"), "w") as f:
    f.write("Bienvenido al portal de documentación interna.")
with open(os.path.join(PAGES_DIR, "about.txt"), "w") as f:
    f.write("Sistema de gestión de documentos v1.0")

SECRET_FILE = os.path.join(BASE_DIR, "secret.txt")
with open(SECRET_FILE, "w") as f:
    f.write(FLAG)

TEMPLATE = """
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Portal Docs</title>
<style>
body{font-family:monospace;background:#1a1a2e;color:#e0e0e0;margin:0;padding:20px}
h1{color:#00d4ff}.box{background:#16213e;border:1px solid #0f3460;padding:20px;border-radius:8px;margin:20px 0}
a{color:#00d4ff;text-decoration:none}a:hover{text-decoration:underline}
input{background:#0f3460;border:1px solid #00d4ff;color:#e0e0e0;padding:8px;border-radius:4px;width:300px}
button{background:#00d4ff;color:#1a1a2e;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}
</style></head>
<body>
<h1>Portal de Documentación</h1>
<div class="box">
  <p>Páginas disponibles: <a href="?page=home.txt">home</a> · <a href="?page=about.txt">about</a></p>
  <form method="get"><input name="page" value="{{ page }}" placeholder="nombre_archivo.txt"><button>Ver</button></form>
</div>
{% if content %}
<div class="box"><pre>{{ content }}</pre></div>
{% endif %}
{% if error %}
<div class="box" style="border-color:#ff4444"><p style="color:#ff4444">{{ error }}</p></div>
{% endif %}
</body></html>
"""

@app.route("/")
def index():
    page = request.args.get("page", "")
    content = error = ""
    if page:
        path = os.path.join(PAGES_DIR, page)
        try:
            with open(path) as f:
                content = f.read()
        except FileNotFoundError:
            error = f"Archivo no encontrado: {page}"
        except Exception as e:
            error = str(e)
    return render_template_string(TEMPLATE, page=page, content=content, error=error)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
