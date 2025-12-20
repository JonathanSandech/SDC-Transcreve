# 🚀 Passo a Passo Completo - Configuração Final

## ✅ Status Atual

- [x] IP atualizado no .env: `192.168.16.60`
- [x] Script setup-network.ps1 executado
- [ ] Rebuild da aplicação
- [ ] Configurar autostart
- [ ] Fixar IP estático

## 📋 Próximas Etapas

### Etapa 1: Rebuild da Aplicação (No WSL)

O frontend precisa ser reconstruído com o novo IP configurado:

```bash
cd /home/jonathanbarbosa/dev/SDC-Transcreve
./docker-commands.sh rebuild
```

Isso vai:
- Parar os containers
- Rebuild do frontend com `VITE_API_URL=http://192.168.16.60:8000`
- Iniciar tudo novamente

Aguarde até ver as mensagens de sucesso.

### Etapa 2: Testar Acesso

**Localmente (na mesma máquina)**:
```bash
curl http://localhost:8000/health
```

**De outro computador na rede**:
- Abra o navegador
- Acesse: `http://192.168.16.60/`

### Etapa 3: Configurar Autostart (PowerShell como ADMINISTRADOR)

```powershell
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-autostart.ps1
```

Isso vai criar:
- `C:\SDC-Transcription\start-transcription.ps1`
- `C:\SDC-Transcription\stop-transcription.ps1`
- Tarefa agendada que inicia no boot

### Etapa 4: Fixar o IP (PowerShell como ADMINISTRADOR)

**IMPORTANTE**: O IP `192.168.16.60` é da interface vEthernet (HYPER-V).

Você tem duas opções:

#### Opção A: Fixar o IP 192.168.16.60 (vEthernet)

```powershell
.\setup-static-ip.ps1
```

Quando perguntar:
- IP: `192.168.16.60`
- Gateway: (use o sugerido)
- DNS: 8.8.8.8

#### Opção B: Usar o IP da Wi-Fi (192.168.16.50)

Se preferir usar o IP da Wi-Fi:

1. Execute o script:
```powershell
.\setup-static-ip.ps1
```

2. Configure:
   - IP: `192.168.16.50`
   - Gateway: (use o sugerido)
   - DNS: 8.8.8.8

3. O script vai atualizar o `.env` automaticamente

4. No WSL, rebuild novamente:
```bash
./docker-commands.sh rebuild
```

## 🤔 Qual IP Devo Usar?

| IP | Interface | Recomendação |
|---|---|---|
| **192.168.16.50** | Wi-Fi | ✅ **Recomendado** - Mais estável, conectado à rede real |
| 192.168.16.60 | vEthernet (HYPER-V) | ⚠️ Virtual, pode ser menos estável |

**Sugestão**: Use o IP da **Wi-Fi (192.168.16.50)** para maior estabilidade.

## 📝 Sequência Completa Recomendada

### No PowerShell como ADMINISTRADOR:

```powershell
# 1. Fixar IP da Wi-Fi
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-static-ip.ps1
# Escolher: 192.168.16.50 (Wi-Fi)

# 2. Configurar autostart
.\setup-autostart.ps1

# 3. Verificar tudo está ok
.\check-ip.ps1
```

### No WSL:

```bash
# 4. Rebuild da aplicação
cd /home/jonathanbarbosa/dev/SDC-Transcreve
./docker-commands.sh rebuild

# 5. Verificar status
./docker-commands.sh status

# 6. Ver logs
./docker-commands.sh logs
```

## 🎯 Comandos Úteis Após Configuração

### Verificar IP Fixo (PowerShell):
```powershell
Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address
```

### Ver Port Forwarding Ativo (PowerShell):
```powershell
netsh interface portproxy show v4tov4
```

### Verificar Status do Docker (WSL):
```bash
docker ps
./docker-commands.sh status
```

### Ver Logs (WSL):
```bash
./docker-commands.sh logs
./docker-commands.sh logs backend
./docker-commands.sh logs frontend
```

### Parar Aplicação (PowerShell):
```powershell
C:\SDC-Transcription\stop-transcription.ps1
```

### Ver Log de Auto-Start (PowerShell):
```powershell
Get-Content C:\SDC-Transcription\startup.log
```

## 🔄 Testar Auto-Start

Após configurar tudo:

1. **Reiniciar o Windows**
2. **Aguardar 1-2 minutos**
3. **Testar acesso**: `http://192.168.16.50/`
4. **Ver log**: `C:\SDC-Transcription\startup.log`

## 📢 Informações para Compartilhar com a Equipe

Após tudo configurado, compartilhe:

```
================================
Sistema de Transcrição SDC
================================

URL de Acesso: http://192.168.16.50/

Requisitos:
• Estar conectado à rede Wi-Fi da empresa
• Usar navegador Chrome, Edge ou Firefox

Instruções:
1. Abrir navegador
2. Acessar a URL acima
3. Fazer upload do arquivo de áudio
4. Aguardar processamento
5. Baixar resultado

Suporte: [seu contato]
================================
```

## ✅ Checklist Final

- [ ] IP estático configurado
- [ ] `.env` atualizado com IP correto
- [ ] Rebuild da aplicação completo
- [ ] Port forwarding configurado
- [ ] Autostart configurado
- [ ] Testado acesso local: `http://localhost/`
- [ ] Testado acesso na rede: `http://192.168.16.50/`
- [ ] Reiniciado Windows e verificado auto-start
- [ ] Documentado IP para a equipe

## 🆘 Em Caso de Problemas

### Aplicação não inicia automaticamente:

```powershell
# Ver tarefa agendada
Get-ScheduledTask -TaskName "SDC-Transcription-AutoStart"

# Ver log de inicialização
Get-Content C:\SDC-Transcription\startup.log

# Testar manualmente
C:\SDC-Transcription\start-transcription.ps1
```

### Port forwarding não funciona:

```powershell
# Reconfigurar
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-network.ps1
```

### IP mudou após reiniciar:

Se não fixou o IP:
```powershell
.\setup-static-ip.ps1
```

### Docker não responde:

```bash
# No WSL:
docker ps
./docker-commands.sh restart
```

---

**Dica**: Salve este arquivo como referência. Você pode consultá-lo sempre que precisar! 📚
