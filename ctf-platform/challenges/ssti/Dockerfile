FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Flag escrita en /flag.txt en build-time
ARG FLAG
RUN echo "${FLAG}" > /flag.txt && chmod 644 /flag.txt

# Usuario no-root — puede leer /flag.txt porque chmod 644
RUN useradd -m -u 1000 ctf && chown -R ctf:ctf /app
USER ctf

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["python", "app.py"]
