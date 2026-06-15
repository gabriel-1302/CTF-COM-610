"""
challenges/crypto-rsa/app.py
Challenge: Broken Keys (RSA — small public exponent)

SecureMsg Corp uses e=3 (a "faster" public exponent) with textbook RSA
and no padding. Because the flag is short, m^3 < n — cube root attack works.

Endpoints:
  GET /          — Challenge landing page with instructions
  GET /pubkey    — RSA public key in PEM format (n, e=3)
  GET /challenge — n, e, ciphertext_hex as JSON
  GET /health    — Health check
"""
import json
from flask import Flask, jsonify, Response

app = Flask(__name__)

with open("challenge.json") as f:
    CHALLENGE = json.load(f)


# ─── HTML ─────────────────────────────────────────────────────────────────────

HTML_INDEX = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Broken Keys — RSA Small Exponent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d; color: #c9d1d9;
      font-family: 'Courier New', monospace;
      min-height: 100vh; padding: 2rem;
    }
    .container { max-width: 740px; margin: 0 auto; }
    h1 { color: #f78166; font-size: 1.4rem; margin-bottom: 0.35rem; }
    .subtitle { color: #6e7681; font-size: 0.78rem; margin-bottom: 2rem; letter-spacing: 0.04em; }
    .card {
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 1.5rem; margin-bottom: 1.25rem;
    }
    .card h2 { color: #58a6ff; font-size: 1rem; margin-bottom: 0.75rem; }
    p { color: #8b949e; font-size: 0.87rem; line-height: 1.65; margin-bottom: 0.6rem; }
    .endpoints { display: flex; flex-direction: column; gap: 0.5rem; }
    .endpoint {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.6rem 0.75rem; background: #0d1117;
      border: 1px solid #30363d; border-radius: 6px;
      text-decoration: none; color: #c9d1d9; font-size: 0.85rem;
      transition: border-color 0.15s;
    }
    .endpoint:hover { border-color: #58a6ff; color: #e6edf3; }
    .method {
      font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem;
      border-radius: 3px; background: #1f6feb; color: #fff; white-space: nowrap;
    }
    .hint {
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
      border-radius: 0 4px 4px 0;
    }
    .danger {
      padding: 0.75rem; background: #1c1215;
      border-left: 3px solid #f85149; font-size: 0.78rem; color: #8b949e;
      border-radius: 0 4px 4px 0; margin-bottom: 0.75rem;
    }
    code {
      background: #1c2128; padding: 0.12rem 0.35rem;
      border-radius: 3px; color: #e6edf3; font-size: 0.85em;
    }
    pre {
      background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
      padding: 1rem; overflow-x: auto; font-size: 0.78rem;
      color: #3fb950; margin: 0.75rem 0; white-space: pre-wrap; word-break: break-all;
    }
    .steps-list { list-style: none; padding: 0; }
    .steps-list li {
      padding: 0.4rem 0 0.4rem 1.5rem; position: relative;
      color: #8b949e; font-size: 0.87rem;
    }
    .steps-list li::before {
      content: attr(data-n); position: absolute; left: 0;
      color: #f78166; font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Broken Keys — RSA Small Exponent</h1>
    <p class="subtitle">SecureMsg Corp &nbsp;·&nbsp; "Optimized public exponent for performance" &nbsp;·&nbsp; e = 3</p>

    <div class="card">
      <h2>📋 Scenario</h2>
      <p>
        SecureMsg Corp deployed an RSA encryption system using a "performance-optimized"
        public exponent of <code>e = 3</code> and textbook RSA (no padding) to speed up
        encryption. A confidential flag has been encrypted for the admin.
      </p>
      <div class="danger">
        ⚠️ When <code>e = 3</code> and the message is short, the ciphertext
        <code>c = m<sup>3</sup></code> may be computed without any modular reduction
        (i.e., <code>m<sup>3</sup> &lt; n</code>).
        In that case, <code>m</code> is simply the integer cube root of <code>c</code> —
        no factorization needed.
      </div>
      <p>
        Your goal: retrieve <code>c</code> (the ciphertext) and <code>n</code> from
        <code>/challenge</code>, then compute the integer cube root of <code>c</code>
        to recover the flag.
      </p>
    </div>

    <div class="card">
      <h2>🔌 Endpoints</h2>
      <div class="endpoints">
        <a href="pubkey" class="endpoint">
          <span class="method">GET</span>
          <span>/pubkey &nbsp;—&nbsp; RSA public key in PEM format (e=3)</span>
        </a>
        <a href="challenge" class="endpoint">
          <span class="method">GET</span>
          <span>/challenge &nbsp;—&nbsp; <code>n</code>, <code>e</code> and ciphertext as JSON</span>
        </a>
      </div>
    </div>

    <div class="card">
      <h2>🛠️ Attack Path</h2>
      <ul class="steps-list">
        <li data-n="1.">
          Grab <code>n</code> and <code>ciphertext_hex</code> from <code>/challenge</code>
        </li>
        <li data-n="2.">
          Verify that <code>c &lt; n</code> (no modular reduction happened)
        </li>
        <li data-n="3.">
          Compute the <strong>integer cube root</strong> of <code>c</code>: &nbsp;
          <code>m = iroot(c, 3)</code>
        </li>
        <li data-n="4.">
          Convert <code>m</code> to bytes: <code>bytes.fromhex(hex(m)[2:]).decode()</code>
        </li>
      </ul>
      <pre># Python solver (no external dependencies)
import json, requests

data = requests.get("http://localhost/challenge").json()
c = int(data["ciphertext_hex"], 16)
n = int(data["n"])

assert c < n, "c >= n: modular reduction occurred, wrong attack"

# Integer cube root via Newton's method
def iroot(n, k):
    x = int(n ** (1/k)) + 2
    while True:
        x1 = ((k-1)*x + n // x**(k-1)) // k
        if x1 >= x: break
        x = x1
    while x**k > n: x -= 1
    return x

m = iroot(c, 3)
flag = bytes.fromhex(hex(m)[2:]).decode()
print(flag)</pre>
      <div class="hint">
        💡 Tip: <code>gmpy2.iroot(c, 3)</code> is faster for large integers.
        Also available in <code>sympy.integer_nthroot(c, 3)</code>.
      </div>
    </div>
  </div>
</body>
</html>"""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return HTML_INDEX


@app.route("/pubkey", methods=["GET"])
def pubkey():
    """Return the RSA public key in PEM format — the starting point for the attack."""
    return Response(
        CHALLENGE["public_key_pem"],
        mimetype="text/plain",
        headers={"Content-Disposition": "inline; filename=public.pem"},
    )


@app.route("/challenge", methods=["GET"])
def challenge_data():
    """Return n, e=3, and the encrypted flag (c = m^3, no modular reduction)."""
    return jsonify({
        "n": CHALLENGE["n"],
        "e": CHALLENGE["e"],
        "key_bits": CHALLENGE["key_bits"],
        "ciphertext_hex": CHALLENGE["ciphertext_hex"],
        "note": CHALLENGE["note"],
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # debug=False — never expose Werkzeug debugger PIN
    app.run(host="0.0.0.0", port=5001, debug=False)
