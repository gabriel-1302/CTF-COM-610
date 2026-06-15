FROM python:3.11-slim
WORKDIR /app

ARG FLAG
RUN echo "${FLAG}" > /flag.txt && chmod 444 /flag.txt

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN useradd -m -u 1000 ctf && chown -R ctf:ctf /app
USER ctf

EXPOSE 5003

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5003/health')" || exit 1

CMD ["sh", "-c", "while true; do python app.py; sleep 1; done"]
