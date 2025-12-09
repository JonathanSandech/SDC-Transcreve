import { TranscriptionService } from './transcription.service';
import { sendQueueUpdate } from '../routes/sse.routes';

interface QueueItem {
  id: string;
  filePath: string;
  modelSize: string;
  addedAt: Date;
}

export class QueueService {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxConcurrent = 1; // GPU RTX 3060: 1 transcrição por vez (ajustar se necessário)
  private currentlyProcessing = 0;

  /**
   * Adiciona transcrição à fila
   */
  addToQueue(id: string, filePath: string, modelSize: string): number {
    this.queue.push({
      id,
      filePath,
      modelSize,
      addedAt: new Date()
    });

    const position = this.queue.length;
    const queueLength = this.getQueueLength();
    console.log(`📋 Added to queue: ${id} (position: ${position}, total: ${queueLength})`);

    // Enviar posição inicial via SSE
    sendQueueUpdate(id, position, queueLength);

    // Iniciar processamento se não estiver rodando
    if (!this.processing || this.currentlyProcessing < this.maxConcurrent) {
      this.processQueue();
    }

    return position;
  }

  /**
   * Retorna posição de uma transcrição na fila
   */
  getPosition(id: string): number {
    const index = this.queue.findIndex(item => item.id === id);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Retorna tamanho atual da fila
   */
  getQueueLength(): number {
    return this.queue.length + this.currentlyProcessing;
  }

  /**
   * Retorna quantas transcrições estão sendo processadas
   */
  getCurrentlyProcessing(): number {
    return this.currentlyProcessing;
  }

  /**
   * Processa fila de transcrições
   */
  private async processQueue() {
    if (this.queue.length === 0) {
      if (this.currentlyProcessing === 0) {
        this.processing = false;
        console.log('✅ Queue is empty, processing stopped');
      }
      return;
    }

    if (this.currentlyProcessing >= this.maxConcurrent) {
      console.log(`⏸️ Max concurrent limit reached (${this.maxConcurrent}), waiting...`);
      return;
    }

    this.processing = true;
    const item = this.queue.shift()!;
    this.currentlyProcessing++;

    console.log(`🎬 Processing from queue: ${item.id} (${this.currentlyProcessing}/${this.maxConcurrent} slots used)`);

    // Notificar item que está começando a processar (position = 0, isQueued = false)
    sendQueueUpdate(item.id, 0, this.getQueueLength());

    // Notificar todos os outros itens sobre mudança de posição
    this.notifyQueuePositionChanges();

    try {
      const transcriptionService = new TranscriptionService();
      await transcriptionService.processTranscription(
        item.id,
        item.filePath,
        item.modelSize
      );
    } catch (error) {
      console.error(`❌ Queue processing error for ${item.id}:`, error);
    } finally {
      this.currentlyProcessing--;
      console.log(`✅ Finished processing: ${item.id} (${this.currentlyProcessing}/${this.maxConcurrent} slots used)`);

      // Notificar mudanças de posição após término
      this.notifyQueuePositionChanges();

      // Processar próximo item
      this.processQueue();
    }
  }

  /**
   * Notifica todos os itens na fila sobre mudança de posição
   */
  private notifyQueuePositionChanges() {
    const queueLength = this.getQueueLength();
    this.queue.forEach((item, index) => {
      const position = index + 1; // 1-based position
      sendQueueUpdate(item.id, position, queueLength);
      console.log(`📢 Notified ${item.id}: position ${position} of ${queueLength}`);
    });
  }

  /**
   * Retorna status da fila (para debugging/monitoring)
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      currentlyProcessing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent,
      nextItems: this.queue.slice(0, 5).map(item => ({
        id: item.id,
        modelSize: item.modelSize,
        addedAt: item.addedAt
      }))
    };
  }
}

// Singleton - uma única instância da fila
export const queueService = new QueueService();
