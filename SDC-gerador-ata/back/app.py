"""
API Flask - Sistema Gerador de Atas de Reunião
SDC-Ata-Generator
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from waitress import serve

import config
from toon_parser import parse_toon, TOONParserError
from docx_filler import fill_docx_from_data, DOCXFillerError
from ollama_service import ollama_service, OllamaServiceError


# Criar diretórios se não existirem
os.makedirs(config.OUTPUT_DIR, exist_ok=True)
os.makedirs(config.LOG_DIR, exist_ok=True)

# Configurar logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format=config.LOG_FORMAT,
    handlers=[
        logging.FileHandler(config.LOG_FILE, encoding=config.DEFAULT_ENCODING),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Criar aplicação Flask
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

# Habilitar CORS
CORS(app, origins=config.CORS_ORIGINS)


@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Endpoint de health check
    Verifica se a API está online e funcionando
    """
    return jsonify({
        'status': 'online',
        'versao': '1.0.0',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/gerar-ata', methods=['POST'])
def gerar_ata():
    """
    Endpoint principal para gerar ata de reunião

    Recebe dados em formato TOON e retorna documento DOCX gerado

    Body JSON:
    {
        "dados_toon": "string no formato TOON",
        "nome_arquivo": "nome_opcional.docx" (opcional)
    }
    """
    try:
        # Validar Content-Type
        if not request.is_json:
            logger.warning("Requisição sem Content-Type application/json")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Content-Type deve ser application/json'
            }), 400

        # Obter dados da requisição
        data = request.get_json()

        # Validar presença de dados_toon
        if 'dados_toon' not in data or not data['dados_toon']:
            logger.warning("Campo 'dados_toon' ausente ou vazio")
            return jsonify({
                'status': 'erro',
                'mensagem': "Campo 'dados_toon' é obrigatório"
            }), 400

        dados_toon = data['dados_toon']
        nome_arquivo = data.get('nome_arquivo', None)

        logger.info(f"Iniciando geração de ata. Arquivo: {nome_arquivo or 'auto'}")

        # Etapa 1: Parse TOON → JSON
        try:
            dados_estruturados = parse_toon(dados_toon)
            logger.info("Parse TOON realizado com sucesso")
        except TOONParserError as e:
            logger.error(f"Erro no parse TOON: {str(e)}")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Erro ao processar formato TOON',
                'detalhes': str(e)
            }), 400

        # Etapa 2: Preencher DOCX
        try:
            output_path = fill_docx_from_data(dados_estruturados, nome_arquivo)
            output_filename = os.path.basename(output_path)
            logger.info(f"Documento gerado com sucesso: {output_filename}")
        except DOCXFillerError as e:
            logger.error(f"Erro ao gerar DOCX: {str(e)}")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Erro ao gerar documento DOCX',
                'detalhes': str(e)
            }), 500

        # Retornar resposta de sucesso
        return jsonify({
            'status': 'sucesso',
            'mensagem': 'Ata gerada com sucesso',
            'arquivo': output_filename,
            'caminho': f'/api/download/{output_filename}',
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        logger.exception("Erro inesperado ao processar requisição")
        return jsonify({
            'status': 'erro',
            'mensagem': 'Erro interno do servidor',
            'detalhes': str(e) if config.DEBUG else 'Erro ao processar requisição'
        }), 500


@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Endpoint para download de arquivo gerado

    Args:
        filename: Nome do arquivo a ser baixado
    """
    try:
        # Sanitizar nome do arquivo (prevenir path traversal)
        filename = os.path.basename(filename)

        # Verificar se arquivo existe
        file_path = os.path.join(config.OUTPUT_DIR, filename)

        if not os.path.exists(file_path):
            logger.warning(f"Arquivo não encontrado: {filename}")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Arquivo não encontrado'
            }), 404

        logger.info(f"Download iniciado: {filename}")

        # Enviar arquivo
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        logger.exception("Erro ao fazer download do arquivo")
        return jsonify({
            'status': 'erro',
            'mensagem': 'Erro ao fazer download',
            'detalhes': str(e)
        }), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handler para requisições muito grandes"""
    logger.warning("Requisição excedeu tamanho máximo permitido")
    return jsonify({
        'status': 'erro',
        'mensagem': 'Requisição muito grande',
        'detalhes': f'Tamanho máximo permitido: {config.MAX_CONTENT_LENGTH / (1024*1024)}MB'
    }), 413


@app.errorhandler(404)
def not_found(error):
    """Handler para rotas não encontradas"""
    return jsonify({
        'status': 'erro',
        'mensagem': 'Endpoint não encontrado'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handler para erros internos"""
    logger.exception("Erro interno do servidor")
    return jsonify({
        'status': 'erro',
        'mensagem': 'Erro interno do servidor'
    }), 500


@app.route('/api/gerar-ata-completa', methods=['POST'])
def gerar_ata_completa_endpoint():
    """
    Endpoint completo: recebe dados brutos → IA gera estrutura → retorna DOCX
    """
    try:
        if not request.is_json:
            return jsonify({
                'status': 'erro',
                'mensagem': 'Content-Type deve ser application/json'
            }), 400

        data = request.get_json()

        campos_obrigatorios = ['participantes', 'dataHora', 'local', 'convocadoPor', 'transcricao']
        campos_faltando = [campo for campo in campos_obrigatorios if not data.get(campo)]

        if campos_faltando:
            return jsonify({
                'status': 'erro',
                'mensagem': f"Campos obrigatórios faltando: {', '.join(campos_faltando)}"
            }), 400

        participantes = data['participantes']
        data_hora = data['dataHora']
        local = data['local']
        convocado_por = data['convocadoPor']
        transcricao = data['transcricao']
        nome_arquivo = data.get('nomeArquivo', None)

        if len(transcricao.strip()) < 50:
            return jsonify({
                'status': 'erro',
                'mensagem': 'Transcrição muito curta (mínimo 50 caracteres)'
            }), 400

        logger.info(f"Iniciando geração de ata completa via Ollama")
        logger.info(f"Participantes: {participantes}")
        logger.info(f"Transcrição: {len(transcricao)} caracteres")

        if not ollama_service.check_health():
            logger.error("Ollama não está disponível")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Serviço de IA (Ollama) não está disponível',
                'detalhes': 'Verifique se o Ollama está rodando: ollama serve'
            }), 503

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
            return jsonify({
                'status': 'erro',
                'mensagem': 'Erro ao processar transcrição com IA',
                'detalhes': str(e)
            }), 500

        try:
            output_path = fill_docx_from_data(dados_estruturados, nome_arquivo)
            output_filename = os.path.basename(output_path)
            logger.info(f"Documento gerado: {output_filename}")
        except DOCXFillerError as e:
            logger.error(f"Erro ao gerar DOCX: {str(e)}")
            return jsonify({
                'status': 'erro',
                'mensagem': 'Erro ao gerar documento DOCX',
                'detalhes': str(e)
            }), 500

        return jsonify({
            'status': 'sucesso',
            'mensagem': 'Ata gerada com sucesso',
            'arquivo': output_filename,
            'download_url': f'/api/download/{output_filename}',
            'dados_extraidos': {
                'objetivo': dados_estruturados.get('objetivo', ''),
                'num_pontos': len(dados_estruturados.get('pontos', [])),
                'num_proximos_passos': len(dados_estruturados.get('proximos_passos', []))
            },
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        logger.exception("Erro inesperado ao gerar ata completa")
        return jsonify({
            'status': 'erro',
            'mensagem': 'Erro interno do servidor',
            'detalhes': str(e) if config.DEBUG else 'Erro ao processar requisição'
        }), 500


@app.route('/api/ollama/status', methods=['GET'])
def ollama_status():
    """Verifica status do serviço Ollama"""
    is_online = ollama_service.check_health()
    modelos = ollama_service.list_models() if is_online else []

    return jsonify({
        'status': 'online' if is_online else 'offline',
        'modelo_configurado': config.OLLAMA_MODEL,
        'modelos_disponiveis': modelos,
        'url': config.OLLAMA_BASE_URL
    }), 200 if is_online else 503


def main():
    """Função principal para iniciar o servidor"""
    logger.info("=" * 60)
    logger.info("SDC-Ata-Generator - API Flask")
    logger.info(f"Versão: 1.0.0")
    logger.info(f"Host: {config.API_HOST}")
    logger.info(f"Port: {config.API_PORT}")
    logger.info(f"Debug: {config.DEBUG}")
    logger.info(f"Template: {config.TEMPLATE_PATH}")
    logger.info("=" * 60)

    # Verificar se template existe
    if not os.path.exists(config.TEMPLATE_PATH):
        logger.error(f"ATENÇÃO: Template não encontrado em {config.TEMPLATE_PATH}")
        logger.error("Por favor, coloque o arquivo 'Modelo_Ata_Padrão.docx' na pasta 'templates'")
    else:
        logger.info(f"Template encontrado: {config.TEMPLATE_FILE}")

    if config.DEBUG:
        # Modo debug - Flask development server
        logger.warning("Rodando em modo DEBUG - apenas para desenvolvimento!")
        app.run(host=config.API_HOST, port=config.API_PORT, debug=True)
    else:
        # Modo produção - Waitress
        logger.info("Iniciando servidor em modo PRODUÇÃO com Waitress")
        serve(app, host=config.API_HOST, port=config.API_PORT, threads=4)


if __name__ == '__main__':
    main()
