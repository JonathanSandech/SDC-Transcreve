# ============================================
# Multi-stage build para Backend com Whisper oficial (AMD / ROCm)
# ============================================

# Estágio 1: Build do TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências de build (inclui devDependencies pro tsc)
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY . .

# Build do TypeScript
RUN npm run build

# ============================================
# Estágio 2: Runtime com PyTorch + ROCm (AMD GPU)
# ============================================
# Imagem base com PyTorch compilado para ROCm (AMD)
# Ideal: fixar uma tag específica compatível com a versão de ROCm do host.
FROM rocm/pytorch:latest

# Metadados
LABEL maintainer="jonathan.barbosa"
LABEL description="SDC Transcription Backend with Whisper (AMD ROCm GPU)"

# Evitar prompts interativos
ENV DEBIAN_FRONTEND=noninteractive

# Atualizar e instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Instalar Node.js 20 (runtime)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Criar usuário não-root (verificar se UID 1000 já existe)
RUN if id 1000 >/dev/null 2>&1; then \
        echo "UID 1000 already exists, using existing user"; \
        EXISTING_USER=$(id -un 1000); \
        EXISTING_GROUP=$(id -gn 1000); \
        echo "Existing user: $EXISTING_USER (group: $EXISTING_GROUP)"; \
        if [ "$EXISTING_USER" != "appuser" ]; then \
            usermod -l appuser $EXISTING_USER 2>/dev/null || true; \
            groupmod -n appuser $EXISTING_GROUP 2>/dev/null || true; \
        fi; \
    else \
        useradd -m -u 1000 appuser; \
    fi

# Diretório de trabalho
WORKDIR /app

# Criar diretórios necessários e ajustar permissões
RUN mkdir -p /app/uploads /app/logs \
    && chown -R 1000:1000 /app

# Copiar scripts Python da aplicação (como root para instalar dependências)
COPY python ./python

# Instalar dependências Python ANTES de trocar de usuário (ainda como root)
RUN pip install --upgrade pip \
    && pip install -r python/requirements.txt

# Copiar dependências Node.js e código compilado do builder
COPY --from=builder --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=builder --chown=1000:1000 /app/dist ./dist

# Ajustar permissões do diretório python depois de copiar
RUN chown -R 1000:1000 /app/python

# Trocar para usuário não-root (usar UID numérico para garantir compatibilidade)
USER 1000

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=8000 \
    PYTHON_PATH=python3 \
    PATH="$PATH:/home/appuser/.local/bin"

# Expor porta do backend
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando de inicialização do backend Node
CMD ["node", "dist/server.js"]
