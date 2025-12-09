"""
Prompts otimizados para geração de atas via Ollama
SDC-Ata-Generator - Modelo: Qwen3:8b

ATUALIZADO: 
- Prompt otimizado para conteúdo mais detalhado e rico
- Usa chave SIMPLES {campo} (compatível com parser)
- Instruções claras para evitar vírgulas em descrições
"""


def criar_prompt_geracao_ata(participantes: str, data_hora: str, local: str,
                              convocado_por: str, transcricao: str) -> str:
    """
    Cria prompt otimizado para gerar ata em formato TOON
    
    Melhorias implementadas:
    - Conteúdo mais detalhado e contextualizado
    - Formato de chaves compatível com parser
    - Instruções para evitar vírgulas problemáticas
    - Exemplos claros de qualidade esperada
    """

    # Formatar data_hora para DD/MM/YYYY - HH:MM
    data_formatada = data_hora
    if 'T' in data_hora:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(data_hora.replace('Z', ''))
            data_formatada = dt.strftime("%d/%m/%Y - %H:%M")
        except:
            pass

    # Separar participantes para contagem
    lista_participantes = [p.strip() for p in participantes.split(',')]
    num_participantes = len(lista_participantes)
    
    # Montar lista formatada de participantes
    participantes_formatados = '\n'.join([
        f"{i+1},{nome}" for i, nome in enumerate(lista_participantes)
    ])

    prompt = f'''Você é um especialista em redigir atas de reuniões corporativas detalhadas e profissionais.

Sua tarefa é analisar a transcrição abaixo e gerar uma ata estruturada no formato TOON.

═══════════════════════════════════════════════════════════
DADOS DA REUNIÃO (USE EXATAMENTE COMO FORNECIDOS)
═══════════════════════════════════════════════════════════

Local: {local}
Data e Hora: {data_formatada}
Convocado por: {convocado_por}
Participantes: {participantes}

═══════════════════════════════════════════════════════════
TRANSCRIÇÃO DA REUNIÃO
═══════════════════════════════════════════════════════════

{transcricao}

═══════════════════════════════════════════════════════════
INSTRUÇÕES DE EXTRAÇÃO DETALHADA
═══════════════════════════════════════════════════════════

1. OBJETIVO
   - Uma frase clara e objetiva resumindo o propósito principal da reunião
   - Deve responder: "Por que esta reunião foi convocada?"

2. PONTOS DISCUTIDOS (IMPORTANTE: Seja detalhado e use VOZ ATIVA!)
   
   Cada ponto deve ser uma frase COMPLETA e RICA em detalhes contendo:
   - O QUE foi discutido
   - CONTEXTO ou justificativa
   - DETALHES técnicos mencionados (nomes de processos, valores, materiais, etc.)
   
   ESTILO DE ESCRITA - USE VOZ ATIVA DIRETA:
   
   ❌ PROIBIDO (voz passiva repetitiva):
   "Foi discutido o processo..."
   "Foi analisada a possibilidade..."
   "Foi abordada a integração..."
   
   ✅ CORRETO (voz ativa direta - VARIE os inícios):
   "O processo de produção do Rain Cap utiliza vazamento em molde..."
   "A migração para processo de injeção requer avaliação de investimento..."
   "A integração de QR Code depende do envolvimento da equipe de engenharia..."
   "Tiago apresentou o método atual de fabricação que consiste em..."
   "A equipe identificou a necessidade de revisar o fluxo de trabalho..."
   
   FORMAS DE INICIAR OS PONTOS (varie entre elas):
   - Começar com o SUJEITO: "O processo...", "A equipe...", "O componente..."
   - Começar com o NOME da pessoa: "Tiago explicou que...", "Matheus questionou..."
   - Começar com AÇÃO: "Identificou-se que...", "Definiu-se que..."
   - Começar com CONTEXTO: "Em relação ao QR Code...", "Quanto à produção..."
   
   IMPORTANTE: NÃO use vírgulas dentro da descrição do ponto. Use conectores como "que", "onde", "sendo", "resultando", "considerando".

3. PRÓXIMOS PASSOS
   - Ações concretas identificadas na transcrição
   - Responsável: DEVE ser alguém da lista de Participantes fornecida
   - Data: Use DD/MM/YYYY se mencionada explicitamente, caso contrário use "A definir"
   
   IMPORTANTE: NÃO use vírgulas dentro da descrição da ação. Use conectores.

═══════════════════════════════════════════════════════════
FORMATO DE SAÍDA OBRIGATÓRIO (TOON)
═══════════════════════════════════════════════════════════

Retorne EXATAMENTE neste formato (uma linha por campo):

local: {local}
data_horario: {data_formatada}
convocado_por: {convocado_por}
objetivo: [extrair da transcrição - frase clara e objetiva]

participantes[{num_participantes}]{{num,nome}}:
{participantes_formatados}

pontos[N]{{item,topico}}:
1,[frase detalhada do primeiro ponto SEM vírgulas internas]
2,[frase detalhada do segundo ponto SEM vírgulas internas]
3,[frase detalhada do terceiro ponto SEM vírgulas internas]

proximos_passos[N]{{item,acao,responsavel,data}}:
1,[descrição da ação SEM vírgulas],[Nome do Responsável],[DD/MM/YYYY ou A definir]
2,[descrição da ação SEM vírgulas],[Nome do Responsável],[DD/MM/YYYY ou A definir]

═══════════════════════════════════════════════════════════
REGRAS CRÍTICAS
═══════════════════════════════════════════════════════════

FORMATO:
✓ Use chave SIMPLES: {{num,nome}} (não use chave dupla)
✓ Substitua [N] pelo número real de itens (ex: pontos[5])
✓ Cada campo em uma linha separada
✓ NÃO use markdown (sem ```)
✓ NÃO adicione texto explicativo antes ou depois

PARTICIPANTES:
✓ Use APENAS os nomes listados em "Participantes" acima
✓ NÃO adicione outras pessoas mencionadas na transcrição
✓ A seção participantes já está formatada acima - copie exatamente

CONTEÚDO:
✓ Extraia objetivo e pontos SOMENTE da transcrição
✓ Seja DETALHADO nos pontos - inclua contexto e informações técnicas
✓ Para próximos passos, responsável DEVE estar na lista de Participantes
✓ NÃO invente datas - use "A definir" se não foi mencionada

VÍRGULAS:
✓ NÃO use vírgulas dentro de descrições de pontos ou ações
✓ Vírgulas são usadas APENAS como separador de campos
✓ Use conectores: "que", "onde", "sendo", "através de", "por meio de"

═══════════════════════════════════════════════════════════
EXEMPLO DE SAÍDA CORRETA
═══════════════════════════════════════════════════════════

local: Teams
data_horario: 21/11/2025 - 14:00
convocado_por: Paulo Silva
objetivo: Avaliar processo de produção do componente Cap e definir estratégias de escalabilidade para atender demanda crescente

participantes[3]{{num,nome}}:
1,Paulo Silva
2,Maria Santos
3,João Costa

pontos[3]{{item,topico}}:
1,O processo atual de produção do Cap utiliza método de vazamento em molde de silicone de platina resultando em peças flexíveis e resistentes adequadas para volumes de produção de baixa a média escala
2,A migração para processo de injeção seria viável apenas em cenários de alta demanda sendo necessário investimento significativo em moldes metálicos e equipamentos específicos
3,A integração de QR Code nos produtos requer envolvimento da equipe de engenharia de sistemas que será contatada após o retorno do responsável técnico

proximos_passos[2]{{item,acao,responsavel,data}}:
1,Elaborar estudo de viabilidade técnica e financeira para processo de injeção,Maria Santos,A definir
2,Agendar reunião com equipe de engenharia de sistemas para discutir implementação do QR Code,Paulo Silva,28/11/2025

═══════════════════════════════════════════════════════════

GERE A ATA AGORA (inicie com "local:"):
'''

    return prompt


