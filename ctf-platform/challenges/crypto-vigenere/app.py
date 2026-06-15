"""
challenges/crypto-vigenere/app.py
Challenge: The Perfect Cipher (Vigenère)

An intercepted ciphertext encrypted with a "perfectly secure" classical cipher.
The cipher is only as strong as its key — find the key, read the message.

Attack path:
  1. Download the ciphertext from GET /ciphertext
  2. Run Kasiski examination to estimate key length (answer: 6)
  3. Use Index of Coincidence to confirm key length
  4. Apply frequency analysis on each column to recover each key character
  5. POST /decrypt with {"key": "YOURKEY"} to test decryption
  6. Extract the flag from the decrypted plaintext

Endpoints:
  GET  /           — Challenge landing page with the ciphertext
  GET  /ciphertext — Raw ciphertext as text/plain (for scripting)
  POST /decrypt    — Decrypts the ciphertext with the provided key
  GET  /health     — Health check
"""
import json
from flask import Flask, jsonify, request, Response

app = Flask(__name__)

with open("challenge.json") as f:
    _data = json.load(f)

CIPHERTEXT = _data["ciphertext"]


# ── Cipher ────────────────────────────────────────────────────────────────────

def vigenere_decrypt(ciphertext: str, key: str) -> str:
    """Standard Vigenère decryption — only [A-Z] uppercase chars are shifted."""
    key = key.upper()
    result = []
    ki = 0
    for ch in ciphertext:
        if "A" <= ch <= "Z":
            shift = ord(key[ki % len(key)]) - ord("A")
            result.append(chr((ord(ch) - ord("A") - shift) % 26 + ord("A")))
            ki += 1
        else:
            result.append(ch)
    return "".join(result)


# ── HTML Page ─────────────────────────────────────────────────────────────────

