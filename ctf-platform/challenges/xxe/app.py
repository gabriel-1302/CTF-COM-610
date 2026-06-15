import os
from flask import Flask, request, render_template_string
from lxml import etree

app = Flask(__name__)
FLAG = os.environ.get("FLAG", "CTF{test_flag}")
FLAG_FILE = "/tmp/flag.txt"
with open(FLAG_FILE, "w") as f:
    f.write(FLAG)

TEMPLATE = """
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>XML Parser</title>
<style>
body{font-family:monospace;background:#13111c;color:#e2e2e2;padding:20px}
h1{color:#a78bfa}.box{background:#1e1b2e;border:1px solid #4c1d95;padding:20px;border-radius:8px;margin:16px 0;max-width:700px}
textarea{width:100%;height:180px;background:#0f0d1a;border:1px solid #7c3aed;color:#e2e2e2;padding:10px;border-radius:6px;font-family:monospace;font-size:13px}
button{background:#7c3aed;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold}
pre{background:#0f0d1a;padding:16px;border-radius:6px;overflow:auto;border:1px solid #4c1d95}
.hint{color:#a78bfa;font-size:13px}
</style></head>
<body>
<h1>Servicio XML Parser</h1>
<div class="box">
  <p>Este servicio procesa documentos XML y extrae el contenido del elemento <code>&lt;data&gt;</code>.</p>
  <form method="post">
    <textarea name="xml">{{ xml | e }}</textarea><br><br>
    <button>Procesar XML</button>
  </form>
  <p class="hint">Ejemplo: <code>&lt;root&gt;&lt;data&gt;Hola mundo&lt;/data&gt;&lt;/root&gt;</code></p>
</div>
{% if result is not none %}
<div class="box">
  <h3>Resultado:</h3>
  <pre>{{ result }}</pre>
</div>
{% endif %}
{% if error %}
<div class="box" style="border-color:#ef4444">
  <p style="color:#ef4444">Error: {{ error }}</p>
</div>
{% endif %}
</body></html>
"""

@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    error = None
    xml_input = """<?xml version="1.0"?>
<root>
  <data>Hola mundo</data>
</root>"""
    if request.method == "POST":
        xml_input = request.form.get("xml", "")
        try:
            parser = etree.XMLParser(resolve_entities=True, load_dtd=True, no_network=False)
            root = etree.fromstring(xml_input.encode(), parser)
            data_el = root.find(".//data")
            result = data_el.text if data_el is not None else "(elemento <data> no encontrado)"
        except etree.XMLSyntaxError as e:
            error = f"XML inválido: {e}"
        except Exception as e:
            error = str(e)
    return render_template_string(TEMPLATE, xml=xml_input, result=result, error=error)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
