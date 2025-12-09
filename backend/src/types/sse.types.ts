/**
 * Tipos para Server-Sent Events (SSE)
 */

/**
 * Dados completos enviados via SSE para o cliente
 */
export interface SSEProgressData {
  // Progresso da transcrição (0-100)
  progress: number;

  // Mensagem de status atual
  status: string;

  // Tempo estimado restante em segundos (opcional)
  estimatedTime?: number;

  // Timestamp da atualização
  timestamp: string;

  // Informações da fila (opcionais)
  queuePosition?: number;  // Posição atual na fila (1-based)
  queueLength?: number;    // Tamanho total da fila
  isQueued?: boolean;      // true = aguardando na fila, false = processando
}
