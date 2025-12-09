"""
Script de teste para gerar_ata.py
"""
import json

# Dados de teste
test_data = {
    "participantes": "João Silva, Maria Santos",
    "dataHora": "2025-11-25T14:00:00",
    "local": "Sala de Reuniões 3º Andar",
    "convocadoPor": "Eduardo Asth",
    "transcricao": "Reunião iniciada às 14h00. Foram discutidos os seguintes pontos: 1. Aprovação do orçamento para o projeto X. 2. Definição de prazos. 3. Distribuição de tarefas entre a equipe. Como próximos passos, ficou definido que João irá elaborar o cronograma detalhado até sexta-feira."
}

print(json.dumps(test_data, ensure_ascii=False))
