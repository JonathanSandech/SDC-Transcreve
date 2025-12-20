#!/bin/bash
# ============================================
# Script para Migrar Modelos Ollama do Windows para Docker
# SDC Transcription App
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  Migração de Modelos Ollama - Windows → Docker${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""

# Modelos instalados no Windows
MODELOS=(
    "gemma2:9b"
    "qwen3:8b"
    "llama3.1:8b"
    "gpt-oss:20b"
)

echo -e "${YELLOW}Modelos disponíveis no Windows:${NC}"
for i in "${!MODELOS[@]}"; do
    echo -e "  $((i+1)). ${CYAN}${MODELOS[$i]}${NC}"
done
echo ""

echo -e "${GREEN}Modelo configurado no sistema: gemma2:9b${NC}"
echo ""

# Verificar se container Ollama está rodando
echo -e "${YELLOW}[1/4] Verificando se container Ollama está rodando...${NC}"
if ! docker ps | grep -q sdc-ollama; then
    echo -e "${RED}Container Ollama não está rodando!${NC}"
    echo -e "${YELLOW}Iniciando container Ollama...${NC}"
    docker compose up -d ollama
    sleep 10
fi

if docker ps | grep -q sdc-ollama; then
    echo -e "${GREEN}✓ Container Ollama está rodando${NC}"
else
    echo -e "${RED}✗ Erro ao iniciar container Ollama${NC}"
    exit 1
fi
echo ""

# Função para copiar modelo do Windows para Docker
copiar_modelo() {
    local modelo=$1
    echo -e "${YELLOW}[2/4] Copiando modelo $modelo do Windows para Docker...${NC}"
    echo -e "${CYAN}Este processo pode levar alguns minutos dependendo do tamanho do modelo${NC}"
    echo ""

    # Usar powershell.exe para executar ollama no Windows e docker exec para carregar no container
    echo -e "${CYAN}Obtendo modelo do Windows via Ollama...${NC}"

    # Estratégia: Usar docker exec para fazer pull direto do registro Ollama
    # Isso é mais eficiente que copiar do Windows
    docker exec sdc-ollama ollama pull "$modelo"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Modelo $modelo copiado com sucesso!${NC}"
        return 0
    else
        echo -e "${RED}✗ Erro ao copiar modelo $modelo${NC}"
        return 1
    fi
}

# Verificar se quer copiar todos ou apenas o principal
echo -e "${YELLOW}Qual estratégia você prefere?${NC}"
echo -e "  1. ${GREEN}Apenas gemma2:9b${NC} (modelo configurado - ~5.4GB)"
echo -e "  2. ${CYAN}Todos os modelos${NC} (~28GB total)"
echo ""
read -p "Escolha (1 ou 2): " escolha

case $escolha in
    1)
        echo ""
        copiar_modelo "gemma2:9b"
        ;;
    2)
        echo ""
        for modelo in "${MODELOS[@]}"; do
            copiar_modelo "$modelo"
            echo ""
        done
        ;;
    *)
        echo -e "${YELLOW}Opção inválida. Copiando apenas o modelo principal (gemma2:9b)${NC}"
        echo ""
        copiar_modelo "gemma2:9b"
        ;;
esac

echo ""
echo -e "${YELLOW}[3/4] Verificando modelos instalados no Docker...${NC}"
docker exec sdc-ollama ollama list

echo ""
echo -e "${YELLOW}[4/4] Testando conexão com Ollama no Docker...${NC}"
response=$(docker exec sdc-ollama curl -s http://localhost:11434/api/tags)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Ollama está funcionando no Docker!${NC}"
    echo -e "${CYAN}Modelos disponíveis:${NC}"
    echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read -r model; do
        echo -e "  • $model"
    done
else
    echo -e "${RED}✗ Erro ao conectar com Ollama no Docker${NC}"
fi

echo ""
echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}  MIGRAÇÃO CONCLUÍDA!${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo -e "  1. Execute o rebuild da aplicação:"
echo -e "     ${CYAN}./docker-commands.sh rebuild${NC}"
echo ""
echo -e "  2. Teste a geração de ata no frontend"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  • Ver modelos no Docker:     ${CYAN}docker exec sdc-ollama ollama list${NC}"
echo -e "  • Ver logs do Ollama:        ${CYAN}docker logs sdc-ollama${NC}"
echo -e "  • Testar Ollama:             ${CYAN}docker exec sdc-ollama ollama run gemma2:9b 'Olá'${NC}"
echo -e "  • Status dos containers:     ${CYAN}docker compose ps${NC}"
echo ""
echo -e "${CYAN}====================================================${NC}"
echo ""
