FROM python:3.11-slim
ARG FLAG=CTF{test_lfi_flag}
ENV FLAG=$FLAG PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN adduser --disabled-password --gecos '' ctf && chown -R ctf:ctf /app
USER ctf
EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')"
CMD ["python", "app.py"]
