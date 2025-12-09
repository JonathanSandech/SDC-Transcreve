// Configuração da API baseada no ambiente
export const API_URL = import.meta.env.VITE_API_URL || '';

// Mostrar URL apenas em desenvolvimento
if (import.meta.env.DEV) {
  console.log('🔗 API URL:', API_URL || '(caminho relativo)');
}