def build_index() -> str:
    preview = CIPHERTEXT[:300]
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Perfect Cipher — Vigenère</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d0d0d; color: #c9d1d9;
      font-family: 'Courier New', monospace;
      min-height: 100vh; padding: 2rem;
    }}
    .container {{ max-width: 780px; margin: 0 auto; }}
    h1 {{ color: #a371f7; font-size: 1.4rem; margin-bottom: 0.35rem; }}
    .subtitle {{ color: #6e7681; font-size: 0.78rem; margin-bottom: 2rem; letter-spacing: 0.04em; }}
    .card {{
      background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 1.5rem; margin-bottom: 1.25rem;
    }}
    .card h2 {{ color: #58a6ff; font-size: 1rem; margin-bottom: 0.75rem; }}
    p {{ color: #8b949e; font-size: 0.87rem; line-height: 1.65; margin-bottom: 0.6rem; }}
    .cipher-box {{
      background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
      padding: 1rem; font-size: 0.78rem; color: #3fb950;
      word-break: break-all; line-height: 1.8; max-height: 160px; overflow-y: auto;
    }}
    .cipher-full {{
      background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
      padding: 1rem; overflow-x: auto; font-size: 0.78rem; color: #3fb950;
      word-break: break-all; line-height: 1.8;
    }}
    .endpoint {{
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.6rem 0.75rem; background: #0d1117;
      border: 1px solid #30363d; border-radius: 6px;
      text-decoration: none; color: #c9d1d9; font-size: 0.85rem;
      transition: border-color 0.15s; margin-bottom: 0.5rem;
    }}
    .endpoint:hover {{ border-color: #a371f7; }}
    .method-get {{
      font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem;
      border-radius: 3px; background: #1f6feb; color: #fff; white-space: nowrap;
    }}
    .method-post {{
      font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem;
      border-radius: 3px; background: #388bfd33; color: #388bfd;
      border: 1px solid #388bfd; white-space: nowrap;
    }}
    .hint {{
      padding: 0.75rem; background: #1c2128;
      border-left: 3px solid #d29922; font-size: 0.78rem; color: #8b949e;
      border-radius: 0 4px 4px 0;
    }}
    code {{
      background: #1c2128; padding: 0.12rem 0.35rem;
      border-radius: 3px; color: #e6edf3; font-size: 0.85em;
    }}
    pre {{
      background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
      padding: 1rem; overflow-x: auto; font-size: 0.78rem;
      color: #3fb950; margin: 0.75rem 0;
    }}
    .steps-list {{ list-style: none; padding: 0; }}
    .steps-list li {{
      padding: 0.4rem 0 0.4rem 1.5rem; position: relative;
      color: #8b949e; font-size: 0.87rem;
    }}
    .steps-list li::before {{
      content: attr(data-n); position: absolute; left: 0;
      color: #a371f7; font-weight: bold;
    }}
    .download-btn {{
      display: inline-block; margin-top: 0.75rem;
      padding: 0.45rem 1rem; background: #21262d;
      border: 1px solid #30363d; border-radius: 6px;
      color: #c9d1d9; font-family: inherit; font-size: 0.82rem;
      text-decoration: none; transition: border-color 0.15s;
    }}
    .download-btn:hover {{ border-color: #58a6ff; color: #e6edf3; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>🔏 The Perfect Cipher — Vigenère</h1>
    <p class="subtitle">SIGNAL INTELLIGENCE UNIT 7 &nbsp;·&nbsp; INTERCEPTED TRANSMISSION &nbsp;·&nbsp; CLASSIFIED</p>

    <div class="card">
      <h2>📋 Scenario</h2>
      <p>
        Our signals intelligence unit intercepted a hostile transmission.
        The sender claims their communication is protected by a "perfectly secure"
        polyalphabetic cipher. Intelligence suggests they reuse the same short key
        across all transmissions.
      </p>
      <p>
        A polyalphabetic cipher is only as strong as the length and secrecy of its key.
        With a key shorter than the message, statistical patterns emerge that a skilled
        analyst can exploit. Your mission: recover the key and read the message.
      </p>
    </div>

    <div class="card">
      <h2>📨 Intercepted Ciphertext</h2>
      <p>First 300 characters (preview):</p>
      <div class="cipher-box">{preview}</div>
      <a href="ciphertext" class="download-btn">⬇ Download full ciphertext (text/plain)</a>
    </div>

    <div class="card">
      <h2>🔌 Endpoints</h2>
      <a href="ciphertext" class="endpoint">
        <span class="method-get">GET</span>
        <span>/ciphertext &nbsp;—&nbsp; Full ciphertext as text/plain</span>
      </a>
      <div class="endpoint" style="cursor:default">
        <span class="method-post">POST</span>
        <span>/decrypt &nbsp;—&nbsp; Decrypt with your key &nbsp;
          <code style="font-size:0.78em">body: {{"key": "YOURKEY"}}</code>
        </span>
      </div>
    </div>

    <div class="card">
      <h2>🛠️ Attack Path</h2>
      <ul class="steps-list">
        <li data-n="1.">
          Download the ciphertext and strip all non-alpha characters for analysis
        </li>
        <li data-n="2.">
          <strong>Kasiski test</strong>: search for repeated trigrams; the GCD of their
          spacing distances estimates the key length
        </li>
        <li data-n="3.">
          <strong>Index of Coincidence</strong>: split ciphertext into <em>n</em> streams
          (one per key position); the correct <em>n</em> will show IoC ≈ 0.065 (English)
        </li>
        <li data-n="4.">
          <strong>Frequency analysis</strong>: for each column, find the shift that aligns
          the column's letter distribution with English (E=~13%, T=~9%, A=~8%…)
        </li>
        <li data-n="5.">
          Test your key with <code>POST /decrypt</code> — the correct key reveals readable English
          with the flag embedded in the plaintext
        </li>
      </ul>
      <pre># Minimal Kasiski + IoC starter in Python
from collections import Counter
import requests

ct = requests.get("http://localhost/ciphertext").text
letters = [c for c in ct if c.isalpha()]

# IoC for guessed key length n
def ioc(text):
    n = len(text)
    if n < 2: return 0
    freq = Counter(text)
    return sum(f*(f-1) for f in freq.values()) / (n*(n-1))

for n in range(2, 15):
    streams = [''.join(letters[i::n]) for i in range(n)]
    avg_ioc = sum(ioc(s) for s in streams) / n
    print(f"key_len={{n:2d}}  IoC={{avg_ioc:.4f}}")</pre>
      <div class="hint">
        💡 Online tool: <strong>dcode.fr/vigenere-cipher</strong> has a built-in key finder.
        CyberChef also supports Vigenère with automatic key detection.
      </div>
    </div>
  </div>
</body>
</html>"""


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return build_index()


@app.route("/ciphertext", methods=["GET"])
def get_ciphertext():
    """Return the raw ciphertext as text/plain — easy to pipe into scripts."""
    return Response(
        CIPHERTEXT,
        mimetype="text/plain",
        headers={"Content-Disposition": "inline; filename=cipher.txt"},
    )


@app.route("/decrypt", methods=["POST"])
def decrypt():
    """
    Decrypt the ciphertext with the provided key.
    Always returns the result — the player must verify it reads as English.
    """
    data = request.get_json(silent=True) or {}
    key = str(data.get("key", "")).strip()

    if not key:
        return jsonify({"error": "missing 'key' in request body"}), 400
    if not key.replace(" ", "").isalpha():
        return jsonify({"error": "key must contain only alphabetic characters"}), 400
    if len(key) > 64:
        return jsonify({"error": "key too long (max 64 chars)"}), 400

    decrypted = vigenere_decrypt(CIPHERTEXT, key)
    return jsonify({"key_used": key.upper(), "decrypted": decrypted})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=False)
