#!/bin/bash
# ============================================
# Script para Configurar pgAdmin Automaticamente
# SDC Transcription App
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  Configuração do pgAdmin${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""

# Carregar variáveis do .env
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}Arquivo .env não encontrado!${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/5] Verificando containers...${NC}"

# Verificar se pgAdmin está rodando
if ! docker ps | grep -q sdc-pgadmin; then
    echo -e "${YELLOW}Container pgAdmin não está rodando. Iniciando...${NC}"
    docker compose up -d pgadmin
    echo -e "${CYAN}Aguardando pgAdmin inicializar (20s)...${NC}"
    sleep 20
fi

if docker ps | grep -q sdc-pgadmin; then
    echo -e "${GREEN}✓ pgAdmin está rodando${NC}"
else
    echo -e "${RED}✗ Erro ao iniciar pgAdmin${NC}"
    exit 1
fi

# Verificar se database está rodando
if ! docker ps | grep -q sdc-transcription-db; then
    echo -e "${RED}✗ Container do PostgreSQL não está rodando!${NC}"
    echo -e "${YELLOW}Execute: docker compose up -d database${NC}"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL está rodando${NC}"
echo ""

echo -e "${YELLOW}[2/5] Configurando servidor PostgreSQL no pgAdmin...${NC}"

# Criar arquivo JSON de configuração do servidor
SERVER_CONFIG=$(cat <<EOF
{
  "Servers": {
    "1": {
      "Name": "SDC Transcription DB",
      "Group": "Servers",
      "Host": "database",
      "Port": 5432,
      "MaintenanceDB": "postgres",
      "Username": "${DB_USER}",
      "SSLMode": "prefer",
      "PassFile": "/tmp/pgpassfile"
    }
  }
}
EOF
)

# Criar arquivo de senha
PASSFILE="${DB_USER}:${DB_PASSWORD}"

# Copiar configuração para o container
echo "$SERVER_CONFIG" | docker exec -i sdc-pgadmin bash -c 'cat > /tmp/servers.json'
echo "database:5432:*:${DB_USER}:${DB_PASSWORD}" | docker exec -i sdc-pgadmin bash -c 'cat > /tmp/pgpassfile && chmod 600 /tmp/pgpassfile'

# Importar configuração
docker exec sdc-pgadmin python /pgadmin4/setup.py --load-servers /tmp/servers.json --user "${PGADMIN_EMAIL}" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Servidor PostgreSQL configurado no pgAdmin${NC}"
else
    echo -e "${YELLOW}⚠ Servidor pode já estar configurado${NC}"
fi

echo ""
echo -e "${YELLOW}[3/5] Informações de acesso:${NC}"
echo -e "  ${CYAN}URL:${NC}      http://localhost:5050"
echo -e "  ${CYAN}Email:${NC}    ${PGADMIN_EMAIL}"
echo -e "  ${CYAN}Senha:${NC}    ${PGADMIN_PASSWORD}"
echo ""

echo -e "${YELLOW}[4/5] Dados do banco PostgreSQL:${NC}"
echo -e "  ${CYAN}Host:${NC}     database (interno) / localhost (externo)"
echo -e "  ${CYAN}Porta:${NC}    5432"
echo -e "  ${CYAN}Usuário:${NC}  ${DB_USER}"
echo -e "  ${CYAN}Senha:${NC}    ${DB_PASSWORD}"
echo -e "  ${CYAN}Banco:${NC}    ${DB_NAME}"
echo ""

echo -e "${YELLOW}[5/5] Testando conexão com o banco...${NC}"
docker exec sdc-transcription-db psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Conexão com PostgreSQL funcionando!${NC}"

    # Mostrar estatísticas do banco
    echo ""
    echo -e "${CYAN}Estatísticas do banco:${NC}"
    docker exec sdc-transcription-db psql -U "${DB_USER}" -d "${DB_NAME}" -c "
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " 2>/dev/null | head -20
else
    echo -e "${RED}✗ Erro ao conectar com PostgreSQL${NC}"
fi

echo ""
echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}  CONFIGURAÇÃO CONCLUÍDA!${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""
echo -e "${YELLOW}Como acessar:${NC}"
echo ""
echo -e "1. Abra o navegador em: ${CYAN}http://localhost:5050${NC}"
echo -e "2. Faça login com:"
echo -e "   Email: ${CYAN}${PGADMIN_EMAIL}${NC}"
echo -e "   Senha: ${CYAN}${PGADMIN_PASSWORD}${NC}"
echo ""
echo -e "3. O servidor '${GREEN}SDC Transcription DB${NC}' já está configurado!"
echo -e "   Clique nele na barra lateral esquerda"
echo ""
echo -e "4. Se pedir senha do banco, use: ${CYAN}${DB_PASSWORD}${NC}"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  • Abrir pgAdmin:           ${CYAN}xdg-open http://localhost:5050${NC}"
echo -e "  • Ver logs do pgAdmin:     ${CYAN}docker logs sdc-pgadmin${NC}"
echo -e "  • Reiniciar pgAdmin:       ${CYAN}docker compose restart pgadmin${NC}"
echo -e "  • Parar pgAdmin:           ${CYAN}docker compose stop pgadmin${NC}"
echo -e "  • Iniciar pgAdmin:         ${CYAN}docker compose start pgadmin${NC}"
echo ""
echo -e "${CYAN}====================================================${NC}"
echo ""
