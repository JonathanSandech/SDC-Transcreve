import axios, { AxiosError } from 'axios';
import { Transcription, UploadResponse, ModelSize, QueuePositionResponse } from '../types';
import { API_URL } from '../config/api';

const API_BASE_URL = `${API_URL}/api`;

// Instância padrão para requisições gerais
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 1 minuto para requisições normais
  headers: {
    'Content-Type': 'application/json',
  },
});

// Instância dedicada para uploads grandes
const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3600000, // 60 minutos para uploads grandes
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  // Não definir Content-Type aqui - deixar axios definir com boundary correto
});

// Erros transitórios que justificam retry
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) {
    // Erros de rede (timeout, conexão recusada, etc.)
    return error.code === 'ECONNABORTED' ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.message.includes('timeout') ||
           error.message.includes('Network Error');
  }
  // Erros de servidor que podem ser transitórios
  const status = error.response.status;
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
};

// Função de delay para retry
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const transcriptionApi = {
  /**
   * Upload de vídeo para transcrição com retry automático
   */
  upload: async (
    file: File,
    modelSize: ModelSize,
    onUploadProgress?: (progress: number) => void
  ): Promise<UploadResponse> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos entre tentativas

    const formData = new FormData();
    formData.append('video', file);
    formData.append('model_size', modelSize);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await uploadApi.post('/transcription/upload', formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onUploadProgress?.(percentCompleted);
            }
          },
        });
        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error) && isRetryableError(error) && attempt < MAX_RETRIES) {
          console.warn(`Upload falhou (tentativa ${attempt}/${MAX_RETRIES}). Tentando novamente em ${RETRY_DELAY/1000}s...`);
          onUploadProgress?.(0); // Reset progress para nova tentativa
          await delay(RETRY_DELAY * attempt); // Backoff exponencial
          continue;
        }

        // Erro não recuperável ou última tentativa
        throw error;
      }
    }

    throw lastError;
  },

  /**
   * Busca status de uma transcrição
   */
  getStatus: async (id: string): Promise<Transcription> => {
    const response = await api.get(`/transcription/${id}`);
    return response.data;
  },

  /**
   * Download da transcrição como TXT
   */
  download: async (id: string, filename: string): Promise<void> => {
    const response = await api.get(`/transcription/${id}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Busca posição na fila de uma transcrição
   */
  getQueuePosition: async (id: string): Promise<QueuePositionResponse> => {
    const response = await api.get(`/transcription/queue/position/${id}`);
    return response.data;
  },

  /**
   * Deleta uma transcrição
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/transcription/${id}`);
  },
};
