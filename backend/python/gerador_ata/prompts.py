"""
Prompts para geração de atas via Ollama usando fluxo em duas fases.

FASE 1 - EXTRAÇÃO:
- Extrai, de forma fiel, os tópicos da transcrição (sem inferir, sem inventar).
- Saída: lista numerada simples de itens textuais.

FASE 2 - CONSTRUÇÃO:
- Recebe a lista extraída da FASE 1.
- Monta a ATA em formato TOON, com estilo corporativo, mais rica e organizada.
- Não acessa a transcrição diretamente, apenas a lista.

FIXER - CORREÇÃO TOON:
- Ajusta apenas formato, sem mudar conteúdo.

Modelo recomendado: gemma2:9b
"""

from datetime import datetime


# =========================================================
# FASE 1: EXTRAÇÃO DETALHADA E SEM REDUNDÂNCIA
# =========================================================

def criar_prompt_extracao(transcricao: str) -> str:
    """
    Extrai TODOS os tópicos relevantes presentes na transcrição,
    com alta riqueza, sem inventar nada, sem interpretar,
    sem perder detalhes e sem repetir conteúdo.
    
    Esta versão:
    - Evita redundância
    - Consolida temas repetidos
    - Garante nível elevado de detalhamento
    - Separa temas distintos em tópicos distintos
    - Produz entre 8 e 20 tópicos reais
    """

    return f"""
Você está em MODO DE EXTRAÇÃO DETALHADA, SEM REDUNDÂNCIA E SEM ALUCINAÇÃO.

OBJETIVO:
Extrair da transcrição TODOS os tópicos relevantes discutidos, de forma fiel e completa,
mesmo quando aparecem de forma fragmentada, indireta ou distribuída ao longo da reunião.

NÃO É PARA GERAR UMA ATA.
NÃO É PARA GERAR TEXTO FORMAL.
NÃO É PARA RESUMIR DEMAIS.

É APENAS PARA LISTAR TÓPICOS, EM LINHAS SEPARADAS.

------------------------------------------------------------
REGRAS ABSOLUTAS (OBRIGATÓRIO)
------------------------------------------------------------
1. NÃO invente informações.
2. NÃO adicione novos sistemas, processos, materiais ou nomes.
3. NÃO interprete além do que a transcrição realmente diz.
4. NÃO reescreva como se fosse uma ata ou relatório.
5. NÃO produza frases longas demais — seja direto e fiel.
6. NÃO liste tópicos repetidos com palavras diferentes.

------------------------------------------------------------
REGRAS DE AGRUPAMENTO E CONSOLIDAÇÃO (DEDUPLICAÇÃO)
------------------------------------------------------------
• Se o mesmo tema é mencionado várias vezes → transforme em UM único tópico.
• Agrupe falas fragmentadas que tratam do mesmo assunto.
• NÃO repita tópicos como:
    – falar com William
    – William está de férias
    – contato com William após retorno
  → isso deve virar 1 único tópico consolidando todas as informações.
• NÃO gere vários tópicos sobre “Semana do Conhecimento”.
• NÃO gere vários tópicos sobre “injeção”, “produção”, “resinas”, etc.
• Cada tópico deve representar UMA IDEIA ÚNICA E COMPLETA.

------------------------------------------------------------
NÍVEL DE DETALHE EXIGIDO
------------------------------------------------------------
• Capture todas as ideias técnicas, dúvidas, comparações, decisões e alternativas.
• Inclua:
  – materiais citados
  – processos discutidos
  – dúvidas levantadas
  – riscos mencionados
  – comparações técnicas
  – necessidades identificadas
  – encaminhamentos citados
• Quanto mais específica a discussão, mais detalhado o tópico deve ser.
• Uma reunião de 20–30 minutos normalmente produz **8 a 20 tópicos únicos**.

------------------------------------------------------------
FORMATO DE SAÍDA (OBRIGATÓRIO)
------------------------------------------------------------
Uma lista numerada simples, assim:

1. [tópico extraído e consolidado]
2. [tópico extraído e consolidado]
3. [tópico extraído e consolidado]
...
N. [tópico]

• Sem markdown.
• Sem texto antes ou depois.
• Sem explicações.
• Sem frases enormes.
• Cada linha = 1 tópico único.

------------------------------------------------------------
TRANSCRIÇÃO
------------------------------------------------------------
<INICIO_TRANSCRICAO>
{transcricao}
<FIM_TRANSCRICAO>

Agora EXTRAIA entre 8 e 20 TÓPICOS, TODOS distintos,
TODOS fiéis à transcrição, SEM redundância e SEM inventar nada.
"""




