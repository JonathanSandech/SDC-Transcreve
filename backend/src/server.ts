import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import transcriptionRoutes from './routes/transcription.routes';
import gerarAtaRoutes from './routes/gerarAta.routes';
import { sseRouter } from './routes/sse.routes';
import { errorHandler } from './middleware/error.middleware';
import { FileService } from './services/file.service';
import { testConnection } from './config/database';
import logger from './utils/logger';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares globais
// Configurar CORS para múltiplas origens
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

logger.info('🌐 Allowed CORS origins', { allowedOrigins });

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, curl)
    if (!origin) return callback(null, true);

    // Permitir todas as origens se CORS_ORIGIN contém *
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Verificar se origin está na lista
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`⚠️  Blocked by CORS: ${origin}`, { allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Aumentar limite para suportar arquivos até 2GB
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));

// Garantir que pasta de uploads existe
const fileService = new FileService();
fileService.ensureUploadDir().catch((error) => {
  logger.error('❌ Error ensuring upload directory exists', { error: error.message, stack: error.stack });
});

// Rotas
app.use('/api/transcription', transcriptionRoutes);

// Rotas de geração de ata
app.use('/api', gerarAtaRoutes);

// SSE para progresso em tempo real
app.use('/api', sseRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Transcription API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/transcription/upload',
      status: 'GET /api/transcription/:id',
      download: 'GET /api/transcription/:id/download',
      delete: 'DELETE /api/transcription/:id',
    },
  });
});

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
  try {
    // Testar conexão com banco
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('⚠️  Warning: Database connection failed. Check your .env configuration.');
    }

    const server = app.listen(PORT, () => {
      logger.info('🚀 Server started', {
        port: PORT,
        endpoints: {
          upload: `POST http://localhost:${PORT}/api/transcription/upload`,
          status: `GET http://localhost:${PORT}/api/transcription/:id`,
          download: `GET http://localhost:${PORT}/api/transcription/:id/download`,
          delete: `DELETE http://localhost:${PORT}/api/transcription/:id`
        }
      });
    });

    // Configurar timeout para uploads grandes (60 minutos padrão)
    const serverTimeout = parseInt(process.env.SERVER_TIMEOUT || '3600000'); // 60 minutos em ms
    server.timeout = serverTimeout;
    server.headersTimeout = serverTimeout;
    server.requestTimeout = serverTimeout;
    logger.info(`⏱️  Server timeout configured: ${serverTimeout / 1000 / 60} minutes`);

    // Limpeza automática de arquivos antigos (executa a cada 6 horas)
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    setInterval(() => {
      logger.info('🧹 Running automatic file cleanup...', { uploadDir });
      fileService.cleanupOldFiles(uploadDir, 24); // Deleta arquivos com mais de 24h
    }, 6 * 60 * 60 * 1000); // A cada 6 horas

    logger.info('🧹 Automatic file cleanup enabled (runs every 6 hours)');
  } catch (error: any) {
    logger.error('❌ Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();