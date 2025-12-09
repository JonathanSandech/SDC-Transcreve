import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Mapeamento de erros conhecidos para mensagens amigáveis
const ERROR_MESSAGES: Record<string, { message: string; suggestion?: string; status: number }> = {
  'LIMIT_FILE_SIZE': {
    message: 'Arquivo muito grande. O tamanho máximo permitido é 2GB.',
    suggestion: 'Tente comprimir o arquivo ou dividir em partes menores.',
    status: 413
  },
  'LIMIT_UNEXPECTED_FILE': {
    message: 'Tipo de arquivo não permitido.',
    suggestion: 'Envie arquivos de vídeo (MP4, AVI, MOV, MKV, WebM) ou áudio (MP3, WAV, M4A, FLAC, OGG).',
    status: 415
  },
  'ENOMEM': {
    message: 'Memória insuficiente no servidor.',
    suggestion: 'Tente usar um modelo de transcrição menor (small ou medium) ou divida o arquivo.',
    status: 507
  },
  'Stack overflow': {
    message: 'Erro de memória durante o processamento.',
    suggestion: 'O arquivo é muito grande para o modelo selecionado. Use um modelo menor ou divida o arquivo.',
    status: 507
  },
  'timeout': {
    message: 'Tempo limite de processamento excedido.',
    suggestion: 'O arquivo é muito longo. Tente dividir em partes menores (máx. 2 horas por arquivo).',
    status: 408
  },
  'ECONNRESET': {
    message: 'Conexão interrompida durante o upload.',
    suggestion: 'Verifique sua conexão de internet e tente novamente.',
    status: 499
  },
  'ENOENT': {
    message: 'Arquivo não encontrado.',
    suggestion: 'O arquivo pode ter sido removido ou movido. Tente fazer o upload novamente.',
    status: 404
  }
};

// Função para identificar e formatar erro
const formatError = (err: any): { message: string; suggestion?: string; status: number } => {
  const errorString = err.message || err.toString();

  // Procurar por erro conhecido
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (errorString.includes(key) || err.code === key) {
      return value;
    }
  }

  // Erros de validação de arquivo
  if (errorString.includes('Invalid file') || errorString.includes('not supported')) {
    return {
      message: 'Formato de arquivo não suportado.',
      suggestion: 'Envie arquivos de vídeo (MP4, AVI, MOV, MKV, WebM) ou áudio (MP3, WAV, M4A, FLAC, OGG).',
      status: 415
    };
  }

  // Erros de GPU/CUDA
  if (errorString.includes('CUDA') || errorString.includes('GPU')) {
    return {
      message: 'Erro no processamento com GPU.',
      suggestion: 'O servidor está processando em modo CPU. O processamento pode ser mais lento.',
      status: 500
    };
  }

  // Erro genérico
  return {
    message: errorString || 'Erro interno do servidor.',
    status: 500
  };
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('❌ Error:', err);

  // Erros do Multer (upload)
  if (err instanceof multer.MulterError) {
    const formattedError = ERROR_MESSAGES[err.code] || { message: err.message, status: 400 };
    return res.status(formattedError.status).json({
      error: formattedError.message,
      suggestion: formattedError.suggestion,
      code: err.code
    });
  }

  // Erros customizados com status
  if (err.status) {
    return res.status(err.status).json({
      error: err.message || 'Ocorreu um erro.',
      code: err.code
    });
  }

  // Formatar erro desconhecido
  const formatted = formatError(err);
  res.status(formatted.status).json({
    error: formatted.message,
    suggestion: formatted.suggestion
  });
};
