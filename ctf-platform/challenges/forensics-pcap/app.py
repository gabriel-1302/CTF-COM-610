from flask import Flask, send_file, render_template_string

app = Flask(__name__)

HTML = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>El Tráfico Comprometido</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:2rem;min-height:100vh}
    h1{color:#34d399;margin-bottom:1rem}
    .card{background:#1e293b;border:1px solid #334155;padding:1.5rem;border-radius:8px;max-width:620px}
    p{color:#cbd5e1;line-height:1.6;margin-bottom:.75rem}
    .badge{display:inline-block;padding:.2rem .6rem;background:#064e3b;color:#6ee7b7;border-radius:4px;font-size:.8rem;margin-bottom:1rem}
    a.btn{display:inline-block;margin-top:.75rem;padding:.6rem 1.2rem;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold}
    a.btn:hover{background:#059669}
    .tip{color:#64748b;font-size:.85rem;margin-top:1rem;border-top:1px solid #334155;padding-top:.75rem}
  </style>
</head>
<body>
  <h1>El Tráfico Comprometido</h1>
  <div class="card">
    <span class="badge">Forense · 150 pts</span>
    <p>El IDS de la red universitaria capturó tráfico sospechoso en el segmento de administración durante la madrugada del 20/05/2026.</p>
    <p>Alguien se autenticó en un servicio de red transmitiendo sus credenciales <strong>en texto plano</strong>. El acceso fue exitoso.</p>
    <p>Descarga la captura, analízala y extrae la credencial transmitida.</p>
    <a href="capture" class="btn">Descargar captura (.pcap)</a>
    <p class="tip">Herramientas: Wireshark · tshark · strings</p>
  </div>
</body>
</html>"""


@app.route('/')
def index():
    return render_template_string(HTML)


@app.route('/capture')
def capture():
    return send_file(
        '/app/static/captura_red.pcap',
        mimetype='application/vnd.tcpdump.pcap',
        as_attachment=True,
        download_name='captura_red.pcap',
    )


@app.route('/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
