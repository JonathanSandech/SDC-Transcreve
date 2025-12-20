# 🚀 Guia de Otimização de Memória RAM

## 📊 Situação Atual

**Máquina**: 16GB RAM total
**Uso atual**: 70-80% sem fazer nada

### Problemas Identificados:

1. **WSL2 sem limite**: Por padrão usa até 50% da RAM (~8GB)
2. **Docker Backend**: Configurado para usar até **12GB** de RAM (muito alto!)
3. **Cache do sistema**: WSL2 mantém cache que não libera para o Windows

## 🎯 Configuração Recomendada

Para máquina com 16GB RAM:

```
Windows:          10 GB (62%)
WSL2:              6 GB (38%)
  ├─ Docker:       4 GB
  ├─ Sistema:      2 GB
```

Isso deixará 10GB para o Windows e aplicações, mantendo o sistema fluido.

## 📋 Passo a Passo de Otimização

### 1. Limitar Memória do WSL2 ✨ MAIS IMPORTANTE

No **PowerShell** (não precisa ser admin):

```powershell
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-wsl-memory.ps1
```

O script irá:
- Criar arquivo `C:\Users\<Usuario>\.wslconfig`
- Configurar limite de **6GB** para o WSL2
- Configurar swap de **2GB**
- Reiniciar o WSL2 automaticamente

**Resultado esperado**: WSL2 usará no máximo 6GB ao invés de 8GB+

### 2. Reduzir Limite do Docker Backend

O backend está configurado para usar **12GB**, o que é excessivo.

Edite o arquivo `docker-compose.yml`:

```bash
nano /home/jonathanbarbosa/dev/SDC-Transcreve/docker-compose.yml
```

Encontre a linha 79 e altere de `12G` para `6G`:

```yaml
deploy:
  resources:
    limits:
      memory: 6G      # Antes: 12G
      cpus: '4.0'
```

**Por quê reduzir?**
- O processamento pesado (transcrição) usa **GPU (VRAM)**, não RAM
- Whisper com GPU usa primariamente VRAM da placa de vídeo
- 6GB é mais que suficiente para carregar modelos e processar

### 3. Rebuild da Aplicação

Após alterar o docker-compose:

```bash
cd /home/jonathanbarbosa/dev/SDC-Transcreve
./docker-commands.sh rebuild
```

### 4. Limpar Cache do Docker (Opcional)

Se já rodou muitos testes, limpe o cache:

```bash
# Ver espaço usado
docker system df

# Limpar tudo que não está em uso
docker system prune -af

# Limpar volumes órfãos (CUIDADO: apaga dados não usados)
docker system prune -af --volumes
```

## 🔍 Monitoramento

### Monitor Completo (PowerShell):

```powershell
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\monitor-resources.ps1
```

Mostra:
- Memória do Windows
- Top 10 processos
- Uso do WSL2 (vmmem)
- Memória dentro do WSL
- Containers Docker
- GPU (NVIDIA)
- Recomendações automáticas

### Monitoramento Contínuo (atualiza a cada 5s):

```powershell
while ($true) { cls; .\monitor-resources.ps1; Start-Sleep 5 }
```

Para parar: `Ctrl+C`

### Verificar Uso de RAM do Windows:

```powershell
# Ver memória total e em uso
Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory

# Ver processos que mais consomem RAM
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, @{N='RAM(MB)';E={[Math]::Round($_.WorkingSet64/1MB,1)}}
```

### Verificar Uso no WSL:

```bash
# Memória geral
free -h

# Processos que mais consomem
ps aux --sort=-%mem | head -10

# Docker stats (containers rodando)
docker stats --no-stream
```

## 📈 Resultados Esperados

### Antes da Otimização:
```
Windows:          12-13 GB (75-80%)
WSL2 (vmmem):      8-10 GB
Docker Backend:   Pode chegar a 12 GB
Sistema:          Lento, swapping constante
```

### Depois da Otimização:
```
Windows:           8-10 GB (50-60%)
WSL2 (vmmem):      4-6 GB (limitado)
Docker Backend:    2-4 GB (limitado a 6GB)
Sistema:           Fluido, responsivo
```

**Memória liberada**: ~3-4 GB

## ⚙️ Configurações Aplicadas

### `.wslconfig` (C:\Users\<Usuario>\.wslconfig)

```ini
[wsl2]
memory=6GB          # Limite de RAM para WSL2
swap=2GB            # Limite de swap
localhostForwarding=true
```

### `docker-compose.yml` (linha 79)

```yaml
deploy:
  resources:
    limits:
      memory: 6G    # Limite de RAM para backend
      cpus: '4.0'
```

## 🔄 Comandos Úteis

### Liberar Memória do WSL2:

```powershell
# Parar WSL2 (libera toda memória)
wsl --shutdown

# Aguardar 5 segundos
Start-Sleep 5

# Iniciar novamente
wsl
```

