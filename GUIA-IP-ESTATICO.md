# Guia para Configurar IP Estático no Windows

Este guia mostra como fixar o IP da máquina para que ele não mude após reiniciar.

## 🎯 Por que fixar o IP?

Sem IP fixo:
- O IP pode mudar a cada reinicialização (DHCP)
- Usuários precisarão ser avisados do novo IP
- Você precisará atualizar o `.env` e refazer o setup

Com IP fixo:
- O IP sempre será o mesmo
- Usuários podem salvar o link nos favoritos
- Configuração única, sem manutenção

## 📋 Opções para Fixar o IP

### Opção 1: Configurar IP Estático no Windows (Recomendado)

#### Método A: Via Interface Gráfica

1. **Abrir Configurações de Rede**:
   - Clique com botão direito no ícone de rede na bandeja
   - Selecione "Abrir Configurações de Rede e Internet"
   - Ou: Configurações → Rede e Internet

2. **Acessar Adaptador**:
   - Clique em "Alterar opções do adaptador"
   - Ou: "Propriedades" → "Propriedades do adaptador"

3. **Configurar IP**:
   - Clique com botão direito no adaptador ativo (Wi-Fi ou Ethernet)
   - Selecione "Propriedades"
   - Clique duas vezes em "Protocolo IP Versão 4 (TCP/IPv4)"

4. **Definir IP Estático**:
   - Marque "Usar o seguinte endereço IP:"
   - Preencha:
     ```
     Endereço IP: 192.168.16.50
     Máscara de sub-rede: 255.255.255.0
     Gateway padrão: 192.168.16.1 (ou o gateway da sua rede)

     DNS preferencial: 8.8.8.8 (Google DNS)
     DNS alternativo: 8.8.4.4
     ```
   - Clique em "OK"

5. **Testar Conexão**:
   - Abra o PowerShell e teste:
   ```powershell
   ping 8.8.8.8
   ping google.com
   ```

#### Método B: Via PowerShell (Rápido)

Execute no PowerShell como **ADMINISTRADOR**:

```powershell
# 1. Ver configuração atual
Get-NetIPConfiguration

# 2. Identificar o nome do adaptador (InterfaceAlias)
# Exemplo: "Wi-Fi" ou "Ethernet"

# 3. Remover IP atual (DHCP)
$adapter = "Wi-Fi"  # Trocar pelo nome correto
Remove-NetIPAddress -InterfaceAlias $adapter -Confirm:$false

# 4. Configurar IP estático
New-NetIPAddress -InterfaceAlias $adapter -IPAddress 192.168.16.50 -PrefixLength 24 -DefaultGateway 192.168.16.1

# 5. Configurar DNS
Set-DnsClientServerAddress -InterfaceAlias $adapter -ServerAddresses 8.8.8.8,8.8.4.4

# 6. Verificar
Get-NetIPAddress -InterfaceAlias $adapter
```

**IMPORTANTE**: Antes de executar, confirme:
- Nome correto do adaptador: Execute `Get-NetAdapter`
- Gateway correto: Execute `Get-NetRoute -DestinationPrefix 0.0.0.0/0`

### Opção 2: Reservar IP no Roteador/Servidor DHCP

Se você tiver acesso ao roteador ou servidor DHCP da empresa:

1. **Encontrar o MAC Address da máquina**:
   ```powershell
   Get-NetAdapter | Select-Object Name, MacAddress
   ```

2. **No roteador/DHCP**:
   - Acessar painel de administração
   - Procurar por "Reserva de IP" ou "DHCP Reservation"
   - Adicionar:
     - MAC Address: (da máquina)
     - IP: 192.168.16.50
   - Salvar configurações

3. **Vantagens**:
   - Não precisa configurar o Windows
   - Funciona mesmo se resetar as configurações de rede
   - Mais fácil de gerenciar múltiplas máquinas

## 🔍 Como Descobrir as Configurações da Rede

Execute no PowerShell:

```powershell
# Ver todas as configurações de rede
Get-NetIPConfiguration -Detailed

# Ver apenas o adaptador ativo
Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }

# Ver gateway padrão
Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Select-Object NextHop
```

Anote:
- **IP Atual**: (que você quer tornar fixo)
- **Máscara de Sub-rede**: Geralmente 255.255.255.0 (ou /24)
- **Gateway Padrão**: Geralmente 192.168.16.1 ou 192.168.16.254
- **DNS**: Use 8.8.8.8 (Google) ou o DNS da empresa

## 📝 Script Automatizado para Configurar IP Estático

Criei um script para facilitar. Execute no PowerShell como **ADMINISTRADOR**:

```powershell
cd \\wsl$\Ubuntu\home\jonathanbarbosa\dev\SDC-Transcreve
.\setup-static-ip.ps1
```

Este script irá:
1. Detectar automaticamente o adaptador ativo
2. Mostrar a configuração atual
3. Perguntar qual IP você quer fixar
4. Configurar IP estático automaticamente
5. Testar a conexão

## ✅ Verificar se o IP Está Fixo

Após configurar, execute:

```powershell
# Ver configuração
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' }

# Verificar se está como "Manual" (estático) ou "Dhcp" (dinâmico)
Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, @{Name='Type';Expression={$_.NetIPv4Interface.Dhcp}}
```

Se mostrar `Dhcp = Disabled`, o IP está fixo! ✅

## 🔄 Reverter para DHCP (Se Necessário)

Se precisar voltar para IP dinâmico:

```powershell
$adapter = "Wi-Fi"  # Trocar pelo nome correto

# Remover IP estático
Remove-NetIPAddress -InterfaceAlias $adapter -Confirm:$false
Remove-NetRoute -InterfaceAlias $adapter -Confirm:$false

# Habilitar DHCP
Set-NetIPInterface -InterfaceAlias $adapter -Dhcp Enabled
Set-DnsClientServerAddress -InterfaceAlias $adapter -ResetServerAddresses

# Renovar IP
ipconfig /renew
```

## 📋 Checklist Final

Após configurar IP estático:

- [ ] IP configurado: 192.168.16.50 (ou o escolhido)
- [ ] Gateway configurado corretamente
- [ ] DNS configurado (8.8.8.8)
- [ ] Teste de ping funcionando: `ping 8.8.8.8`
- [ ] Teste de DNS funcionando: `ping google.com`
- [ ] Navegação na internet funcionando
- [ ] Arquivo `.env` atualizado com o IP fixo
- [ ] Port forwarding configurado: `setup-network.ps1`
- [ ] Aplicação funcionando localmente: `http://localhost`
- [ ] Aplicação acessível na rede: `http://192.168.16.50`
- [ ] Auto-start configurado: `setup-autostart.ps1`

## 🎯 Configuração Recomendada Final

Para máquina servidor de transcrição:

```
IP: 192.168.16.50
Máscara: 255.255.255.0
Gateway: 192.168.16.1
DNS 1: 8.8.8.8
DNS 2: 8.8.4.4
```

Compartilhe com os usuários:
```
Sistema de Transcrição SDC
URL: http://192.168.16.50
```

Simples, fácil de lembrar, e não muda mais! 🎉
