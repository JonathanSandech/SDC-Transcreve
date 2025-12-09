import { Router, Request, Response } from 'express';
import { SSEProgressData } from '../types/sse.types';

export const sseRouter = Router();

// Armazena conexões SSE ativas (transcriptionId → Response)
const clients = new Map<string, Response>();

/**
 * Endpoint SSE para acompanhar progresso de transcrição em tempo real
 * URL: GET /api/transcription/:id/progress
 */
sseRouter.get('/transcription/:id/progress', (req: Request, res: Response) => {
  const { id } = req.params;

  // Configurar headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Registrar cliente
  clients.set(id, res);
  console.log(`📡 SSE client connected for transcription ${id}`);

  // Heartbeat para manter conexão viva
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 15000);

  // Cleanup ao desconectar
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(id);
    console.log(`📡 SSE client disconnected for transcription ${id}`);
  });
});

/**
 * Função helper para enviar atualizações de progresso
 */
export function sendProgress(
  id: string,
  progress: number,
  status: string,
  estimatedTime?: number,
  queueData?: { position?: number; length?: number; isQueued?: boolean }
) {
  const client = clients.get(id);
  if (client) {
    const data: SSEProgressData = {
      progress: Math.min(100, Math.max(0, progress)),
      status,
      estimatedTime,
      timestamp: new Date().toISOString(),
      // Dados de fila (opcionais)
      ...(queueData?.position !== undefined && { queuePosition: queueData.position }),
      ...(queueData?.length !== undefined && { queueLength: queueData.length }),
      ...(queueData?.isQueued !== undefined && { isQueued: queueData.isQueued })
    };
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Função helper para enviar atualizações de posição na fila
 */
export function sendQueueUpdate(
  id: string,
  position: number,
  queueLength: number
) {
  const client = clients.get(id);
  if (client) {
    const data: SSEProgressData = {
      progress: 0,
      status: position > 0
        ? `Aguardando na fila - Posição ${position} de ${queueLength}`
        : 'Iniciando processamento...',
      timestamp: new Date().toISOString(),
      queuePosition: position,
      queueLength: queueLength,
      isQueued: position > 0
    };
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Função para fechar conexão SSE
 */
export function closeSSEConnection(id: string) {
  const client = clients.get(id);
  if (client) {
    client.end();
    clients.delete(id);
  }
}
