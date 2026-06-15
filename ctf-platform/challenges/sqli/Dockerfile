FROM python:3.11-slim
WORKDIR /app

# FLAG entra solo en build-time
ARG FLAG
ENV FLAG=${FLAG}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Inicializar la DB con la flag y borrar el script de setup
RUN python db_setup.py && rm db_setup.py

# Usuario no-root en runtime — reduce superficie de escape
RUN useradd -m -u 1000 ctf && chown -R ctf:ctf /app
USER ctf

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["python", "app.py"]
