# Stage 1: build React
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine

# Remove o default.conf da imagem base
RUN rm /etc/nginx/conf.d/default.conf

# Copia o build do frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copia SUA config do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
