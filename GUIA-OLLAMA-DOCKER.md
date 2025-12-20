# 🤖 Guia de Configuração Ollama no Docker

## 📋 O Que Foi Configurado

### 1. Serviço Ollama Adicionado ao Docker Compose

Foi adicionado um novo serviço `ollama` no `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: sdc-ollama
  runtime: nvidia  # Usa GPU NVIDIA para aceleração
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama  # Persiste os modelos
```

**Características**:
- ✅ Usa GPU NVIDIA para inferência rápida
- ✅ Limite de 8GB de RAM
- ✅ Volume persistente para modelos (não precisa baixar sempre)
- ✅ Health check automático
- ✅ Conectado à mesma rede do backend

### 2. Backend Configurado para Usar Ollama no Docker

Arquivo `backend/python/gerador_ata/config_ata.py` atualizado:

```python
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma2:9b')
```

Agora usa o nome do serviço Docker `ollama` ao invés de `localhost`.

### 3. Modelo Configurado

**Modelo principal**: `gemma2:9b` (5.4 GB)

**Outros modelos disponíveis** (opcionais):
- qwen3:8b (5.2 GB)
- llama3.1:8b (4.9 GB)
- gpt-oss:20b (13 GB)

## 🚀 Passo a Passo para Ativar

### Opção 1: Script Automatizado (Recomendado)

```bash
cd /home/jonathanbarbosa/dev/SDC-Transcreve

# Executar script de migração
./migrate-ollama-models.sh
```

O script vai:
1. ✅ Verificar se container Ollama está rodando
2. ✅ Perguntar quais modelos copiar (só gemma2:9b ou todos)
3. ✅ Fazer download dos modelos para o Docker
4. ✅ Verificar se tudo funcionou

### Opção 2: Manual

```bash
# 1. Subir o serviço Ollama
docker compose up -d ollama

# 2. Aguardar container iniciar (30-40s)
sleep 30

# 3. Fazer pull do modelo principal
docker exec sdc-ollama ollama pull gemma2:9b

# 4. Verificar se modelo foi instalado
docker exec sdc-ollama ollama list

# 5. Testar modelo
docker exec sdc-ollama ollama run gemma2:9b "Olá, como você está?"
```

### Opção 3: Copiar Modelos Já Baixados do Windows (Avançado)

Se você não quer baixar novamente (economizar tempo/banda):

```powershell
# No PowerShell (Windows):

# 1. Encontrar onde estão os modelos no Windows
$ollamaPath = "$env:USERPROFILE\.ollama\models"
echo $ollamaPath

# 2. Criar arquivo tar com os modelos
cd $ollamaPath
tar -czf ollama-models.tar.gz blobs manifests

# 3. Copiar para WSL
wsl cp "/mnt/c/Users/<SEU_USUARIO>/.ollama/models/ollama-models.tar.gz" /tmp/

# No WSL (Bash):
# 4. Copiar para o volume Docker
docker compose up -d ollama
sleep 10

# 5. Extrair modelos no container
docker cp /tmp/ollama-models.tar.gz sdc-ollama:/root/.ollama/
docker exec sdc-ollama tar -xzf /root/.ollama/ollama-models.tar.gz -C /root/.ollama/
docker exec sdc-ollama rm /root/.ollama/ollama-models.tar.gz

# 6. Verificar
docker exec sdc-ollama ollama list
```

## 🔄 Rebuild da Aplicação

Após configurar o Ollama, faça rebuild:

```bash
cd /home/jonathanbarbosa/dev/SDC-Transcreve
./docker-commands.sh rebuild
```

## 🧪 Testar Geração de Ata

### 1. Verificar Status do Ollama

**Via API do Backend**:
```bash
curl http://localhost:8000/api/gerar-ata/ollama/status
```

**Resposta esperada**:
```json
{
  "status": "online",
  "modelo_configurado": "gemma2:9b",
  "modelos_disponiveis": ["gemma2:9b"],
  "url": "http://ollama:11434"
}
```

### 2. Testar Diretamente no Container

```bash
# Testar modelo com prompt simples
docker exec sdc-ollama ollama run gemma2:9b "Resuma: A reunião foi sobre planejamento de projeto."
```

### 3. Testar via Frontend

1. Acesse o frontend: `http://localhost/`
2. Vá para "Gerar Ata"
3. Preencha os dados da reunião
4. Clique em "Gerar Ata"
5. Aguarde o processamento (pode levar 1-3 minutos dependendo do tamanho)

## 📊 Monitoramento

### Ver Logs do Ollama

```bash
# Logs em tempo real
docker logs -f sdc-ollama

# Últimas 100 linhas
docker logs --tail 100 sdc-ollama
```

### Verificar Uso de GPU

```bash
# Ver GPU sendo usada pelo Ollama
nvidia-smi

# Monitoramento contínuo
watch -n 2 nvidia-smi
```

### Ver Modelos Instalados

```bash
docker exec sdc-ollama ollama list
```

**Saída esperada**:
```
NAME            ID              SIZE      MODIFIED
gemma2:9b       ff02c3702f32    5.4 GB    5 minutes ago
```

## ⚙️ Configurações Avançadas

### Variáveis de Ambiente (docker-compose.yml)

Você pode adicionar no serviço `backend`:

```yaml
backend:
  environment:
    # Ollama
    OLLAMA_BASE_URL: http://ollama:11434
    OLLAMA_MODEL: gemma2:9b
    OLLAMA_TIMEOUT: 600
    OLLAMA_TEMPERATURE: 0.1
    OLLAMA_MAX_TOKENS: 6000
    OLLAMA_TOP_P: 0.8
```

### Trocar de Modelo

Para usar outro modelo (ex: llama3.1:8b):

