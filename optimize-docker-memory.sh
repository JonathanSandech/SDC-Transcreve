#!/bin/bash
# ============================================
# Script para Otimizar Limites de Memória do Docker
# SDC Transcription App
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  Otimização de Memória - Docker Compose${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""

# Verificar se docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Erro: docker-compose.yml não encontrado!${NC}"
    echo -e "${YELLOW}Execute este script no diretório do projeto${NC}"
    exit 1
fi

# Verificar limite atual
echo -e "${YELLOW}[1/5] Verificando configuração atual...${NC}"
current_limit=$(grep -A 3 "resources:" docker-compose.yml | grep "memory:" | awk '{print $2}')
echo -e "Limite atual de memória do backend: ${CYAN}$current_limit${NC}"
echo ""

# Sugerir novo limite
echo -e "${YELLOW}[2/5] Recomendação de limite:${NC}"
echo ""
echo -e "Para máquina com 16GB RAM total:"
echo -e "  • ${GREEN}6GB${NC} - Recomendado (equilibrado)"
echo -e "  • ${GREEN}8GB${NC} - Conservador (se precisar de mais margem)"
echo -e "  • ${GREEN}4GB${NC} - Agressivo (economia máxima)"
echo ""
echo -e "${CYAN}Por quê reduzir de 12GB?${NC}"
echo -e "  • Transcrição usa GPU (VRAM), não RAM"
echo -e "  • Whisper carrega modelo na VRAM"
echo -e "  • 6GB é suficiente para operação normal"
echo ""

# Perguntar novo limite
read -p "Digite o novo limite em GB (Enter para 6GB): " new_limit
if [ -z "$new_limit" ]; then
    new_limit=6
fi

# Validar entrada
if ! [[ "$new_limit" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Valor inválido. Usando 6GB${NC}"
    new_limit=6
fi

echo ""
echo -e "${YELLOW}[3/5] Criando backup...${NC}"
backup_file="docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)"
cp docker-compose.yml "$backup_file"
echo -e "${GREEN}Backup criado: $backup_file${NC}"
echo ""

# Aplicar mudança
echo -e "${YELLOW}[4/5] Aplicando novo limite: ${new_limit}GB${NC}"
sed -i "s/memory: [0-9]\+G/memory: ${new_limit}G/" docker-compose.yml

# Verificar se mudou
new_limit_check=$(grep -A 3 "resources:" docker-compose.yml | grep "memory:" | awk '{print $2}')
if [ "$new_limit_check" == "${new_limit}G" ]; then
    echo -e "${GREEN}Limite atualizado com sucesso!${NC}"
else
    echo -e "${RED}Erro ao atualizar limite${NC}"
    echo -e "${YELLOW}Restaurando backup...${NC}"
    cp "$backup_file" docker-compose.yml
    exit 1
fi
echo ""

# Mostrar diff
echo -e "${YELLOW}[5/5] Mudanças aplicadas:${NC}"
echo -e "${RED}- memory: $current_limit${NC}"
echo -e "${GREEN}+ memory: ${new_limit}G${NC}"
echo ""

# Perguntar se quer rebuild
echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}  CONFIGURAÇÃO CONCLUÍDA!${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""
echo -e "${YELLOW}Para aplicar as mudanças, faça rebuild da aplicação:${NC}"
echo -e "  ${CYAN}./docker-commands.sh rebuild${NC}"
echo ""
read -p "Deseja fazer rebuild agora? (S/N): " rebuild
if [ "$rebuild" == "S" ] || [ "$rebuild" == "s" ]; then
    echo ""
    echo -e "${YELLOW}Fazendo rebuild...${NC}"
    ./docker-commands.sh rebuild

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}Rebuild concluído!${NC}"
        echo ""
        echo -e "${YELLOW}Verificando uso de recursos:${NC}"
        sleep 5
        docker stats --no-stream
    else
        echo -e "${RED}Erro no rebuild${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}Lembre-se de fazer rebuild quando estiver pronto:${NC}"
    echo -e "  ${CYAN}./docker-commands.sh rebuild${NC}"
fi

echo ""
echo -e "${CYAN}====================================================${NC}"
echo -e "${YELLOW}  RESUMO${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "Limite anterior:    ${current_limit}"
echo -e "Novo limite:        ${new_limit}G"
echo -e "Backup:             $backup_file"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  • Ver uso atual:     ${CYAN}docker stats${NC}"
echo -e "  • Restaurar backup:  ${CYAN}cp $backup_file docker-compose.yml${NC}"
echo -e "  • Rebuild:           ${CYAN}./docker-commands.sh rebuild${NC}"
echo ""
echo -e "${CYAN}====================================================${NC}"
echo ""
