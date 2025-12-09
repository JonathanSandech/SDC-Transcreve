# Template DOCX - Estrutura Requerida

## Arquivo: Modelo_Ata_Padrão.docx

Este documento descreve a estrutura necessária do template DOCX para o Sistema Gerador de Atas.

## Estrutura do Template

O template deve conter **4 tabelas** na seguinte ordem:

### Tabela 1: Cabeçalho da Reunião
**Estrutura:**
```
| LOCAL | DATA E HORÁRIO | CONVOCADO POR |
|-------|----------------|---------------|
| [dados] | [dados] | [dados] |
```

**Campos preenchidos:**
- Coluna 0: Local da reunião
- Coluna 1: Data e horário
- Coluna 2: Nome do convocador

### Tabela 2: Participantes
**Estrutura:**
```
| Nº | PARTICIPANTES |
|----|---------------|
| (linhas serão adicionadas dinamicamente) |
```

**Campos preenchidos dinamicamente:**
- Coluna 0: Número do participante
- Coluna 1: Nome do participante

**Nota:** As linhas de dados serão criadas automaticamente. Mantenha apenas o cabeçalho.

---

### Parágrafo: Objetivo
Após a Tabela 2 (Participantes), deve haver um parágrafo contendo o objetivo da reunião.
Este parágrafo será substituído automaticamente.

---

### Tabela 3: Pontos Discutidos
**Estrutura:**
```
| ITEM | TÓPICOS |
|------|---------|
| (linhas serão adicionadas dinamicamente) |
```

**Campos preenchidos dinamicamente:**
- Coluna 0: Item/número
- Coluna 1: Descrição do tópico discutido

---

### Tabela 4: Próximos Passos
**Estrutura:**
```
| ITEM | AÇÕES | RESPONSÁVEL | DATA |
|------|-------|-------------|------|
| (linhas serão adicionadas dinamicamente) |
```

**Campos preenchidos dinamicamente:**
- Coluna 0: Item/número
- Coluna 1: Descrição da ação
- Coluna 2: Nome do responsável
- Coluna 3: Data de conclusão

---

## Como Criar o Template

1. Abra o Microsoft Word
2. Crie um documento novo
3. Insira a Tabela 1 (Cabeçalho)
4. Insira a Tabela 2 (Participantes)
5. Adicione um parágrafo após a Tabela 2 para o objetivo
6. Insira a Tabela 3 (Pontos Discutidos)
7. Insira a Tabela 4 (Próximos Passos)
8. Formate as tabelas (bordas, cores, fontes) conforme padrão desejado
9. Salve como: **Modelo_Ata_Padrão.docx**
10. Coloque o arquivo na pasta `templates/`

## Exemplo de Template Mínimo

```
TABELA 1 - CABEÇALHO:
┌─────────────────────────────────────────────────────────┐
│ LOCAL │ DATA E HORÁRIO │ CONVOCADO POR                 │
├───────┼────────────────┼────────────────────────────────┤
│       │                │                                │
└─────────────────────────────────────────────────────────┘

TABELA 2 - PARTICIPANTES:
┌──────────────────────────────────┐
│ Nº │ PARTICIPANTES              │
├────┼────────────────────────────┤
└──────────────────────────────────┘

PARÁGRAFO - OBJETIVO:
[Objetivo da reunião]

TABELA 3 - PONTOS DISCUTIDOS:
┌──────────────────────────────────┐
│ ITEM │ TÓPICOS                  │
├──────┼──────────────────────────┤
└──────────────────────────────────┘

TABELA 4 - PRÓXIMOS PASSOS:
┌─────────────────────────────────────────────────────────┐
│ ITEM │ AÇÕES │ RESPONSÁVEL │ DATA                      │
├──────┼───────┼─────────────┼───────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

## Notas Importantes

- Todas as 4 tabelas devem existir no template
- A ordem das tabelas deve ser mantida
- Os cabeçalhos das tabelas serão preservados
- As linhas de dados (exceto Tabela 1) serão criadas dinamicamente
- Formatação (bordas, cores, fontes) do template será mantida
- Encoding UTF-8 é usado para preservar caracteres especiais PT-BR

## Validação

Para validar se o template está correto, execute:
```bash
python docx_filler.py
```

O script de exemplo tentará preencher o template e reportará erros se houver.
