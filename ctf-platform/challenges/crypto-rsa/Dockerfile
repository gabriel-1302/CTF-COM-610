FROM python:3.11-slim
WORKDIR /app

# FLAG enters only at build-time — never baked as ENV in final image
ARG FLAG
ENV FLAG=${FLAG}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Generate the RSA challenge material and discard the setup script
# The private key is generated in setup_crypto.py but never written to disk.
RUN python setup_crypto.py && rm setup_crypto.py

# Non-root user at runtime — reduce escape surface
RUN useradd -m -u 1000 ctf && chown -R ctf:ctf /app
USER ctf

EXPOSE 5001

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')" || exit 1

CMD ["python", "app.py"]
