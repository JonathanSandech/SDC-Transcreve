# SDC-Ata-Generator

Sistema backend em Python para geração automática de documentos Word (.docx) de atas de reunião, recebendo dados estruturados em formato TOON via API REST.

## 📋 Características

- API REST Flask para receber requisições
- Parser TOON → JSON para processar dados compactos
- Preenchimento automático de template DOCX
- Suporte a caracteres especiais PT-BR (UTF-8)
- Servidor WSGI Waitress para produção Windows

## 🚀 Instalação

### Requisitos

- Python 3.12+
- pip

### Passos de Instalação

1. **Clone ou baixe o repositório**

2. **Instale as dependências**
```bash
pip install -r requirements.txt
```

3. **Configure o template**
   - Crie ou copie o arquivo `Modelo_Ata_Padrão.docx` para a pasta `templates/`
   - Consulte `templates/README_TEMPLATE.md` para detalhes da estrutura

4. **Verifique a estrutura de diretórios**
```
gerador_ata/
├── app.py                      # API Flask principal
├── toon_parser.py              # Parser TOON → JSON
├── docx_filler.py              # Preenchimento do template DOCX
├── config.py                   # Configurações do sistema
├── requirements.txt            # Dependências
├── templates/                  # Templates DOCX
│   └── Modelo_Ata_Padrão.docx
├── output/                     # Atas geradas (criado automaticamente)
├── logs/                       # Logs do sistema
└── tests/                      # Testes e exemplos
    ├── test_toon_parser.py
    ├── test_docx_filler.py
    ├── exemplo_requisicao.json
    ├── exemplo_curl.sh
    └── exemplo_curl.bat
```

## 🧪 Testes

### Testar o Parser TOON
```bash
python tests/test_toon_parser.py
```

### Testar o Preenchedor DOCX
```bash
python tests/test_docx_filler.py
```

**Nota:** Para os testes do DOCX funcionar, você precisa ter o template na pasta `templates/`.

## 🏃 Executando a API

### Modo Desenvolvimento (Debug)
```bash
# Edite config.py e defina DEBUG = True
python app.py
```

### Modo Produção
```bash
# Edite config.py e defina DEBUG = False
python app.py
```

A API estará disponível em: `http://localhost:5000`

## 📡 Endpoints da API

### 1. Health Check
```http
GET /api/health
```

**Resposta:**
```json
{
  "status": "online",
  "versao": "1.0.0",
  "timestamp": "2025-11-13T14:30:00"
}
```

### 2. Gerar Ata
```http
POST /api/gerar-ata
Content-Type: application/json
```

**Body:**
```json
{
  "dados_toon": "string contendo formato TOON completo",
  "nome_arquivo": "Ata_Reuniao_13-11-2025" (opcional)
}
```

**Resposta Sucesso (200):**
```json
{
  "status": "sucesso",
  "mensagem": "Ata gerada com sucesso",
  "arquivo": "Ata_Reuniao_13-11-2025.docx",
  "caminho": "/api/download/Ata_Reuniao_13-11-2025.docx",
  "timestamp": "2025-11-13T14:30:00"
}
```

### 3. Download de Arquivo
```http
GET /api/download/<nome_arquivo>
```

**Resposta:** Binary DOCX file

## 📝 Formato TOON

Exemplo de entrada no formato TOON:

```toon
local: Sala de Reuniões SDC
data_horario: 13/11/2025 - 14:00 às 15:30
convocado_por: Jonathan Silva
objetivo: Demonstração de processo para geração de atas via transcrição automática

participantes[3]{num,nome}:
1,Jonathan Silva
2,Everton Santos
3,Maria Costa

pontos[3]{item,topico}:
1,Gravação utilizando OBS configurado para salvar vídeos em formato MP4
2,Compressão de arquivo reduzindo de 956MB para 69MB usando Clipchamp
3,Transcrição automática via Word Online com limite de 300MB/mês

proximos_passos[2]{item,acao,responsavel,data}:
1,Padronizar procedimento para todas as gravações internas,Jonathan Silva,20/11/2025
2,Compartilhar tutorial com colaboradores,Everton Santos,25/11/2025
```

