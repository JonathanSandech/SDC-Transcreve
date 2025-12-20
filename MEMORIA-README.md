# 🎯 Solução Rápida - Otimização de Memória RAM

## 🚨 Problema

Máquina com 16GB RAM usando 70-80% sem fazer nada.

## ✅ Solução (3 passos rápidos)

### 1️⃣ Limitar WSL2 (PowerShell):

```powershell
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-wsl-memory.ps1
```

**O que faz**: Limita WSL2 para 6GB ao invés de 8GB+

### 2️⃣ Reduzir Docker (WSL/Linux):

```bash
cd /home/jonathanbarbosa/dev/SDC-Transcreve
./optimize-docker-memory.sh
```

**O que faz**: Reduz limite do backend de 12GB para 6GB

### 3️⃣ Monitorar (PowerShell):

```powershell
.\monitor-resources.ps1
```

**O que faz**: Mostra uso de RAM do Windows, WSL2, Docker e GPU

## 📊 Resultado Esperado

| Antes | Depois |
|-------|--------|
| Windows: 70-80% | Windows: 50-60% |
| WSL2: 8GB+ | WSL2: 6GB max |
| Docker: 12GB possível | Docker: 6GB max |

**RAM liberada**: ~4GB

## 🔍 Por Que Isso Funciona?

1. **WSL2 sem limite**: Por padrão usa 50% da RAM (8GB de 16GB)
2. **Docker muito generoso**: Configurado para 12GB (3/4 da RAM total!)
3. **Transcrição usa GPU**: O processamento pesado usa VRAM, não RAM

## 📚 Documentação Completa

Leia: `GUIA-OTIMIZACAO-MEMORIA.md` para detalhes completos.

## 🆘 Precisa de Ajuda?

### Ainda está consumindo muita RAM?

```powershell
# Ver o que está consumindo
.\monitor-resources.ps1

# Reiniciar WSL (libera cache)
wsl --shutdown
Start-Sleep 5
wsl
```

### Docker ainda usa muita RAM?

```bash
# Ver uso real
docker stats

# Se estiver perto do limite (6GB), considere aumentar
nano docker-compose.yml
# Mude memory: 6G para memory: 8G
./docker-commands.sh rebuild
```

### .wslconfig não funcionou?

```powershell
# Verificar se arquivo existe
Get-Content $env:USERPROFILE\.wslconfig

# Deve mostrar: memory=6GB

# Se não existir, execute novamente:
.\setup-wsl-memory.ps1
```

## 🎉 Pronto!

Com essas 3 etapas simples, você deve ter ~4GB de RAM liberada.

---

**Scripts criados**:
- ✅ `setup-wsl-memory.ps1` - Limita WSL2
- ✅ `optimize-docker-memory.sh` - Otimiza Docker
- ✅ `monitor-resources.ps1` - Monitora recursos

**Documentação completa**:
- 📖 `GUIA-OTIMIZACAO-MEMORIA.md` - Guia detalhado