```bash
# 1. Baixar modelo
docker exec sdc-ollama ollama pull llama3.1:8b

# 2. Editar config_ata.py ou adicionar variável de ambiente
# No docker-compose.yml, seção backend:
environment:
  OLLAMA_MODEL: llama3.1:8b

# 3. Rebuild
./docker-commands.sh rebuild
```

### Ajustar Parâmetros de Geração

Edite `backend/python/gerador_ata/config_ata.py`:

```python
OLLAMA_TEMPERATURE = 0.1    # Menor = mais focado, maior = mais criativo (0.0-1.0)
OLLAMA_MAX_TOKENS = 6000    # Máximo de tokens a gerar
OLLAMA_TOP_P = 0.8          # Nucleus sampling (0.0-1.0)
OLLAMA_TIMEOUT = 600        # Timeout em segundos (10 minutos)
```

## 🔧 Solução de Problemas

### Problema 1: Container Ollama não inicia

**Sintomas**:
```
Error response from daemon: could not select device driver "" with capabilities: [[gpu]]
```

**Solução**:
```bash
# Verificar se nvidia-docker está instalado
dpkg -l | grep nvidia-docker2

# Se não estiver, instalar:
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### Problema 2: Ollama está offline

**Verificar**:
```bash
# Status do container
docker ps | grep ollama

# Logs
docker logs sdc-ollama

# Testar health
docker exec sdc-ollama curl http://localhost:11434/api/tags
```

**Solução**:
```bash
# Reiniciar container
docker compose restart ollama

# Ou recriar
docker compose up -d --force-recreate ollama
```

### Problema 3: Modelo não encontrado

**Erro**:
```
Error: model 'gemma2:9b' not found
```

**Solução**:
```bash
# Listar modelos
docker exec sdc-ollama ollama list

# Se estiver vazio, fazer pull
docker exec sdc-ollama ollama pull gemma2:9b
```

### Problema 4: Geração muito lenta

**Possíveis causas**:
1. **Não está usando GPU**: Verificar `nvidia-smi`
2. **Modelo muito grande**: Usar modelo menor (llama3.1:8b ao invés de gpt-oss:20b)
3. **Pouca VRAM**: Verificar uso com `nvidia-smi`

**Solução**:
```bash
# Ver se Ollama está usando GPU
nvidia-smi

# Trocar para modelo menor se necessário
docker exec sdc-ollama ollama pull llama3.1:8b
# Atualizar OLLAMA_MODEL no config_ata.py
```

### Problema 5: Backend não consegue conectar ao Ollama

**Erro nos logs do backend**:
```
Não foi possível conectar ao Ollama em http://ollama:11434
```

**Verificar**:
```bash
# Backend e Ollama estão na mesma rede?
docker network inspect sdc-network

# Testar conectividade do backend para o ollama
docker exec sdc-transcription-backend curl http://ollama:11434/api/tags
```

**Solução**:
```bash
# Rebuild com dependências corretas
docker compose down
docker compose up -d
```

## 📈 Comparação: Windows vs Docker

| Aspecto | Ollama no Windows | Ollama no Docker |
|---------|-------------------|------------------|
| **Desempenho** | Similar | Similar (usa mesma GPU) |
| **Isolamento** | ❌ Compartilha recursos | ✅ Isolado, com limites |
| **Portabilidade** | ❌ Só funciona no Windows | ✅ Funciona em qualquer host |
| **Gerenciamento** | ❌ Manual | ✅ Automático via compose |
| **Deploy** | ❌ Precisa instalar manualmente | ✅ Deploy automático |
| **RAM** | ❌ Sem limite | ✅ Limite de 8GB |
| **Logs** | ❌ Difícil rastrear | ✅ Fácil com `docker logs` |

## 🎯 Checklist de Configuração

- [ ] Serviço Ollama adicionado ao `docker-compose.yml`
- [ ] Volume `ollama_data` criado
- [ ] Backend depende do Ollama (`depends_on`)
- [ ] `config_ata.py` atualizado com `OLLAMA_BASE_URL`
- [ ] Container Ollama rodando: `docker ps | grep ollama`
- [ ] Modelo gemma2:9b instalado: `docker exec sdc-ollama ollama list`
- [ ] Health check OK: `docker exec sdc-ollama curl http://localhost:11434/api/tags`
- [ ] Backend conecta ao Ollama: `curl localhost:8000/api/gerar-ata/ollama/status`
- [ ] Rebuild completo: `./docker-commands.sh rebuild`
- [ ] Teste de geração de ata funcionando

## 🚀 Comandos Rápidos

```bash
# Status
docker compose ps

# Ver modelos
docker exec sdc-ollama ollama list

# Logs
docker logs -f sdc-ollama

# Testar
docker exec sdc-ollama ollama run gemma2:9b "Teste"

# Reinstalar modelo
docker exec sdc-ollama ollama pull gemma2:9b

# Rebuild tudo
./docker-commands.sh rebuild

# Ver uso de GPU
nvidia-smi
```

## 🎉 Resultado Final

Com a configuração completa:

✅ Ollama roda dentro do Docker com GPU
✅ Backend conecta automaticamente ao Ollama
✅ Modelos persistem (não precisa baixar sempre)
✅ Geração de ata funciona via frontend
✅ Monitoramento fácil com Docker
✅ Deploy simplificado (só um `docker compose up`)

**Uso de memória esperado**:
- Ollama: 2-6 GB RAM + 4-8 GB VRAM
- Backend: 2-4 GB RAM + 2-4 GB VRAM (Whisper)
- Total GPU: ~6-12 GB VRAM (depende dos modelos)

**Certifique-se que sua GPU tem pelo menos 12GB VRAM para rodar ambos confortavelmente!**
