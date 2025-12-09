# Plan3.md - Correção da Ordem dos Elementos
**Metodologia PREVC - Fase de Correção Final**
**Projeto:** SDC-Ata-Generator
**Data:** 14/11/2025
**Versão:** 2.1.0

---

## 🎯 OBJETIVO

Corrigir a ordem dos elementos no documento gerado. Atualmente a tabela de Participantes está aparecendo **depois** do Objetivo, quando deveria vir **antes**.

---

## 🔍 PROBLEMA

### Ordem Atual (INCORRETA)
```
1. Tabela Cabeçalho
2. Parágrafo "Objetivo"
3. Parágrafo com texto do objetivo ← Objetivo veio primeiro
4. Tabela Participantes ← Deveria vir antes
5. ...
```

### Ordem Esperada (CORRETA)
```
1. Tabela Cabeçalho
2. Tabela Participantes ← Primeiro
3. Parágrafo "Objetivo"
4. Parágrafo com texto do objetivo ← Depois
5. ...
```

### Causa Raiz

O método `tabela._tbl.append(new_tr)` adiciona linhas no **final do body do documento**, não dentro da tabela. Isso move a tabela para o final, alterando a ordem dos elementos.

---

## ⚙️ CORREÇÃO

### Arquivo: docx_filler.py

**Localizar a função `_preencher_tabela_preservando_formato` e substituir por:**

```python
def _preencher_tabela_preservando_formato(tabela, dados_lista, campos):
    """
    Preenche tabela copiando formatação da linha modelo
    Usa addnext() para manter a ordem dos elementos no documento
    
    Args:
        tabela: Objeto Table
        dados_lista: Lista de dicionários
        campos: Lista de campos na ordem das colunas
    """
    if not dados_lista or len(tabela.rows) < 2:
        return
    
    # Primeira entrada: preencher linha modelo existente (índice 1)
    linha = tabela.rows[1]
    for idx, campo in enumerate(campos):
        if idx < len(linha.cells):
            linha.cells[idx].text = str(dados_lista[0].get(campo, ''))
    
    # Demais entradas: copiar linha modelo e inserir após a última
    ultima_linha_idx = 1
    for i in range(1, len(dados_lista)):
        item = dados_lista[i]
        
        # Copiar XML da linha modelo (sempre linha 1)
        tr_modelo = tabela.rows[1]._tr
        new_tr = deepcopy(tr_modelo)
        
        # CORREÇÃO: Inserir APÓS a última linha preenchida (mantém ordem)
        # addnext() insere imediatamente após, sem mover a tabela
        tabela.rows[ultima_linha_idx]._tr.addnext(new_tr)
        
        # Atualizar índice e preencher nova linha
        ultima_linha_idx += 1
        nova_linha = tabela.rows[ultima_linha_idx]
        
        for idx, campo in enumerate(campos):
            if idx < len(nova_linha.cells):
                nova_linha.cells[idx].text = str(item.get(campo, ''))
```

### Diferença Chave

**ANTES (move a tabela):**
```python
tabela._tbl.append(new_tr)
```

**DEPOIS (mantém posição):**
```python
tabela.rows[ultima_linha_idx]._tr.addnext(new_tr)
```

---

## ✅ VALIDAÇÃO

Após aplicar a correção:

- [ ] Tabela Cabeçalho aparece primeiro
- [ ] Tabela Participantes aparece **ANTES** do Objetivo
- [ ] Parágrafo "Objetivo" com título
- [ ] Parágrafo com texto do objetivo
- [ ] Tabela Pontos Discutidos
- [ ] Tabela Próximos Passos
- [ ] Formatação das tabelas mantida
- [ ] Ordem 100% igual ao modelo original

---

## 🚀 PASSOS PARA APLICAR

1. Abrir `docx_filler.py`
2. Localizar função `_preencher_tabela_preservando_formato`
3. Substituir o código conforme acima
4. Salvar arquivo
5. Reiniciar servidor
6. Testar com mesma requisição

---

**Status:** Pronto para implementação ✅
