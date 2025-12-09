# Plan2.md - Correções de Formatação do SDC-Ata-Generator
**Metodologia PREVC - Fase de Correção**
**Projeto:** SDC-Ata-Generator
**Data:** 14/11/2025
**Responsável:** Jonathan Silva

---

## 🔍 ANÁLISE DOS PROBLEMAS

### Problema 1: Objetivo Incorreto (CRÍTICO)

**Atual:**
- Título "Objetivo" foi substituído pelo texto do objetivo
- Placeholder "[Descrição breve...]" permaneceu no documento
- Título aparece como "1 DEMONSTRAR E PADRONIZAR..." em vez de "1 Objetivo"

**Esperado:**
- Manter "1 Objetivo" como título
- Substituir "[Descrição breve...]" pelo texto real

### Problema 2: Formatação das Tabelas 1 e 2 (VISUAL)

**Observação nas imagens:**
- ❌ Tabela 1 (Participantes): Linhas sem formatação visual (sem bordas definidas, sem cor alternada)
- ❌ Tabela 2 (Pontos): Linhas sem formatação visual
- ✅ Tabela 3 (Próximos Passos): Formatação perfeita com bordas e cores alternadas

**Causa:** O `table.add_row()` do python-docx **não copia estilos** das linhas existentes. Cada nova linha vem "limpa" sem formatação.

### Análise das Tabelas

✅ **Tabela 0 (Cabeçalho):** Preenchida corretamente
❌ **Tabela 1 (Participantes):** Dados OK, mas formatação perdida
❌ **Tabela 2 (Pontos):** Dados OK, mas formatação perdida  
✅ **Tabela 3 (Próximos Passos):** Perfeita - manteve formatação

---

## 📋 PLANEJAMENTO DAS CORREÇÕES

### Correção 1: Substituição do Objetivo (CRÍTICO)

**Problema:** O código está substituindo o parágrafo errado.

**Causa provável no docx_filler.py:**
```python
# CÓDIGO INCORRETO (provável)
for i, para in enumerate(doc.paragraphs):
    if 'Objetivo' in para.text or 'objetivo' in para.text:
        para.text = dados['objetivo']  # Substitui o título!
```

**Solução:**
```python
# CÓDIGO CORRETO
for i, para in enumerate(doc.paragraphs):
    if '[Descrição breve do objetivo da reunião.]' in para.text:
        para.text = para.text.replace('[Descrição breve do objetivo da reunião.]', dados['objetivo'])
        break
```

**OU usando índice fixo:**
```python
# CÓDIGO CORRETO (alternativa mais segura)
# P2 é o parágrafo com o placeholder do objetivo
doc.paragraphs[2].text = dados['objetivo']
```

### Correção 2: Preservar Formatação das Células (MELHORIA)

**Problema:** Ao adicionar novas linhas nas tabelas, a formatação (fonte, tamanho, alinhamento) pode não ser copiada.

**Solução:** Copiar estilo da linha modelo antes de removê-la.

```python
def copiar_formatacao_celula(celula_origem, celula_destino):
    """Copia formatação de uma célula para outra"""
    for para_dest in celula_destino.paragraphs:
        for para_orig in celula_origem.paragraphs:
            para_dest.style = para_orig.style
            para_dest.alignment = para_orig.alignment
            if para_orig.runs and para_dest.runs:
                para_dest.runs[0].font.name = para_orig.runs[0].font.name
                para_dest.runs[0].font.size = para_orig.runs[0].font.size
                para_dest.runs[0].bold = para_orig.runs[0].bold
            break
```

### Correção 3: Manter Bordas das Tabelas (MELHORIA)

**Problema:** Novas linhas podem não herdar bordas da tabela.

**Solução:** As bordas são propriedade da tabela, não das linhas. Verificar se `table.style` está sendo preservado.

---

## ⚙️ IMPLEMENTAÇÃO

### Arquivo: docx_filler.py

#### Estratégia Principal: Copiar Formatação da Linha Modelo

O problema é que `table.add_row()` cria linhas sem formatação. A solução é **copiar o XML da linha modelo** para cada nova linha, preservando cores, bordas e estilos.

#### Passo 1: Função para Copiar Linha com Formatação

```python
from copy import deepcopy
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def _copiar_linha_com_formatacao(tabela, linha_modelo_idx=1):
    """
    Copia uma linha existente preservando toda a formatação (cores, bordas, estilos)
    
    Args:
        tabela: Objeto Table
        linha_modelo_idx: Índice da linha a ser copiada (default: 1, primeira após cabeçalho)
    
    Returns:
        Nova linha adicionada com formatação copiada
    """
    # Obter a linha modelo
    linha_modelo = tabela.rows[linha_modelo_idx]
    
    # Copiar o elemento XML da linha
    tr = linha_modelo._tr
    new_tr = deepcopy(tr)
    
    # Adicionar a nova linha à tabela
    tabela._tbl.append(new_tr)
    
    # Retornar a nova linha como objeto Row
    return tabela.rows[-1]
```

