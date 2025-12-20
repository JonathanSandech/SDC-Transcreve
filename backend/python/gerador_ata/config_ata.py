"""
Configurações do Sistema Gerador de Atas
SDC-Ata-Generator
"""

import os

# Diretórios
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

# Arquivo template
TEMPLATE_FILE = 'Modelo_Ata_Padrão.docx'
TEMPLATE_PATH = os.path.join(TEMPLATE_DIR, TEMPLATE_FILE)

# API
API_HOST = '0.0.0.0'
API_PORT = 5000
DEBUG = False

# Encoding
DEFAULT_ENCODING = 'utf-8'

# Logs
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_FILE = os.path.join(LOG_DIR, 'api.log')

# Segurança
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

# CORS
CORS_ORIGINS = '*'  # Em produção, especificar domínios confiáveis

# ========== OLLAMA CONFIG ==========
# Quando rodando no Docker, usar o nome do serviço "ollama"
# Quando rodando localmente, usar "localhost"
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma2:9b')
OLLAMA_TIMEOUT = int(os.getenv('OLLAMA_TIMEOUT', '600'))  # 10 minutos (suporta reuniões longas de +1h)
OLLAMA_TEMPERATURE = float(os.getenv('OLLAMA_TEMPERATURE', '0.1'))
OLLAMA_MAX_TOKENS = int(os.getenv('OLLAMA_MAX_TOKENS', '6000'))
OLLAMA_TOP_P = float(os.getenv('OLLAMA_TOP_P', '0.8')) 

# CORS - Adicionar origem do frontend Transcreve
CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    '*'
]
