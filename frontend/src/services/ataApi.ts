import axios from 'axios';

// Usar a mesma API URL do backend principal (Node.js)
const API_URL = import.meta.env.VITE_API_URL || '';

const ataApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 900000, // 15 minutos (suporta reuniões longas de +1h)
});

export interface AtaFormData {
  participantes: string;
  dataHora: string;
  local: string;
  convocadoPor: string;
  transcricao: string;
}

export interface AtaResponse {
  status: string;
  mensagem: string;
  arquivo: string;
  download_url: string;
  dados_extraidos: {
    objetivo: string;
    num_pontos: number;
    num_proximos_passos: number;
  };
  timestamp: string;
}

export const gerarAtaCompleta = async (data: AtaFormData): Promise<AtaResponse> => {
  const response = await ataApi.post('/gerar-ata', {
    participantes: data.participantes,
    dataHora: data.dataHora,
    local: data.local,
    convocadoPor: data.convocadoPor,
    transcricao: data.transcricao
  });
  return response.data;
};

export const checkOllamaStatus = async (): Promise<{
  status: string;
  modelo_configurado: string;
  modelos_disponiveis: string[];
  url: string;
}> => {
  const response = await ataApi.get('/ollama/status');
  return response.data;
};

export const getDownloadUrl = (downloadPath: string): string => {
  return `${API_URL}${downloadPath}`;
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    await ataApi.get('/health');
    return true;
  } catch {
    return false;
  }
};
