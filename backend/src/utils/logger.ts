import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logsDir = path.join(__dirname, '../../logs');

// Formato consistente para todos os logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    // Se tiver stack trace, incluir
    const stackTrace = stack ? `\n${stack}` : '';

    // Se tiver metadata adicional, incluir como JSON
    const metadataStr = Object.keys(metadata).length > 0
      ? ` | ${JSON.stringify(metadata)}`
      : '';

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metadataStr}${stackTrace}`;
  })
);

// Transport para console (desenvolvimento)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    logFormat
  )
});

// Transport para arquivo UNIFICADO (produção)
// TODOS os logs (info, warn, error) vão para service-output.log
const unifiedFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'service-output-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',  // Rotacionar a cada 20MB
  maxFiles: '14d', // Manter 14 dias
  format: logFormat
});

// Transport separado APENAS para erros críticos (backup)
// Exit code 3221226505 vai para critical-errors.log E service-output.log
const criticalErrorTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'critical-errors-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '10m',
  maxFiles: '30d',
  format: logFormat
});

// Logger singleton
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    unifiedFileTransport,
    criticalErrorTransport,
    ...(process.env.NODE_ENV !== 'production' ? [consoleTransport] : [])
  ],
  exitOnError: false
});

// Helper para logs com contexto
export const logWithContext = (level: string, message: string, context?: object) => {
  logger.log(level, message, context);
};

// Export default
export default logger;
