import os
from flask import Flask, request, render_template_string, session, redirect

app = Flask(__name__)
app.secret_key = os.urandom(24)
FLAG = os.environ.get("FLAG", "CTF{test_flag}")

USERS = {
    1: {"id": 1, "username": "alice", "password": "password123", "role": "user", "notes": "Mis notas personales: reunion el lunes."},
    2: {"id": 2, "username": "bob", "password": "qwerty456", "role": "user", "notes": "Recordatorio: cambiar contraseña del servidor."},
    3: {"id": 3, "username": "admin", "password": "super_secret_admin_2024!", "role": "admin", "notes": FLAG},
    4: {"id": 4, "username": "carol", "password": "carol789", "role": "user", "notes": "Lista de compras: leche, pan, huevos."},
}

TEMPLATE = """
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Portal Usuarios</title>
<style>
body{font-family:sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:20px}
h1{color:#58a6ff}.card{background:#161b22;border:1px solid #30363d;padding:20px;border-radius:8px;margin:16px 0;max-width:600px}
a{color:#58a6ff}input{background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:8px;border-radius:6px;margin:4px}
button{background:#238636;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer}
.warn{color:#f0883e}.err{color:#f85149}
</style></head>
<body>
<h1>Portal de Usuarios</h1>
{% if not logged_in %}
<div class="card">
  <h3>Iniciar Sesión</h3>
  <form method="post" action="login">
    <input name="username" placeholder="Usuario" required><br>
    <input name="password" type="password" placeholder="Contraseña" required><br><br>
    <button>Entrar</button>
  </form>
  {% if error %}<p class="err">{{ error }}</p>{% endif %}
  <p style="margin-top:16px;font-size:13px;color:#8b949e">Usuarios de prueba: alice / password123 &nbsp;·&nbsp; bob / qwerty456</p>
</div>
{% else %}
<div class="card">
  <p>Bienvenido, <strong>{{ username }}</strong> (ID: {{ user_id }}) · <a href="logout">Cerrar sesión</a></p>
  <p><a href="profile/{{ user_id }}">Ver mi perfil</a></p>
</div>
<div class="card">
  <h3>Ver perfil de usuario</h3>
  <form>
    <label>ID de usuario: <input id="uid" value="{{ user_id }}" style="width:80px"></label>
    <button onclick="const base = window.location.pathname.split('/profile/')[0]; window.location = (base.endsWith('/') ? base : base + '/') + 'profile/' + document.getElementById('uid').value; return false">Ver</button>
  </form>
</div>
{% if profile %}
<div class="card">
  <h3>Perfil #{{ profile.id }}: {{ profile.username }}</h3>
  <p>Rol: <span class="warn">{{ profile.role }}</span></p>
  <p>Notas: <em>{{ profile.notes }}</em></p>
</div>
{% endif %}
{% endif %}
</body></html>
"""

@app.route("/")
def index():
    logged_in = "user_id" in session
    return render_template_string(TEMPLATE, logged_in=logged_in,
        username=session.get("username"), user_id=session.get("user_id"),
        profile=None, error=None)

@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    for uid, u in USERS.items():
        if u["username"] == username and u["password"] == password:
            session["user_id"] = uid
            session["username"] = username
            return redirect("./")
    return render_template_string(TEMPLATE, logged_in=False, error="Credenciales incorrectas",
        profile=None, username=None, user_id=None)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("./")

@app.route("/profile/<int:uid>")
def profile(uid):
    if "user_id" not in session:
        return redirect("../")
    user_data = USERS.get(uid)
    if not user_data:
        return render_template_string(TEMPLATE, logged_in=True,
            username=session.get("username"), user_id=session.get("user_id"),
            profile=None, error="Usuario no encontrado")
    return render_template_string(TEMPLATE, logged_in=True,
        username=session.get("username"), user_id=session.get("user_id"),
        profile=user_data, error=None)

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