#### Passo 2: Função para Preencher Tabela Preservando Formatação

```python
def _preencher_tabela_preservando_formato(tabela, dados_lista, campos):
    """
    Preenche tabela copiando a formatação da linha modelo para cada nova linha
    
    Args:
        tabela: Objeto Table do python-docx
        dados_lista: Lista de dicionários com os dados
        campos: Lista de nomes dos campos na ordem das colunas
    """
    if not dados_lista or len(tabela.rows) < 2:
        return
    
    # A linha 1 (índice 1) é o modelo - vamos copiá-la para cada item de dados
    linha_modelo_idx = 1
    
    # Para cada item de dados, copiar a linha modelo e preencher
    for i, item in enumerate(dados_lista):
        if i == 0:
            # Primeira entrada: usar a linha modelo existente
            linha = tabela.rows[linha_modelo_idx]
        else:
            # Demais entradas: copiar linha modelo
            linha = _copiar_linha_com_formatacao(tabela, linha_modelo_idx)
        
        # Preencher células
        for idx, campo in enumerate(campos):
            if idx < len(linha.cells):
                valor = str(item.get(campo, ''))
                linha.cells[idx].text = valor
```

#### Passo 3: Código Completo Corrigido

```python
"""
DOCX Filler - Preenche template Word com dados da ata
SDC-Ata-Generator v2.0.0 - Correção de Formatação
"""

from docx import Document
from docx.shared import Pt
from copy import deepcopy
import os
from config import TEMPLATE_PATH, OUTPUT_DIR


def preencher_ata(dados: dict, nome_arquivo: str) -> str:
    """
    Preenche o template DOCX com os dados da ata
    
    Args:
        dados: Dicionário com dados parseados do TOON
        nome_arquivo: Nome do arquivo de saída (sem extensão)
        
    Returns:
        Caminho completo do arquivo gerado
    """
    
    # Carregar template
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Template não encontrado: {TEMPLATE_PATH}")
    
    doc = Document(TEMPLATE_PATH)
    
    # ========================================
    # 1. PREENCHER TABELA 0 - CABEÇALHO
    # ========================================
    tabela_cabecalho = doc.tables[0]
    tabela_cabecalho.rows[1].cells[0].text = dados.get('local', '')
    tabela_cabecalho.rows[1].cells[1].text = dados.get('data_horario', '')
    tabela_cabecalho.rows[1].cells[2].text = dados.get('convocado_por', '')
    
    # ========================================
    # 2. SUBSTITUIR OBJETIVO (CORREÇÃO CRÍTICA)
    # ========================================
    placeholder_objetivo = '[Descrição breve do objetivo da reunião.]'
    
    for para in doc.paragraphs:
        if placeholder_objetivo in para.text:
            # Substituir apenas o placeholder, mantendo resto do parágrafo
            para.text = para.text.replace(placeholder_objetivo, dados.get('objetivo', ''))
            break
    
    # ========================================
    # 3. PREENCHER TABELA 1 - PARTICIPANTES
    # ========================================
    tabela_participantes = doc.tables[1]
    _preencher_tabela_preservando_formato(
        tabela_participantes, 
        dados.get('participantes', []),
        ['num', 'nome']
    )
    
    # ========================================
    # 4. PREENCHER TABELA 2 - PONTOS DISCUTIDOS
    # ========================================
    tabela_pontos = doc.tables[2]
    _preencher_tabela_preservando_formato(
        tabela_pontos,
        dados.get('pontos', []),
        ['item', 'topico']
    )
    
    # ========================================
    # 5. PREENCHER TABELA 3 - PRÓXIMOS PASSOS
    # ========================================
    tabela_passos = doc.tables[3]
    _preencher_tabela_preservando_formato(
        tabela_passos,
        dados.get('proximos_passos', []),
        ['item', 'acao', 'responsavel', 'data']
    )
    
    # ========================================
    # 6. SALVAR DOCUMENTO
    # ========================================
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if not nome_arquivo.endswith('.docx'):
        nome_arquivo += '.docx'
    
    caminho_saida = os.path.join(OUTPUT_DIR, nome_arquivo)
    doc.save(caminho_saida)
    
    return caminho_saida


def _copiar_linha_com_formatacao(tabela, linha_modelo_idx=1):
    """
    Copia uma linha existente preservando toda a formatação
    
    Args:
        tabela: Objeto Table
        linha_modelo_idx: Índice da linha modelo
    
    Returns:
        Nova linha com formatação copiada
    """
    linha_modelo = tabela.rows[linha_modelo_idx]
    tr = linha_modelo._tr
    new_tr = deepcopy(tr)
    tabela._tbl.append(new_tr)
    return tabela.rows[-1]


def _preencher_tabela_preservando_formato(tabela, dados_lista, campos):
    """
    Preenche tabela copiando formatação da linha modelo
    
    Args:
        tabela: Objeto Table
        dados_lista: Lista de dicionários
        campos: Lista de campos na ordem das colunas
    """
    if not dados_lista or len(tabela.rows) < 2:
        return
    
    linha_modelo_idx = 1
    
    for i, item in enumerate(dados_lista):
        if i == 0:
            # Primeira entrada: usar linha modelo existente
            linha = tabela.rows[linha_modelo_idx]
        else:
            # Demais: copiar linha modelo com formatação
            linha = _copiar_linha_com_formatacao(tabela, linha_modelo_idx)
        
        # Preencher células
        for idx, campo in enumerate(campos):
            if idx < len(linha.cells):
                linha.cells[idx].text = str(item.get(campo, ''))


# Teste
if __name__ == '__main__':
    dados_teste = {
        'local': 'Sala de Testes',
        'data_horario': '14/11/2025 - 10:00 às 11:00',
        'convocado_por': 'Jonathan Silva',
        'objetivo': 'Testar o sistema de geração de atas automatizado',
        'participantes': [
            {'num': '1', 'nome': 'Jonathan Silva'},
            {'num': '2', 'nome': 'Eduardo Asth'}
        ],
        'pontos': [
            {'item': '1', 'topico': 'Primeiro ponto de teste'},
            {'item': '2', 'topico': 'Segundo ponto de teste'}
        ],
        'proximos_passos': [
            {'item': '1', 'acao': 'Ação de teste', 'responsavel': 'Jonathan', 'data': '20/11/2025'}
        ]
    }
    
    try:
        arquivo = preencher_ata(dados_teste, 'Ata_Teste')
        print(f"Ata gerada: {arquivo}")
    except Exception as e:
        print(f"Erro: {e}")
```

