"""
challenges/crypto-vigenere/setup_vigenere.py

Generates the Vigenère challenge at Docker build time:
  - Constructs a long English plaintext (~2100 uppercase letters) with the
    FLAG embedded in the middle.
  - Encrypts it using a fixed Vigenère key: BEACON (6 chars).
  - Saves only the ciphertext to challenge.json — the key is NOT stored.

The key BEACON is recoverable via:
  1. Kasiski examination  → key length ≈ 6
  2. Index of Coincidence → confirms key length
  3. Frequency analysis   → one [A-Z] slice per key position → each shift letter

NOTE: Only [A-Z] uppercase characters are encrypted.
      Spaces, digits, {, }, and other punctuation pass through unchanged.
      The flag MUST be uppercase hex (FLAG_CRYPTO_VIGENERE from generate_flags.sh).
"""
import os
import json

FLAG = os.environ.get("FLAG", "CTF{REPLACE_ME_WITH_UPPERCASE_HEX_FLAG}")

# ── Vigenère key (fixed, baked into ciphertext, NOT stored after setup) ───────
KEY = "BEACON"  # 6 chars — discoverable via Kasiski + frequency analysis

# ── Plaintext ─────────────────────────────────────────────────────────────────
# Two-part spy message:
#   Preamble  — explains the cipher's "strength" (ironic context clues)
#   Core msg  — operation briefing with the FLAG embedded
# Total uppercase letter count: ~2100 → ~350 samples per key position (robust)
PLAINTEXT = (
    "CLASSIFIED INTERCEPT REPORT BEGINS THE FOLLOWING MESSAGE WAS CAPTURED FROM "
    "HOSTILE RADIO TRANSMISSIONS AND FORWARDED TO HEADQUARTERS FOR CRYPTANALYSIS "
    "OUR TEAM HAS CONFIRMED THAT THE ADVERSARY IS USING A CLASSICAL POLYALPHABETIC "
    "SUBSTITUTION CIPHER WHICH THEY BELIEVE TO BE ABSOLUTELY UNBREAKABLE HOWEVER AS "
    "ANY TRAINED CRYPTANALYST KNOWS THE SECURITY OF A POLYALPHABETIC CIPHER IS ENTIRELY "
    "DEPENDENT ON BOTH THE SECRECY AND THE LENGTH OF THE KEYWORD WHEN THE SAME SHORT KEY "
    "IS REUSED ACROSS A SUFFICIENTLY LONG MESSAGE THE PERIODIC REPETITION CREATES "
    "EXPLOITABLE STATISTICAL REGULARITIES THE KASISKI EXAMINATION SEARCHES FOR REPEATED "
    "TRIGRAMS IN THE CIPHERTEXT WHOSE SPACING IS A MULTIPLE OF THE KEY LENGTH AFTER THE "
    "KEY LENGTH IS ESTIMATED THE INDEX OF COINCIDENCE CAN CONFIRM IT AND STANDARD LETTER "
    "FREQUENCY ANALYSIS APPLIED INDEPENDENTLY TO EACH COLUMN OF THE CIPHERTEXT RECOVERS "
    "EVERY CHARACTER OF THE KEY ONE POSITION AT A TIME THE ENGLISH LETTER DISTRIBUTION "
    "IS HIGHLY DISTINCTIVE WITH E APPEARING ROUGHLY THIRTEEN PERCENT OF THE TIME "
    "FOLLOWED BY T A O I N S H R AND D THE INTERCEPTED ENEMY TRANSMISSION FOLLOWS "
    "ATTENTION AGENT THIS MESSAGE IS ENCRYPTED FOR YOUR PROTECTION THE INTELLIGENCE "
    "YOU ARE ABOUT TO RECEIVE IS CLASSIFIED AT THE HIGHEST POSSIBLE LEVEL OPERATION "
    "NIGHTFALL HAS ENTERED ITS FINAL CRITICAL PHASE ALL FIELD ASSETS HAVE CONFIRMED "
    "THAT THE PRIMARY TARGET IS RELOCATING TO THE SECONDARY SAFE HOUSE NEAR THE "
    "NORTHERN BORDER THE MAIN EXTRACTION POINT HAS BEEN COMPROMISED AND A NEW "
    "RENDEZVOUS MUST BE ESTABLISHED IN THE EASTERN DISTRICT YOUR HANDLER WILL CONTACT "
    "YOU AT THE USUAL SHORTWAVE FREQUENCY BEFORE MIDNIGHT THE PACKAGE CONTAINS "
    "DOCUMENTS RELATING TO PROJECT SUNSTONE WHICH MUST NEVER FALL INTO ENEMY HANDS "
    "UNDER ANY CIRCUMSTANCES THE FOLLOWING INFORMATION IS KNOWN ONLY TO THE INNER "
    f"CIRCLE YOUR SECRET ACCESS CODE IS {FLAG} COMMIT IT TO MEMORY AND DESTROY ALL "
    "COPIES THE NEXT SCHEDULED DEAD DROP WILL OCCUR AT THE STANDARD LOCATION BEFORE "
    "DAWN PLEASE ACKNOWLEDGE RECEIPT OF THIS TRANSMISSION BY RETURNING THE STANDARD "
    "CONFIRMATION SEQUENCE ALL FURTHER COMMUNICATION WILL CEASE UNTIL YOUR POSITION "
    "IS VERIFIED AS SECURE THE OVERALL OPERATION REMAINS ON SCHEDULE DESPITE RECENT "
    "COMPLICATIONS IN THE FIELD ALL PERSONNEL HAVE RECEIVED THE UPDATED BRIEFING AND "
    "ARE AWAITING YOUR FINAL AUTHORIZATION FROM COMMAND REMEMBER THAT EVERY CHANNEL "
    "MUST BE TREATED AS POTENTIALLY COMPROMISED AND MAXIMUM OPERATIONAL SECURITY IS "
    "MANDATORY AT ALL TIMES THE FATE OF THIS ENTIRE MISSION DEPENDS ON YOUR DISCRETION "
    "TRUST ONLY VERIFIED MEMBERS OF THE COMMAND CHAIN AND FOLLOW ALL PROTOCOLS "
    "GOOD LUCK AGENT END OF TRANSMISSION"
)


# ── Encryption ────────────────────────────────────────────────────────────────
def vigenere_encrypt(plaintext: str, key: str) -> str:
    """Standard Vigenère — encrypts [A-Z] only, all other chars pass through."""
    key = key.upper()
    result = []
    ki = 0
    for ch in plaintext:
        if "A" <= ch <= "Z":
            shift = ord(key[ki % len(key)]) - ord("A")
            result.append(chr((ord(ch) - ord("A") + shift) % 26 + ord("A")))
            ki += 1
        else:
            result.append(ch)
    return "".join(result)


ciphertext = vigenere_encrypt(PLAINTEXT, KEY)

# Sanity metrics
letter_count = sum(1 for c in PLAINTEXT if "A" <= c <= "Z")
print(f"[*] Key:                 {KEY}  (length {len(KEY)})")
print(f"[*] Plaintext letters:   {letter_count}")
print(f"[*] Samples / position:  ~{letter_count // len(KEY)}  (≥200 recommended for freq analysis)")
print(f"[*] Ciphertext starts:   {ciphertext[:48]}...")

# Save ONLY the ciphertext — the key is never written to disk
with open("challenge.json", "w") as f:
    json.dump({"ciphertext": ciphertext}, f)

print(f"[+] challenge.json written (key NOT stored)")
