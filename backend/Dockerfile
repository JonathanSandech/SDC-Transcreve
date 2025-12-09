# ============================================
# Multi-stage build para Backend com GPU
# ============================================

# Estágio 1: Build do TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências de build
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY . .

# Build do TypeScript
RUN npm run build

# ============================================
# Estágio 2: Runtime com CUDA + cuDNN
# ============================================
FROM nvidia/cuda:12.0.0-cudnn8-runtime-ubuntu22.04

# Metadados
LABEL maintainer="jonathan.barbosa"
LABEL description="SDC Transcription Backend with GPU support"

# Evitar prompts interativos
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Instalar Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Criar usuário não-root
RUN useradd -m -u 1000 appuser

# Configurar diretório de trabalho
WORKDIR /app

# ======= CRIAR DIRETÓRIOS COMO ROOT =======
RUN mkdir -p /app/uploads /app/logs

# Copiar arquivos de dependências Node.js do builder
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules

# Copiar código compilado do builder
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Copiar scripts Python e requirements
COPY --chown=appuser:appuser python ./python

# Criar e configurar ambiente virtual Python
RUN python3 -m venv /app/venv \
    && chown -R appuser:appuser /app/venv /app/uploads /app/logs

# ======= TROCAR PARA USUÁRIO NÃO-ROOT =======
USER appuser

# Instalar dependências Python dentro do VENV
RUN /app/venv/bin/pip install --upgrade pip \
    && /app/venv/bin/pip install -r python/requirements.txt

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=8000 \
    PYTHON_PATH=/app/venv/bin/python3 \
    PATH="/app/venv/bin:$PATH"

# Expor porta
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando de inicialização
CMD ["node", "dist/server.js"]

