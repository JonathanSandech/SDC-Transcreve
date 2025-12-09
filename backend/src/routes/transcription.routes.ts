import { Router } from 'express';
import { TranscriptionController } from '../controllers/transcription.controller';
import { upload } from '../middleware/upload.middleware';
import { queueService } from '../services/queue.service';

const router = Router();
const controller = new TranscriptionController();

// POST /api/transcription/upload - Upload de vídeo
router.post('/upload', upload.single('video'), (req, res) => controller.upload(req, res));

// GET /api/transcription/:id - Buscar status/resultado
router.get('/:id', (req, res) => controller.getStatus(req, res));

// GET /api/transcription/:id/download - Download do TXT
router.get('/:id/download', (req, res) => controller.download(req, res));

// DELETE /api/transcription/:id - Deletar transcrição
router.delete('/:id', (req, res) => controller.delete(req, res));

// GET /api/transcription/queue/status - Verificar status da fila
router.get('/queue/status', (req, res) => {
  const status = queueService.getStatus();
  res.json({
    success: true,
    ...status
  });
});

// GET /api/transcription/queue/position/:id - Verificar posição específica
router.get('/queue/position/:id', (req, res) => {
  const { id } = req.params;
  const position = queueService.getPosition(id);
  const queueLength = queueService.getQueueLength();

  res.json({
    success: true,
    transcriptionId: id,
    position,
    queueLength,
    inQueue: position > 0
  });
});

export default router;