**Nota:** No JSON da requisição, use `\n` para quebras de linha.

## 🧪 Testando com curl

### Windows
```bash
cd tests
exemplo_curl.bat
```

### Linux/Mac
```bash
cd tests
chmod +x exemplo_curl.sh
./exemplo_curl.sh
```

### Exemplo manual
```bash
curl -X POST http://localhost:5000/api/gerar-ata \
  -H "Content-Type: application/json" \
  -d @tests/exemplo_requisicao.json
```

## ⚙️ Configuração

Edite o arquivo `config.py` para personalizar:

- **API_HOST**: Host da API (padrão: `0.0.0.0`)
- **API_PORT**: Porta da API (padrão: `5000`)
- **DEBUG**: Modo debug (padrão: `False`)
- **TEMPLATE_FILE**: Nome do arquivo template
- **MAX_CONTENT_LENGTH**: Tamanho máximo da requisição (padrão: 10MB)
- **CORS_ORIGINS**: Origens permitidas para CORS

## 📊 Logs

Os logs são salvos em `logs/api.log` e incluem:
- Requisições recebidas
- Erros de parsing
- Arquivos gerados
- Erros do sistema

## 🔧 Troubleshooting

### Template não encontrado
```
Erro: Template não encontrado: templates/Modelo_Ata_Padrão.docx
```
**Solução:** Crie o template DOCX seguindo as instruções em `templates/README_TEMPLATE.md`

### Erro de parsing TOON
```
Erro: Campos obrigatórios faltando: objetivo, participantes
```
**Solução:** Verifique se todos os campos obrigatórios estão presentes no formato TOON

### Erro de encoding
```
UnicodeDecodeError: 'charmap' codec can't decode byte...
```
**Solução:** Certifique-se de que todos os arquivos estão salvos em UTF-8

## 🔐 Segurança

- Validação de entrada rigorosa
- Sanitização de nomes de arquivo
- Limite de tamanho de requisição (10MB)
- CORS configurável
- Logs completos de todas as operações

## 📦 Deploy em Produção (Windows)

### Como Serviço Windows com NSSM

1. **Baixe o NSSM** (Non-Sucking Service Manager)
   ```
   https://nssm.cc/download
   ```

2. **Instale o serviço**
   ```cmd
   nssm install SDCAta-Generator "C:\Python312\python.exe" "C:\path\to\app.py"
   ```

3. **Configure o serviço**
   ```cmd
   nssm set SDCAta-Generator AppDirectory "C:\path\to\gerador_ata"
   nssm set SDCAta-Generator DisplayName "SDC Ata Generator"
   nssm set SDCAta-Generator Description "Sistema Gerador de Atas de Reunião"
   ```

4. **Inicie o serviço**
   ```cmd
   nssm start SDCAta-Generator
   ```

## 📚 Documentação Adicional

- `plan.md` - Planejamento completo do projeto (Metodologia PREVC)
- `templates/README_TEMPLATE.md` - Estrutura do template DOCX
- `tests/` - Exemplos e testes

## 👨‍💻 Desenvolvimento

### Estrutura do Código

- **app.py**: API Flask com endpoints REST
- **toon_parser.py**: Parser que converte TOON → JSON
- **docx_filler.py**: Preenche template DOCX com dados
- **config.py**: Configurações centralizadas

### Adicionando Novos Recursos

1. Edite os arquivos correspondentes
2. Execute os testes para garantir que nada quebrou
3. Atualize a documentação

## 🐛 Reportando Problemas

Ao reportar problemas, inclua:
- Versão do Python
- Conteúdo do arquivo `logs/api.log`
- Exemplo da requisição que falhou
- Mensagem de erro completa

## 📄 Licença

Este projeto é interno da SDC.

## 🤝 Contribuindo

Para contribuir:
1. Faça suas alterações
2. Execute todos os testes
3. Atualize a documentação
4. Envie para revisão

## 📞 Contato

**Responsável:** Jonathan Barbosa
**Projeto:** SDC-Ata-Generator
**Data:** 13/11/2025

---

**Versão:** 1.0.0
**Status:** Produção ✅
