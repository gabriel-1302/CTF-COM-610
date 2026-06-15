from flask import Flask, send_file, render_template_string

app = Flask(__name__)

HTML = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>La Imagen Silenciosa</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:2rem;min-height:100vh}
    h1{color:#818cf8;margin-bottom:1rem}
    .card{background:#1e293b;border:1px solid #334155;padding:1.5rem;border-radius:8px;max-width:620px}
    p{color:#cbd5e1;line-height:1.6;margin-bottom:.75rem}
    .badge{display:inline-block;padding:.2rem .6rem;background:#1e1b4b;color:#a5b4fc;border-radius:4px;font-size:.8rem;margin-bottom:1rem}
    .preview{margin:1rem 0;border:1px solid #334155;border-radius:6px;overflow:hidden;max-width:400px}
    .preview img{width:100%;display:block}
    a.btn{display:inline-block;margin-top:.75rem;padding:.6rem 1.2rem;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold}
    a.btn:hover{background:#4f46e5}
    .tip{color:#64748b;font-size:.85rem;margin-top:1rem;border-top:1px solid #334155;padding-top:.75rem}
  </style>
</head>
<body>
  <h1>La Imagen Silenciosa</h1>
  <div class="card">
    <span class="badge">Forense · 200 pts</span>
    <p>El equipo de respuesta a incidentes interceptó esta imagen proveniente de los servidores de la DTIC.</p>
    <p>A simple vista parece un documento corporativo estándar. Los analistas creen que contiene información oculta en los datos de píxeles.</p>
    <p>Descarga la imagen y encuentra la flag.</p>
    <div class="preview">
      <img src="image" alt="Documento AURORA-7">
    </div>
    <a href="image" class="btn">Descargar imagen (.png)</a>
    <p class="tip">Herramientas: Python + Pillow · zsteg · StegSolve</p>
  </div>
</body>
</html>"""


@app.route('/')
def index():
    return render_template_string(HTML)


@app.route('/image')
def image():
    return send_file(
        '/app/static/documento_aurora7.png',
        mimetype='image/png',
        as_attachment=True,
        download_name='documento_aurora7.png',
    )


@app.route('/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