# =========================================================
# FASE 2: CONSTRUÇÃO DA ATA EM FORMATO TOON
# =========================================================

def _formatar_data(data_hora: str) -> str:
    """
    Tenta formatar data_hora ISO em DD/MM/YYYY - HH:MM.
    Se não conseguir, retorna como veio.
    """
    if "T" in data_hora:
        try:
            dt = datetime.fromisoformat(data_hora.replace("Z", ""))
            return dt.strftime("%d/%m/%Y - %H:%M")
        except Exception:
            return data_hora
    return data_hora


def criar_prompt_construcao(lista_extraida: str,
                            participantes: str,
                            data_hora: str,
                            local: str,
                            convocado_por: str) -> str:
    """
    Constrói a ata em formato TOON usando a lista extraída pela Fase 1.
    A Fase 2 consolida temas repetidos, separa conteúdos em categorias 
    corretas e gera uma ata rica, organizada e sem redundância.
    """

    data_formatada = _formatar_data(data_hora)

    lista_participantes = [p.strip() for p in participantes.split(",") if p.strip()]
    num_participantes = len(lista_participantes)
    participantes_formatados = "\n".join(
        f"{i+1},{nome}" for i, nome in enumerate(lista_participantes)
    )

    return f"""
Você está em MODO DE CONSTRUÇÃO DE ATA PROFISSIONAL.

IMPORTANTE:
- Você NÃO tem acesso à transcrição original.
- Você deve trabalhar SOMENTE a partir da LISTA EXTRAÍDA.
- Sua tarefa é consolidar os itens, separar corretamente os conteúdos
  e gerar uma ata clara, formal e sem redundância.

============================================================
REGRAS DE CONSOLIDAÇÃO (OBRIGATÓRIO)
============================================================
• Agrupe itens repetidos ou semelhantes em UM único tópico.
• Combine temas correlacionados de forma clara e objetiva.
• Cada tópico deve representar um assunto distinto.
• Remova redundâncias, variações da mesma ideia e fragmentações.
• Não transforme cada item da lista em um tópico separado.
• Uma lista longa deve gerar entre 4 e 8 tópicos finais.
• Temas semelhantes devem ser agrupados no mesmo tópico.
• Não crie tópicos divergentes para microvariações do mesmo tema.

============================================================
REGRAS DE CLASSIFICAÇÃO:
O QUE É "PONTO" E O QUE É "PRÓXIMO PASSO"
============================================================

1) PONTOS DISCUTIDOS  
Devem incluir apenas temas debatidos, analisados ou explicados
durante a reunião. Considerar assuntos como:
- análises técnicas
- comparações
- métodos e processos
- esclarecimentos
- decisões tomadas
- contexto e entendimento técnico
- avaliações de alternativas

NÃO devem incluir:
- solicitações futuras
- agendamentos
- atividades pendentes
- monitoramentos
- contato com pessoas
- qualquer tipo de execução futura

Itens com esse caráter NÃO podem aparecer nos pontos.

2) PRÓXIMOS PASSOS  
Devem incluir exclusivamente ações futuras mencionadas na lista.
Considerar:
- agendamentos
- acompanhamentos
- tarefas delegadas
- solicitações
- contatos
- validações
- atividades futuras em geral

Qualquer item da lista que envolva ação futura DEVE ser colocado aqui.

============================================================
REGRAS DO ESTILO DE REDAÇÃO
============================================================
• Escreva frases claras, formais e profissionais.
• Não cite quem falou o quê.
• Não use vírgulas dentro das descrições.
• Use conectores adequados, como:
  "que", "onde", "de forma que", "considerando", "resultando em".
• Não invente nenhum conteúdo que não esteja na lista extraída.
• Produza conteúdo enriquecido apenas com base no que está presente.

============================================================
METAS DE QUALIDADE
============================================================
A ata deve:
✓ Ser mais organizada que a lista  
✓ Consolidar temas corretamente  
✓ Evitar redundâncias  
✓ Manter clareza e coerência  
✓ Conter 4 a 8 pontos finais  
✓ Conter próximos passos fiéis à lista  
✓ Ter tom corporativo e técnico  

============================================================
LISTA EXTRAÍDA (BASE ÚNICA PARA A ATA)
============================================================
{lista_extraida}

============================================================
FORMATO FINAL TOON (OBRIGATÓRIO)
============================================================

local: {local}
data_horario: {data_formatada}
convocado_por: {convocado_por}
objetivo: [gerar frase clara e objetiva sem vírgulas]

participantes[{num_participantes}]{{num,nome}}:
{participantes_formatados}

pontos[N]{{item,topico}}:
1,[ponto consolidado SEM vírgulas]
2,[ponto consolidado SEM vírgulas]
...
N,[ponto consolidado SEM vírgulas]

proximos_passos[N]{{item,acao,responsavel,data}}:
1,[ação SEM vírgulas],[responsável da lista],[A definir]
2,[ação SEM vírgulas],[responsável da lista],[A definir]
...
N,[ação SEM vírgulas],[responsável da lista],[A definir]

AGORA CONSTRUA A ATA CONSOLIDADA SEGUINDO EXATAMENTE AS REGRAS
E INICIE A RESPOSTA COM:
local:
"""



    return prompt


