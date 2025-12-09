# Guia de Instalação - SDC-Ata-Generator

## Instalação Rápida

### 1. Pré-requisitos
- Python 3.12 ou superior
- pip (gerenciador de pacotes Python)

### 2. Instalação das Dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar Template

O sistema precisa de um template DOCX na pasta `templates/`.

**Crie o arquivo:** `templates/Modelo_Ata_Padrão.docx`

**Estrutura necessária:** 4 tabelas na seguinte ordem:

1. **Tabela 1 - Cabeçalho:** 3 colunas (LOCAL | DATA E HORÁRIO | CONVOCADO POR)
2. **Parágrafo:** Objetivo da reunião
3. **Tabela 2 - Participantes:** 2 colunas (Nº | PARTICIPANTES)
4. **Tabela 3 - Pontos:** 2 colunas (ITEM | TÓPICOS)
5. **Tabela 4 - Próximos Passos:** 4 colunas (ITEM | AÇÕES | RESPONSÁVEL | DATA)

Para mais detalhes, consulte: `templates/README_TEMPLATE.md`

### 4. Testar a Instalação

```bash
# Testar o parser TOON
python tests/test_toon_parser.py

# Testar o preenchedor DOCX (requer template)
python tests/test_docx_filler.py
```

### 5. Iniciar o Servidor

```bash
python app.py
```

O servidor iniciará em: `http://localhost:5000`

## Verificação Rápida

Teste se a API está funcionando:

```bash
curl http://localhost:5000/api/health
```

Resposta esperada:
```json
{
  "status": "online",
  "versao": "1.0.0",
  "timestamp": "..."
}
```

## Teste Completo

```bash
cd tests
curl -X POST http://localhost:5000/api/gerar-ata \
  -H "Content-Type: application/json" \
  -d @exemplo_requisicao.json
```

## Troubleshooting

### Erro: "Template não encontrado"
- Verifique se `templates/Modelo_Ata_Padrão.docx` existe
- Consulte `templates/README_TEMPLATE.md` para criar o template

### Erro: "Module not found"
- Execute: `pip install -r requirements.txt`
- Verifique se está no diretório correto

### Erro de porta em uso
- Edite `config.py` e altere `API_PORT` para outra porta
- Ou encerre o processo que está usando a porta 5000

## Próximos Passos

1. Configure o template DOCX conforme suas necessidades
2. Teste a geração de atas
3. Integre com n8n ou outro sistema
4. Configure como serviço Windows (opcional)

Para mais informações, consulte `README.md`