---

## ✅ VALIDAÇÃO

### Testes a Realizar

1. **Teste de Objetivo:**
   - [ ] Título "Objetivo" permanece como Heading 1
   - [ ] Placeholder substituído pelo texto do objetivo
   - [ ] Formatação do parágrafo preservada

2. **Teste de Tabelas:**
   - [ ] Linha modelo removida de todas as tabelas
   - [ ] Dados inseridos corretamente
   - [ ] Bordas das tabelas preservadas
   - [ ] Alinhamento das células correto

3. **Teste de Encoding:**
   - [ ] Caracteres especiais (á, é, í, ó, ú, ç, ã, õ) preservados
   - [ ] Arquivo salvo em UTF-8

4. **Teste Integrado:**
   - [ ] API recebe TOON
   - [ ] Parser converte para JSON
   - [ ] Filler gera documento
   - [ ] Download funciona

---

## 🔄 CONFIRMAÇÃO

### Checklist Final

- [ ] Código do docx_filler.py atualizado
- [ ] Testes realizados com sucesso
- [ ] Ata gerada com formatação correta
- [ ] Commit no repositório
- [ ] Push para GitHub

### Resultado Esperado

Após aplicar as correções:

```
MODELO ORIGINAL               →    ATA GERADA CORRETA
P1: "Objetivo"                →    P1: "Objetivo"
P2: "[Placeholder]"           →    P2: "Texto do objetivo real..."
[Tabela Participantes vazia]  →    [Tabela com 3 participantes]
[Tabela Pontos vazia]         →    [Tabela com 7 pontos]
[Tabela Ações vazia]          →    [Tabela com 4 ações]
```

---

## 📝 NOTAS ADICIONAIS

### Possíveis Melhorias Futuras

1. **Copiar formatação completa** das células modelo para novas linhas
2. **Validar template** antes de processar (verificar se todas as tabelas existem)
3. **Log detalhado** de cada substituição realizada
4. **Preservar estilos** de fonte, cor e tamanho

### Arquivos Afetados

- `docx_filler.py` - Correção principal
- `app.py` - Nenhuma alteração necessária
- `toon_parser.py` - Já corrigido anteriormente

---

**Versão:** 2.0.0  
**Status:** Pronto para Implementação ✅  
**Próximo Passo:** Aplicar correções no docx_filler.py
