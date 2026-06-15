"""
challenges/crypto-rsa/setup_crypto.py

Generates an RSA challenge with a SMALL PUBLIC EXPONENT vulnerability.

THE VULNERABILITY: e = 3 (Hastad's broadcast attack / small exponent attack).
  - n is 1024-bit (cannot be factored, but that's not the attack).
  - The flag is ~30 bytes → m^3 is ~720 bits << n (1024 bits).
  - Therefore: c = m^3  (NO modular reduction occurs).
  - The player recovers m by computing the INTEGER cube root of c:
      m = iroot(c, 3)  → bytes.fromhex(hex(m)[2:]).decode()

Tools: Python gmpy2, sympy.integer_nthroot, or Newton's integer cube root.
"""
import os
import json
import base64
from Crypto.PublicKey import RSA
from Crypto.PublicKey.RSA import construct

FLAG = os.environ.get("FLAG", "CTF{default_flag_replace_me_in_env}")

E = 3  # ← THE VULNERABILITY: small public exponent

print("[*] Generating 1024-bit RSA key with e=3 (small exponent attack)...")

# Generate strong key pair, then rebuild with e=3
_strong = RSA.generate(1024)
n = _strong.n

# Pick random p, q with p ≡ 2 (mod 3) and q ≡ 2 (mod 3) so gcd(e, φ(n)) = 1
# Simplest: just keep trying with generate() until we get a valid φ(n)
import random
from Crypto.Util.number import getPrime, inverse

while True:
    p = getPrime(512)
    q = getPrime(512)
    n = p * q
    phi = (p - 1) * (q - 1)
    if phi % E != 0:  # gcd(e, phi) must be 1 for e to be a valid exponent
        break

# Build the RSA public key manually with e=3
pub_key = construct((n, E))

# Encrypt (raw textbook RSA — NO padding, because padding defeats the attack)
# m^3 < n because flag is ~30 bytes = 240 bits, m^3 = 720 bits < 1024 bits
m = int.from_bytes(FLAG.encode(), "big")
m3 = pow(m, E)  # ← integer cube, NOT modular (m^e < n)

assert m3 < n, (
    f"Flag too long: m^3 = {m3.bit_length()} bits >= n = {n.bit_length()} bits. "
    "Shorten the flag or increase key size."
)
assert pow(m3, 1, n) == m3, "Sanity: no reduction"

# Verify decryption: integer cube root of m3 should equal m
# (we use a Newton-style iroot here just to validate)
def iroot(n, k):
    """Integer k-th root via binary search (float-precision safe for large integers)."""
    if n == 0:
        return 0
    lo, hi = 0, min(n, 1 << (n.bit_length() // k + 2))
    while lo < hi:
        mid = (lo + hi + 1) >> 1
        if pow(mid, k) <= n:
            lo = mid
        else:
            hi = mid - 1
    return lo

recovered_m = iroot(m3, E)
assert recovered_m == m, "Self-test failed: cube root does not recover m"
print(f"[*] Self-test passed: iroot(m^3, 3) == m ✓")

# Serialize public key as PEM
pub_pem = pub_key.export_key("PEM").decode()

# Save challenge data (ciphertext = m^3, stored as big-endian hex)
challenge_data = {
    "public_key_pem": pub_pem,
    "n": str(n),
    "e": E,
    "ciphertext_hex": hex(m3),   # c = m^3 (no modular reduction)
    "key_bits": n.bit_length(),
    "note": (
        "Textbook RSA with e=3. The flag is short enough that m^e < n "
        "(no modular reduction). Recover m via integer cube root of c."
    ),
}

with open("challenge.json", "w") as f:
    json.dump(challenge_data, f, indent=2)

print(f"[*] n bits:      {n.bit_length()}")
print(f"[*] e:           {E}  ← small exponent vulnerability")
print(f"[*] m bits:      {m.bit_length()}")
print(f"[*] m^3 bits:    {m3.bit_length()}  (< n bits → no modular reduction)")
print(f"[+] challenge.json written. Flag NOT recoverable without integer cube root.")
