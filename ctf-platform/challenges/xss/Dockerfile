FROM node:20-slim

# Chromium + libs necesarias para Puppeteer headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Instalar dependencias primero (aprovechar cache de capas)
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Flag entra en build-time vía ARG, persiste en ENV para que el bot la lea en runtime
ARG FLAG
ENV FLAG=${FLAG}

# node:20-slim ya incluye el usuario 'node' (UID 1000) — reutilizarlo
RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "server.js"]