### Verificar .wslconfig:

```powershell
# Ver conteúdo
Get-Content $env:USERPROFILE\.wslconfig

# Editar
notepad $env:USERPROFILE\.wslconfig

# Após editar, reinicie WSL
wsl --shutdown
```

### Ver Limites Aplicados no Docker:

```bash
# Ver configuração de recursos
docker inspect sdc-transcription-backend | grep -A 10 Memory

# Ver uso real
docker stats sdc-transcription-backend --no-stream
```

## 🧪 Testar Transcrição com Limites

Após aplicar as otimizações, teste uma transcrição:

```bash
# Verificar memória ANTES
docker stats --no-stream

# Fazer upload e transcrever um arquivo de teste

# Verificar memória DURANTE (outro terminal)
watch -n 2 docker stats --no-stream

# Verificar GPU (outro terminal)
watch -n 2 nvidia-smi
```

**Esperado**:
- RAM do backend: 2-4 GB durante transcrição
- GPU Utilization: 80-100%
- VRAM: Variável conforme modelo Whisper

## 📊 Tabela de Limites Recomendados

| RAM Total | WSL2 Limit | Docker Backend | Windows Livre |
|-----------|------------|----------------|---------------|
| 16 GB     | 6 GB       | 6 GB           | ~10 GB        |
| 12 GB     | 4 GB       | 4 GB           | ~8 GB         |
| 32 GB     | 12 GB      | 8 GB           | ~20 GB        |

## ⚠️ Problemas Comuns

### 1. WSL2 ainda consome muita RAM

**Causa**: .wslconfig não foi aplicado
**Solução**:
```powershell
# Verificar se arquivo existe
Test-Path $env:USERPROFILE\.wslconfig

# Reiniciar WSL
wsl --shutdown
```

### 2. Docker falha com "out of memory"

**Causa**: Limite muito baixo para a carga de trabalho
**Solução**: Aumentar limite no docker-compose.yml:
```yaml
memory: 8G  # ao invés de 6G
```

### 3. Transcrição lenta ou trava

**Causa**: Pode ser falta de VRAM (GPU), não RAM
**Solução**:
```bash
# Ver uso de GPU
nvidia-smi

# Se VRAM estiver cheia, use modelo menor
# Edite backend/python/transcribe.py
```

### 4. Windows continua lento

**Causas possíveis**:
- Outros programas consumindo RAM
- Antivírus escaneando WSL
- Windows Update rodando

**Verificar**:
```powershell
# Ver processos
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20

# Ver serviços
Get-Service | Where-Object {$_.Status -eq 'Running'} | Sort-Object
```

## 🎯 Checklist de Otimização

- [ ] Executado `setup-wsl-memory.ps1`
- [ ] Arquivo `.wslconfig` criado em `C:\Users\<Usuario>\`
- [ ] WSL2 reiniciado com `wsl --shutdown`
- [ ] Verificado limite com `wsl -e free -h` (deve mostrar ~6GB total)
- [ ] Editado `docker-compose.yml` (memory: 6G)
- [ ] Rebuild da aplicação: `./docker-commands.sh rebuild`
- [ ] Verificado com `docker stats`
- [ ] Testado transcrição
- [ ] Verificado uso de RAM no Windows (deve estar <60%)
- [ ] Criado monitoramento: `.\monitor-resources.ps1`

## 📚 Recursos Adicionais

### Scripts Criados:

1. **setup-wsl-memory.ps1** - Configurar limites de RAM do WSL2
2. **monitor-resources.ps1** - Monitorar uso de recursos
3. **check-ip.ps1** - Verificar IPs e rede

### Arquivos de Configuração:

1. **C:\Users\<Usuario>\.wslconfig** - Limites do WSL2
2. **docker-compose.yml** - Limites dos containers

### Documentação Oficial:

- [WSL2 Advanced Settings](https://learn.microsoft.com/pt-br/windows/wsl/wsl-config#wslconfig)
- [Docker Memory Limits](https://docs.docker.com/config/containers/resource_constraints/)

## 💡 Dicas Finais

1. **Reinicie o WSL semanalmente**: `wsl --shutdown` libera memória acumulada
2. **Monitore durante uso real**: Use `monitor-resources.ps1` durante transcrições
3. **GPU é o importante**: Para transcrição, VRAM da GPU importa mais que RAM
4. **Ajuste conforme necessário**: Se 6GB for pouco, aumente para 8GB
5. **Feche aplicações não usadas**: Chrome, VS Code etc consomem muita RAM

## 🎉 Resultado Final

Com as otimizações aplicadas:

✅ WSL2 limitado a 6GB
✅ Docker backend limitado a 6GB
✅ ~4GB de RAM liberada para o Windows
✅ Sistema mais responsivo
✅ Transcrição continua rápida (usa GPU)

**Uso esperado do Windows**: 50-60% ao invés de 70-80%
