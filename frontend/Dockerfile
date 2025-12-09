# ============================================
# Multi-stage build para Frontend
# ============================================

# Estágio 1: Build da aplicação
FROM node:20-slim AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY . .

# Build da aplicação (Vite)
RUN npm run build

# ============================================
# Estágio 2: Servir com Nginx
# ============================================
FROM nginx:alpine

# Copiar build do estágio anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Nginx roda como daemon off por padrão no container
CMD ["nginx", "-g", "daemon off;"]
