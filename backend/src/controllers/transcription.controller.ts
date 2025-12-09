import { Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { TranscriptionService } from '../services/transcription.service';
import { FileService } from '../services/file.service';
import { queueService } from '../services/queue.service';

export class TranscriptionController {
  private dbService: DatabaseService;
  private transcriptionService: TranscriptionService;
  private fileService: FileService;

  constructor() {
    this.dbService = new DatabaseService();
    this.transcriptionService = new TranscriptionService();
    this.fileService = new FileService();
  }

  /**
   * Upload de vídeo e criação da transcrição
   */
  async upload(req: Request, res: Response): Promise<void> {
    try {
      console.log(`[UPLOAD START] Received request`);

      if (!req.file) {
        console.log('[UPLOAD FAIL] No file uploaded');
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const modelSize = (req.body.model_size || 'medium') as string;
      const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

      console.log(`[UPLOAD] File: ${filename}`);
      console.log(`[UPLOAD] Size: ${req.file.size} bytes (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[UPLOAD] Model: ${modelSize}`);
      console.log(`[UPLOAD] Path: ${req.file.path}`);

      console.log(`[UPLOAD] Creating database record...`);
      const id = await this.dbService.createTranscription({
        filename: filename,
        original_size: req.file.size,
        file_path: req.file.path,
        model_size: modelSize,
      });
      console.log(`[UPLOAD] ✅ Database record created: ${id}`);

      console.log(`[UPLOAD] Adding to queue...`);
      const queuePosition = queueService.addToQueue(id, req.file.path, modelSize);
      console.log(`[UPLOAD] ✅ Added to queue at position: ${queuePosition}`);

      console.log(`[UPLOAD SUCCESS] Sending response...`);
      res.status(202).json({
        success: true,
        transcriptionId: id,
        queuePosition,
        queueLength: queueService.getQueueLength(),
        message: queuePosition > 1
          ? `Adicionado à fila. Posição: ${queuePosition}`
          : 'Processando agora...'
      });
      console.log(`[UPLOAD SUCCESS] ✅ Response sent for ${id}`);
    } catch (error: any) {
      console.error('[UPLOAD ERROR] ❌ Error during upload:', error);
      console.error('[UPLOAD ERROR] Stack:', error.stack);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Busca status/resultado da transcrição
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const transcription = await this.dbService.getTranscription(id);

      if (!transcription) {
        res.status(404).json({ error: 'Transcription not found' });
        return;
      }

      res.json({
        id: transcription.id,
        filename: transcription.filename,
        status: transcription.status,
        transcription_text: transcription.transcription_text,
        processing_time_seconds: transcription.processing_time_seconds,
        error_message: transcription.error_message,
        created_at: transcription.created_at,
        completed_at: transcription.completed_at,
      });
    } catch (error: any) {
      console.error('Get status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Download da transcrição em TXT
   */
  async download(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const transcription = await this.dbService.getTranscription(id);

      if (!transcription || !transcription.transcription_text) {
        res.status(404).json({ error: 'Transcription not found or not ready' });
        return;
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${transcription.filename}.txt"`);
      res.send(transcription.transcription_text);
    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deleta uma transcrição
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const transcription = await this.dbService.getTranscription(id);

      if (transcription) {
        // Deleta arquivos se existirem
        await this.fileService.deleteTranscriptionFiles(
          transcription.file_path,
          transcription.audio_path
        );
      }

      await this.dbService.deleteTranscription(id);

      res.json({ message: 'Transcription deleted successfully' });
    } catch (error: any) {
      console.error('Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
