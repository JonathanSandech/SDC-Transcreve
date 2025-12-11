# Plan.md — Migração do Backend para Whisper Oficial com GPU AMD (ROCm) em Docker

## 0. Objetivo

Deixar o sistema de transcrição rodando em um servidor Linux com:

- Backend Node + Python rodando em **Docker**
- Banco PostgreSQL em container
- **Whisper oficial (OpenAI)** para transcrição
- Acelerado em GPU **AMD** via **ROCm + PyTorch ROCm**
- Sem dependências de CUDA/NVIDIA

---

## 1. Estrutura do projeto (referência)

Diretório do projeto na VM:

```bash
/devin/jht/SDC-Transcreve
Estrutura relevante:

text
Copiar código
SDC-Transcreve/
  backend/
    Dockerfile
    package.json
    package-lock.json
    dist/         # gerado pelo build
    src/          # código TypeScript original
    python/
      requirements.txt
      transcribe.py   # script Python usado pelo backend
  frontend/
    Dockerfile
    ...
  docker-compose.yml
  .env
2. Arquivos que precisam ser alterados
2.1 backend/python/requirements.txt
Objetivo:
Remover dependências CUDA/torch genéricas e usar apenas:

openai-whisper (Whisper oficial)

moviepy e numpy

Novo conteúdo sugerido:

txt
Copiar código
# Dependências para transcrição de áudio/vídeo
# Usando Whisper oficial (OpenAI) com PyTorch/ROCm

# Processamento de vídeo/áudio
moviepy>=1.0.3

# Whisper oficial
openai-whisper>=20231117

# Dependências auxiliares
numpy>=1.24.0
Importante:
Não incluir torch nem torchaudio aqui.
O PyTorch com ROCm virá da imagem base rocm/pytorch.

2.2 backend/Dockerfile
Objetivo:

Manter build de TypeScript no estágio 1 (Node 20).

No estágio 2, usar imagem base com PyTorch + ROCm.

Instalar Node 20, ffmpeg e dependências Python.

Rodar Whisper oficial dentro desse container.

Novo conteúdo completo:

dockerfile
Copiar código
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

# Criar usuário não-root
RUN useradd -m -u 1000 appuser

# Diretório de trabalho
WORKDIR /app

# Criar diretórios necessários e ajustar permissões
RUN mkdir -p /app/uploads /app/logs \
    && chown -R appuser:appuser /app

# Copiar dependências Node.js e código compilado do builder
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Copiar scripts Python da aplicação
COPY --chown=appuser:appuser python ./python

# Trocar para usuário não-root
USER appuser

# Instalar dependências Python (Whisper, moviepy, numpy...)
RUN pip install --upgrade pip \
    && pip install -r python/requirements.txt

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
2.3 docker-compose.yml — Serviço backend
Objetivo:

Apontar build do backend para o novo Dockerfile.

Expor backend na porta 8000.

Configurar o acesso ao banco via DATABASE_URL.

Expor dispositivos da GPU AMD para o container.

Adicionar permissões de grupos (video, render).

Trecho sugerido para o serviço backend no docker-compose.yml:

yaml
Copiar código
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: sdc-transcription-backend
    restart: unless-stopped
    environment:
      # Database
      DATABASE_URL: postgresql://${DB_USER:-transcription_user}:${DB_PASSWORD}@database:5432/${DB_NAME:-transcription_db}

      # Server
      PORT: 8000
      NODE_ENV: production
      SERVER_TIMEOUT: 3600000

      # Python
      PYTHON_PATH: python3

      # File Upload
      UPLOAD_DIR: /app/uploads
      MAX_FILE_SIZE: 2147483648

      # CORS
      CORS_ORIGIN: "*"

      # FFmpeg
      FFMPEG_PATH: ffmpeg
      FFPROBE_PATH: ffprobe

    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
    ports:
      - "8000:8000"
    networks:
      - sdc-network
    depends_on:
      database:
        condition: service_healthy

    # >>> GPU AMD (ROCm) <<<
    devices:
      - "/dev/kfd:/dev/kfd"
      - "/dev/dri:/dev/dri"
    group_add:
      - video
      - render
    security_opt:
      - seccomp=unconfined

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
O restante do docker-compose.yml (serviço database, frontend, volumes, networks) pode ficar como já está.

2.4 .env na raiz do projeto
Objetivo:
Configurar credenciais do banco e URL da API para o frontend.

Conteúdo base sugerido:

env
Copiar código
DB_USER=transcription_user
DB_PASSWORD=sua_senha_forte_aqui
DB_NAME=transcription_db

# URL pública do backend (dentro da rede corporativa)
VITE_API_URL=http://192.168.1.70:8000
2.5 backend/python/transcribe.py (ajuste conceitual)
Objetivo:
Trocar uso de faster-whisper por Whisper oficial.

Pseudo-implementação com Whisper oficial:

python
Copiar código
import torch
import whisper
from typing import Optional

# Carrega modelo uma vez (pode ser melhorado com cache global)
_model = None

def get_model(model_name: str = "medium"):
    global _model
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = whisper.load_model(model_name, device=device)
    return _model

def transcribe_file(audio_path: str, language: Optional[str] = None) -> str:
    model = get_model()
    result = model.transcribe(
        audio_path,
        language=language,
        fp16=torch.cuda.is_available()
    )
    return result["text"]
Importante:

O backend Node deve continuar chamando este script via python3 (usando PYTHON_PATH=python3 definido no compose).

A assinatura de funções deve seguir o que o backend já espera (nomes de parâmetros, formato de retorno).

Se o script atual tiver uma interface específica (por exemplo, ler argumentos da CLI), adaptar o código acima para manter essa compatibilidade.

3. Passo a passo para aplicar as alterações
Editar backend/python/requirements.txt

Substituir conteúdo pelo definido na seção 2.1.

Editar backend/Dockerfile

Substituir conteúdo atual pelo definido na seção 2.2.

Editar o serviço backend em docker-compose.yml

Atualizar o bloco do backend conforme seção 2.3.

Conferir .env

Garantir que DB_USER, DB_PASSWORD, DB_NAME e VITE_API_URL estejam configurados.

(Opcional) Ajustar backend/python/transcribe.py

Adaptar para usar Whisper oficial, conforme seção 2.5.

4. Comandos para subir o ambiente no Linux
No servidor:

bash
Copiar código
cd /devin/jht/SDC-Transcreve

# 1) Garantir que não há containers antigos rodando
docker compose down

# 2) Buildar o backend com o novo Dockerfile (ROCm + Whisper oficial)
docker compose build backend

# 3) Subir toda a stack (database, backend, frontend)
docker compose up -d

# 4) Verificar status dos serviços
docker compose ps

# 5) Acompanhar logs do backend
docker compose logs -f backend
Se tudo estiver ok, o backend deve:

conectar no banco,

expor /health na porta 8000,

e o frontend deve acessar o backend em http://192.168.1.70:8000 (via VITE_API_URL).

5. Teste de GPU AMD dentro do container
Para confirmar se o PyTorch (dentro do container) está enxergando a GPU AMD via ROCm:

bash
Copiar código
docker exec -it sdc-transcription-backend bash

python3 - << 'EOF'
import torch
print("cuda.is_available():", torch.cuda.is_available())
print("device_count:", torch.cuda.device_count())
if torch.cuda.is_available():
    print("device 0:", torch.cuda.get_device_name(0))
EOF
Resultados esperados:

cuda.is_available(): True

device_count: >= 1

Nome da GPU AMD em get_device_name(0) (algo como “Radeon ...”).

Se vier False, checar:

se ROCm está OK no host (rocminfo / clinfo).

se /dev/kfd e /dev/dri existem no host.

se as entradas devices: e group_add: no docker-compose.yml estão corretas.

6. Próximos passos (opcional)
Otimizar tamanho de imagem (fixar tag específica de rocm/pytorch).

Implementar cache de modelo Whisper em transcribe.py para não recarregar a cada chamada.

Configurar firewall (UFW) para expor apenas portas 80/8000 dentro da rede corporativa.

Monitorar uso de GPU e CPU para dimensionar melhor a infra.

makefile
Copiar código

::contentReference[oaicite:0]{index=0}
