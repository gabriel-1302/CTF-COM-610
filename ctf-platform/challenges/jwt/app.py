"""
challenges/jwt/app.py
Challenge: El Portal del Administrador (JWT Algorithm Confusion — alg:none)

Vulnerabilidad intencional: el servidor acepta tokens JWT con alg=none
(sin firma), permitiendo forjar un token con role=admin sin conocer el secreto.

Flujo de ataque:
  1. POST /login con guest/guest → recibe JWT firmado con HS256
  2. Decodificar header+payload (base64), cambiar role a "admin" y alg a "none"
  3. Re-construir token: base64(header).base64(payload). (firma vacía)
  4. GET /admin con el token forjado → flag
"""
import base64
import json
import os

import jwt
from flask import Flask, jsonify, render_template_string, request

app = Flask(__name__)

JWT_SECRET = "s3cr3t_k3y_sup3r_s3gur0"
FLAG = os.environ.get("FLAG", "CTF{flag_not_set}")

USERS = {
    "guest": {"password": "guest", "role": "guest"},
}

PAGE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AdminPortal — Acceso Seguro</title>
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
    .card h2 { font-size: 0.95rem; color: #8b949e; margin-bottom: 1rem; }
    code {
      background: #0d1117; border: 1px solid #21262d; border-radius: 3px;
      padding: 0.1rem 0.4rem; font-size: 0.82rem; color: #79c0ff;
    }
    .token-box {
      background: #010409; border: 1px solid #21262d; border-radius: 4px;
      padding: 0.75rem; font-size: 0.75rem; color: #3fb950;
      word-break: break-all; margin-top: 0.75rem;
    }
    .hint {
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
    }
    ul { padding-left: 1.2rem; }
    ul li { margin: 0.3rem 0; font-size: 0.85rem; }
    .step { color: #58a6ff; font-weight: bold; }
  </style>
</head>
<body>
  <h1>🔐 AdminPortal v3.0</h1>
  <p>Portal de acceso al panel de administración.
     Solo usuarios con rol <code>admin</code> pueden ver la flag.</p>

  <div class="card">
    <h2>Credenciales de prueba</h2>
    <ul>
      <li>Usuario: <code>guest</code> / Contraseña: <code>guest</code></li>
      <li>Rol asignado: <code>guest</code></li>
    </ul>
  </div>

  <div class="card">
    <h2>Endpoints disponibles</h2>
    <ul>
      <li><span class="step">POST</span> <code>/login</code> — Obtén tu JWT (body JSON: username, password)</li>
      <li><span class="step">GET</span> <code>/dashboard</code> — Panel de usuario (requiere JWT)</li>
      <li><span class="step">GET</span> <code>/admin</code> — Panel admin — solo role=admin</li>
    </ul>
  </div>

  <div class="card hint">
    💡 El token JWT tiene 3 partes separadas por <code>.</code>:
    <code>header</code>.<code>payload</code>.<code>signature</code>.
    Cada parte está codificada en base64url. ¿Qué contiene el header?
    ¿Y si el algoritmo fuera distinto?
  </div>
</body>
</html>"""


@app.route("/", methods=["GET"])
def index():
    return render_template_string(PAGE)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Credenciales inválidas"}), 401

    token = jwt.encode(
        {"username": username, "role": user["role"]},
        JWT_SECRET,
        algorithm="HS256",
    )
    return jsonify({"token": token, "role": user["role"]})


def _decode_token(token: str) -> dict | None:
    """
    ⚠️ VULNERABILIDAD INTENCIONAL: acepta alg=none sin verificar firma.
    En producción nunca se debe deshabilitar verify_signature.
    """
    try:
        # Inspeccionar el header para detectar alg=none
        header_part = token.split(".")[0]
        # Añadir padding si falta
        padding = 4 - len(header_part) % 4
        if padding != 4:
            header_part += "=" * padding
        header = json.loads(base64.urlsafe_b64decode(header_part))

        if header.get("alg", "").lower() == "none":
            # alg=none: decodificar sin verificar firma
            payload_part = token.split(".")[1]
            padding = 4 - len(payload_part) % 4
            if padding != 4:
                payload_part += "=" * padding
            return json.loads(base64.urlsafe_b64decode(payload_part))

        # HS256 normal
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def _get_token() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.args.get("token")


@app.route("/dashboard", methods=["GET"])
def dashboard():
    token = _get_token()
    if not token:
        return jsonify({"error": "Token requerido. Usa: Authorization: Bearer <token>"}), 401

    payload = _decode_token(token)
    if not payload:
        return jsonify({"error": "Token inválido o expirado"}), 401

    return jsonify({
        "message": f"Bienvenido, {payload.get('username', 'usuario')}.",
        "role": payload.get("role"),
        "hint": "El panel admin está en /admin — solo para role=admin.",
    })


@app.route("/admin", methods=["GET"])
def admin():
    token = _get_token()
    if not token:
        return jsonify({"error": "Token requerido"}), 401

    payload = _decode_token(token)
    if not payload:
        return jsonify({"error": "Token inválido"}), 401

    if payload.get("role") != "admin":
        return jsonify({"error": "Acceso denegado. Se requiere role=admin."}), 403

    return jsonify({
        "message": "Bienvenido al panel de administración.",
        "flag": FLAG,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=False)