def criar_prompt_correcao_toon(toon_invalido: str, erro: str) -> str:
    """
    Prompt para corrigir TOON inválido
    """

    return f'''O formato TOON abaixo está com erro e precisa ser corrigido.

TOON COM ERRO:
{toon_invalido}

ERRO ENCONTRADO:
{erro}

INSTRUÇÕES DE CORREÇÃO:

1. Mantenha TODOS os dados e conteúdo originais
2. Corrija APENAS a estrutura/formato
3. Cada campo deve estar em linha separada
4. Arrays devem ter formato: nome[N]{{campos}}:
5. Use chave SIMPLES {{campos}} (não dupla)
6. Substitua [N] pelo número real de itens
7. Garanta numeração sequencial (1, 2, 3...)
8. NÃO use vírgulas dentro de descrições
9. NÃO adicione ``` ou explicações

FORMATO ESPERADO:

local: [valor]
data_horario: [valor]
convocado_por: [valor]
objetivo: [valor]

participantes[N]{{num,nome}}:
1,[nome]
2,[nome]

pontos[N]{{item,topico}}:
1,[descrição sem vírgulas]
2,[descrição sem vírgulas]

proximos_passos[N]{{item,acao,responsavel,data}}:
1,[ação sem vírgulas],[responsável],[data]
2,[ação sem vírgulas],[responsável],[data]

Retorne APENAS o TOON corrigido:'''