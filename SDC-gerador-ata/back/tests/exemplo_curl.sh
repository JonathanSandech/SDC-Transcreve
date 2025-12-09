#!/bin/bash
# Script de exemplo para testar a API usando curl
# SDC-Ata-Generator

# URL da API (ajuste se necessário)
API_URL="http://localhost:5000"

echo "=========================================="
echo "Testes da API - SDC-Ata-Generator"
echo "=========================================="

# Teste 1: Health Check
echo ""
echo "Teste 1: Health Check"
echo "GET $API_URL/api/health"
curl -X GET "$API_URL/api/health" \
  -H "Content-Type: application/json" \
  | json_pp

# Teste 2: Gerar Ata
echo ""
echo ""
echo "Teste 2: Gerar Ata"
echo "POST $API_URL/api/gerar-ata"
curl -X POST "$API_URL/api/gerar-ata" \
  -H "Content-Type: application/json" \
  -d @exemplo_requisicao.json \
  | json_pp

# Teste 3: Download de Arquivo (ajuste o nome do arquivo conforme resposta do Teste 2)
echo ""
echo ""
echo "Teste 3: Download de Arquivo"
echo "Para fazer download, use:"
echo "curl -X GET \"$API_URL/api/download/NOME_DO_ARQUIVO.docx\" -O"

echo ""
echo "=========================================="
echo "Testes concluídos!"
echo "=========================================="
