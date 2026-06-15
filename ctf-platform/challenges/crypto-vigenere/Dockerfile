FROM python:3.11-slim
WORKDIR /app

# FLAG enters only at build-time
ARG FLAG
ENV FLAG=${FLAG}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Generate the Vigenère ciphertext at build time and discard the setup script.
# challenge.json will contain ONLY the ciphertext — the key is baked into it
# but never written to disk.
RUN python setup_vigenere.py && rm setup_vigenere.py

# Non-root user at runtime
RUN useradd -m -u 1000 ctf && chown -R ctf:ctf /app
USER ctf

EXPOSE 5002

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5002/health')" || exit 1

CMD ["python", "app.py"]