# =========================================================
# FASE 3: CORREÇÃO DE FORMATO TOON (FIXER)
# =========================================================

def criar_prompt_correcao_toon(toon_invalido: str, erro: str) -> str:
    """
    Prompt para corrigir TOON inválido.
    Mantém o conteúdo original e ajusta apenas o formato/layout.
    """

    return f"""
Você está em MODO DE CORREÇÃO DE FORMATO TOON.

NÃO reescreva conteúdo.
NÃO adicione nada.
NÃO interprete.
NÃO altere o texto interno de cada campo.
Apenas ajuste a estrutura para o formato TOON correto.

TOON COM ERRO:
{toon_invalido}

ERRO IDENTIFICADO:
{erro}

INSTRUÇÕES:
1. Mantenha TODOS os valores de texto como estão (não resuma, não melhore, não modifique).
2. Ajuste apenas:
   - quebras de linha
   - numeração
   - cabeçalhos de blocos
   - sintaxe de arrays (pontos[N]{{item,topico}}, etc.)
3. Cada campo deve ficar em linha separada.
4. Arrays devem ter o formato:

   participantes[N]{{num,nome}}:
   1,[nome]
   2,[nome]

   pontos[N]{{item,topico}}:
   1,[texto]
   2,[texto]

   proximos_passos[N]{{item,acao,responsavel,data}}:
   1,[acao],[responsavel],[data]
   2,[acao],[responsavel],[data]

5. Use chave SIMPLES {{campos}} (não use chave dupla).
6. Substitua [N] pela quantidade real de itens em cada bloco.
7. Garanta numeração sequencial: 1, 2, 3, ... sem pular números.
8. NÃO adicione ``` markdown, nem explicações antes ou depois do TOON.

FORMATO FINAL ESPERADO:

local: [valor]
data_horario: [valor]
convocado_por: [valor]
objetivo: [valor]

participantes[N]{{num,nome}}:
1,[nome]
2,[nome]

pontos[N]{{item,topico}}:
1,[descrição]
2,[descrição]

proximos_passos[N]{{item,acao,responsavel,data}}:
1,[ação],[responsável],[data]
2,[ação],[responsável],[data]

AGORA RETORNE APENAS O TOON CORRIGIDO, INICIANDO COM:
local:
"""


# =========================================================
# FIM DO ARQUIVO
# =========================================================
