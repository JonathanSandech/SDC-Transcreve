"""
Script Python para gerar ata de reunião
Recebe dados via stdin (JSON) e retorna resultado via stdout
"""

import sys
import json
import os
import logging
from datetime import datetime

# Adicionar o diretório atual ao path para imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Imports (sempre usar imports absolutos quando executado como script)
import config_ata
from toon_parser import parse_toon, TOONParserError
from docx_filler import fill_docx_from_data, DOCXFillerError
from ollama_service import ollama_service, OllamaServiceError


# Configurar encoding UTF-8 para Windows
import codecs
if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

logger = logging.getLogger(__name__)


def gerar_ata_completa(data):
    """
    Gera ata completa a partir de dados brutos

    Args:
        data: Dict com campos participantes, dataHora, local, convocadoPor, transcricao

    Returns:
        Dict com status, mensagem, arquivo, etc.
    """
    try:
        # Validar campos obrigatórios
        campos_obrigatorios = ['participantes', 'dataHora', 'local', 'convocadoPor', 'transcricao']
        campos_faltando = [campo for campo in campos_obrigatorios if not data.get(campo)]

        if campos_faltando:
            return {
                'status': 'erro',
                'mensagem': f"Campos obrigatórios faltando: {', '.join(campos_faltando)}"
            }

        participantes = data['participantes']
        data_hora = data['dataHora']
        local = data['local']
        convocado_por = data['convocadoPor']
        transcricao = data['transcricao']
        nome_arquivo = data.get('nomeArquivo', None)

        if len(transcricao.strip()) < 50:
            return {
                'status': 'erro',
                'mensagem': 'Transcrição muito curta (mínimo 50 caracteres)'
            }

        logger.info(f"Iniciando geração de ata completa via Ollama")
        logger.info(f"Participantes: {participantes}")
        logger.info(f"Transcrição: {len(transcricao)} caracteres")

        # Verificar se Ollama está disponível
        if not ollama_service.check_health():
            logger.error("Ollama não está disponível")
            return {
                'status': 'erro',
                'mensagem': 'Serviço de IA (Ollama) não está disponível',
                'detalhes': 'Verifique se o Ollama está rodando: ollama serve'
            }

        # Gerar TOON usando Ollama
        try:
            toon_string, dados_estruturados = ollama_service.gerar_toon_from_dados(
                participantes=participantes,
                data_hora=data_hora,
                local=local,
                convocado_por=convocado_por,
                transcricao=transcricao
            )
            logger.info("TOON gerado com sucesso via Ollama")
        except OllamaServiceError as e:
            logger.error(f"Erro no Ollama: {str(e)}")
            return {
                'status': 'erro',
                'mensagem': 'Erro ao processar transcrição com IA',
                'detalhes': str(e)
            }

        # Gerar documento DOCX
        try:
            output_path = fill_docx_from_data(dados_estruturados, nome_arquivo)
            output_filename = os.path.basename(output_path)
            logger.info(f"Documento gerado: {output_filename}")
        except DOCXFillerError as e:
            logger.error(f"Erro ao gerar DOCX: {str(e)}")
            return {
                'status': 'erro',
                'mensagem': 'Erro ao gerar documento DOCX',
                'detalhes': str(e)
            }

        return {
            'status': 'sucesso',
            'mensagem': 'Ata gerada com sucesso',
            'arquivo': output_filename,
            'download_url': f'/api/download-ata/{output_filename}',
            'dados_extraidos': {
                'objetivo': dados_estruturados.get('objetivo', ''),
                'num_pontos': len(dados_estruturados.get('pontos', [])),
                'num_proximos_passos': len(dados_estruturados.get('proximos_passos', []))
            },
            'timestamp': datetime.now().isoformat()
        }

    except Exception as e:
        logger.exception("Erro inesperado ao gerar ata completa")
        return {
            'status': 'erro',
            'mensagem': 'Erro interno',
            'detalhes': str(e)
        }


def main():
    """Função principal - lê JSON do stdin e escreve resultado no stdout"""
    try:
        # Criar diretórios se não existirem
        os.makedirs(config_ata.OUTPUT_DIR, exist_ok=True)

        # Ler dados do stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)

        # Processar geração de ata
        result = gerar_ata_completa(data)

        # Retornar resultado como JSON no stdout
        print(json.dumps(result, ensure_ascii=False))

    except json.JSONDecodeError as e:
        error_result = {
            'status': 'erro',
            'mensagem': 'Erro ao decodificar JSON',
            'detalhes': str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

    except Exception as e:
        error_result = {
            'status': 'erro',
            'mensagem': 'Erro inesperado',
            'detalhes': str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
