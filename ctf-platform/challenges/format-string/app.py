import os
from flask import Flask, request, render_template_string

app = Flask(__name__)
FLAG = os.environ.get("FLAG", "CTF{test_flag}")

SECRET_CONFIG = {
    "db_host": "postgres.internal",
    "db_user": "admin",
    "db_pass": "sup3r_s3cr3t_db_p4ss",
    "flag": FLAG,
    "api_key": "sk-internal-9f3a2b1c8d7e6f5a4b3c2d1e",
}

TEMPLATE = """
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Logger Sistema</title>
<style>
body{font-family:monospace;background:#0a0e1a;color:#00ff88;margin:0;padding:20px}
h1{color:#00ccff}.terminal{background:#050810;border:1px solid #00ff88;padding:20px;border-radius:4px;margin:16px 0;max-width:700px}
input{background:#050810;border:1px solid #00ff88;color:#00ff88;padding:10px;width:400px;font-family:monospace;border-radius:4px}
button{background:transparent;border:1px solid #00ff88;color:#00ff88;padding:10px 20px;cursor:pointer;font-family:monospace}
button:hover{background:#00ff8822}.warn{color:#ffcc00}
</style></head>
<body>
<h1>[ Sistema de Logging v2.3 ]</h1>
<div class="terminal">
  <p>$ Ingresa un mensaje para registrar en el log del sistema:</p>
  <form method="post">
    <input name="msg" value="{{ msg | e }}" placeholder="Escribe tu mensaje..." autocomplete="off"><br><br>
    <button>[ REGISTRAR ]</button>
  </form>
</div>
{% if output is not none %}
<div class="terminal">
  <p class="warn">$ Log registrado:</p>
  <pre>{{ output }}</pre>
</div>
{% endif %}
<div class="terminal">
  <p style="color:#666">Tip: el sistema usa format() internamente para construir el mensaje de log.</p>
</div>
</body></html>
"""

@app.route("/", methods=["GET", "POST"])
def index():
    msg = ""
    output = None
    if request.method == "POST":
        msg = request.form.get("msg", "")
        try:
            output = msg.format(**SECRET_CONFIG)
        except (KeyError, IndexError):
            output = msg
        except Exception as e:
            output = f"Error: {e}"
    return render_template_string(TEMPLATE, msg=msg, output=output)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
