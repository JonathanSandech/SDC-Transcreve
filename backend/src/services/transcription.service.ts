import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream, WriteStream } from 'fs';
import os from 'os';
import { DatabaseService } from './database.service';
import { FileService } from './file.service';
import { PythonTranscriptionResult } from '../types';
import { sendProgress, closeSSEConnection } from '../routes/sse.routes';
import logger from '../utils/logger';

export class TranscriptionService {
  private dbService: DatabaseService;
  private fileService: FileService;
  private readonly MAX_MEMORY_OUTPUT = 10_000_000; // 10MB max for in-memory processing
  private readonly MAX_STDERR_SIZE = 100 * 1024; // 100KB max para stderr

  constructor() {
    this.dbService = new DatabaseService();
    this.fileService = new FileService();
  }

  /**
   * Processa uma transcrição de forma assíncrona
   */
  async processTranscription(id: string, filePath: string, modelSize: string): Promise<void> {
    try {
      logger.info(`🎬 Starting transcription for ${id} with model ${modelSize}`);

      // Progresso inicial
      sendProgress(id, 5, 'Iniciando processamento...');
      await this.dbService.updateStatus(id, 'processing');

      // 1. Obter duração do arquivo
      const duration = await this.getAudioDuration(filePath);

      // Threshold: 40 minutos (2400 segundos)
      const V3_CHUNKING_THRESHOLD = 2400;

      if (duration > V3_CHUNKING_THRESHOLD) {
        logger.info(`⚠️ Long audio (${(duration/60).toFixed(1)}min) detected: using V3 multi-process chunking`);

        // 2. Extrair áudio se for vídeo
        sendProgress(id, 8, 'Preparando áudio...');
        const extractedAudio = await this.extractAudioFromVideo(filePath);
        const audioPath = extractedAudio || filePath;

        // 3. Dividir áudio em chunks
        sendProgress(id, 10, 'Dividindo áudio em chunks...');
        const chunks = await this.splitAudioIntoChunks(audioPath, 720); // 12 min chunks

        logger.info(`📊 Processing ${chunks.length} chunks with V3 architecture`);

        // 4. Processar cada chunk em processo Python separado
        const chunkResults: string[] = [];
        const startTime = Date.now();

        for (let i = 0; i < chunks.length; i++) {
          const chunkNum = i + 1;

          try {
            const result = await this.transcribeSingleChunkWithRetry(
              chunks[i],
              modelSize,
              chunkNum,
              chunks.length,
              id,
              2  // 2 retries em caso de OOM
            );

            chunkResults.push(result.text);

            // Deletar chunk após processar
            await fs.unlink(chunks[i]);

            // Delay para permitir GPU liberar memória completamente
            // 15 segundos: Windows GPU driver precisa 10-15s para cleanup completo
            if (i < chunks.length - 1) {  // Não esperar após último chunk
              logger.info(`⏳ Waiting 15s for GPU memory cleanup before next chunk...`);
              await new Promise(resolve => setTimeout(resolve, 15000)); // 15 segundos (Windows GPU cleanup)
              logger.info('🔄 Ready for next chunk');
            }

          } catch (chunkError: any) {
            logger.error(`❌ Error processing chunk ${chunkNum}:`, chunkError);
            throw new Error(`Failed to process chunk ${chunkNum}: ${chunkError.message}`);
          }
        }

        // 5. Concatenar resultados
        sendProgress(id, 95, 'Finalizando...');
        const fullText = chunkResults.join(' ');
        const processingTime = Math.floor((Date.now() - startTime) / 1000);

        logger.info(`✅ V3 chunking completed: ${fullText.length} characters`);

        // 6. Limpar diretório temporário
        try {
          const tempDir = path.dirname(chunks[0]);
          await fs.rmdir(tempDir);
        } catch (e: any) {
          logger.warn(`⚠️ Could not delete temp dir: ${e.message}`);
        }

        // 7. Deletar áudio extraído se foi criado
        if (extractedAudio) {
          await fs.unlink(extractedAudio);
        }

        // 8. Salvar no banco de dados
        await this.dbService.updateTranscription(id, fullText, processingTime);
        await this.dbService.updateStatus(id, 'completed');

        sendProgress(id, 100, 'Transcrição concluída!');
        logger.info(`✅ Transcription completed for ${id} in ${processingTime}s`);

        // 9. Deletar arquivo de vídeo original
        await this.fileService.deleteFile(filePath);

        // Fechar conexão SSE
        setTimeout(() => closeSSEConnection(id), 2000);

      } else {
        // Arquivos curtos: usar método direto (sem chunking)
        logger.info(`✅ Normal duration (${(duration/60).toFixed(1)}min): using direct transcription`);

        sendProgress(id, 10, 'Preparando transcrição...');

        // Executa script Python com timeout apropriado
        const timeout = this.calculateTimeoutFromDuration(duration);
        const result = await this.runPythonScript(filePath, modelSize, id, timeout);

      if (result.success && (result.text || result.text_file)) {
        sendProgress(id, 95, 'Salvando resultado...');

        // Obter texto (de memória ou arquivo)
        let transcriptionText = '';

        if (result.text_file) {
          // Ler transcrição do arquivo
          logger.info(`📂 Reading transcription from file: ${result.text_file}`);
          transcriptionText = await this.readTranscriptionFile(result.text_file);
          // Deletar arquivo JSON temporário
          await this.fileService.deleteFile(result.text_file);
        } else if (result.text) {
          transcriptionText = result.text;
        }

        // Salva resultado no banco
        await this.dbService.updateTranscription(
          id,
          transcriptionText,
          result.processing_time || 0
        );
        await this.dbService.updateStatus(id, 'completed');

        sendProgress(id, 100, 'Transcrição concluída!');
        logger.info(`✅ Transcription completed for ${id}`);
        logger.info(`📊 Text length: ${transcriptionText.length} characters`);

        // Deleta arquivos temporários
        await this.fileService.deleteTranscriptionFiles(filePath, result.audio_path);

        // Fechar conexão SSE
        setTimeout(() => closeSSEConnection(id), 2000);

      } else {
        // Erro na transcrição
        sendProgress(id, 0, 'Erro na transcrição');
        await this.dbService.updateStatus(id, 'failed', result.error || 'Unknown error');
        logger.error(`❌ Transcription failed for ${id}:`, result.error);

        // Deleta arquivo de vídeo
        await this.fileService.deleteFile(filePath);
        closeSSEConnection(id);
      }
      }
    } catch (error: any) {
      logger.error(`❌ Error processing transcription ${id}:`, error);

      // Mensagem de erro mais específica
      let errorMessage = error.message;
      if (error.message.includes('ENOMEM')) {
        errorMessage = 'Memória insuficiente. Tente usar um modelo menor ou dividir o arquivo.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Tempo limite excedido. O arquivo é muito grande para processar.';
      } else if (error.message.includes('Stack overflow')) {
        errorMessage = 'Arquivo muito grande causou estouro de memória. Use um modelo menor.';
      }

      sendProgress(id, 0, `Erro: ${errorMessage}`);
      await this.dbService.updateStatus(id, 'failed', errorMessage);
      await this.fileService.deleteFile(filePath);
      closeSSEConnection(id);
    }
  }

  /**
   * Calcula timeout baseado no tamanho do arquivo
   */
  private calculateTimeout(fileSizeMB: number): number {
    // Base: 5 minutos + 2 minutos por 100MB
    const baseTimeout = 5 * 60 * 1000; // 5 minutos
    const additionalTimeout = Math.ceil(fileSizeMB / 100) * 2 * 60 * 1000; // 2 min por 100MB
    const maxTimeout = 120 * 60 * 1000; // Máximo de 2 horas
    
    const timeout = Math.min(baseTimeout + additionalTimeout, maxTimeout);
    logger.info(`⏱️ Timeout set to ${timeout / 1000 / 60} minutes`);
    return timeout;
  }

  /**
   * Lê arquivo de transcrição JSON
   */
  private async readTranscriptionFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.text || '';
    } catch (error) {
      logger.error(`❌ Error reading transcription file: ${error}`);
      throw new Error('Failed to read transcription result file');
    }
  }

  /**
   * Executa o script Python de transcrição com melhor gestão de memória
   * Usa arquivo temporário para stdout (evita acumular em memória)
   * Limita stderr a 100KB (circular buffer)
   */
  private runPythonScript(
    videoPath: string,
    modelSize: string,
    transcriptionId: string,
    timeout: number = 30 * 60 * 1000 // 30 minutos padrão
  ): Promise<PythonTranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../python/transcribe.py');
      const pythonPath = process.env.PYTHON_PATH || 'python3';

      // Criar arquivo temporário para stdout
      const tempOutputFile = path.join(os.tmpdir(), `transcription_${transcriptionId}_${Date.now()}.json`);
      let outputStream: WriteStream | null = null;
      let outputSize = 0;
      let useFileOutput = false;

      logger.info(`🐍 Executing Python script: ${pythonScript}`);
      logger.info(`🐍 Using Python binary: ${pythonPath}`);
      logger.info(`🐍 Script exists: ${require('fs').existsSync(pythonScript)}`);
      logger.info(`🐍 Full command: ${pythonPath} ${pythonScript} ${videoPath} ${modelSize}`);

      // Debug: verificar se FFMPEG_PATH está disponível
      if (process.env.FFMPEG_PATH) {
        logger.info(`🔍 [DEBUG] FFMPEG_PATH (Node): ${process.env.FFMPEG_PATH}`);
      } else {
        logger.warn(`⚠️ [DEBUG] FFMPEG_PATH não definido no .env`);
      }

      sendProgress(transcriptionId, 15, 'Iniciando script Python...');

      // Configurar processo Python (com -B para não usar .pyc cache)
      const pythonProcess: ChildProcess = spawn(pythonPath, ['-B', pythonScript, videoPath, modelSize], {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          // Garantir que FFMPEG_PATH seja passado explicitamente
          FFMPEG_PATH: process.env.FFMPEG_PATH || '',
          FFMPEG_BIN: process.env.FFMPEG_PATH || '',
          // Removido: PYTHONMALLOC e MALLOC_* (causam problemas no Windows com libs nativas C++)
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'] // stdin ignorado, stdout e stderr em pipe
      });

      // Buffer para outputs pequenos (até MAX_MEMORY_OUTPUT)
      let outputBuffer: Buffer[] = [];

      // Circular buffer para stderr (últimos 100KB)
      let stderrBuffer: string[] = [];
      let stderrSize = 0;

      let timeoutHandle: NodeJS.Timeout;

      // Função para limpar recursos
      const cleanup = async () => {
        clearTimeout(timeoutHandle);
        if (outputStream) {
          outputStream.end();
          outputStream = null;
        }
      };

      // Configurar timeout
      timeoutHandle = setTimeout(async () => {
        logger.error(`❌ Process timeout after ${timeout/1000/60} minutes`);
        await cleanup();
        pythonProcess.kill('SIGTERM');
        // Remover arquivo temporário se existir
        try { await fs.unlink(tempOutputFile); } catch {}
        reject(new Error(`Process timeout. File too large to process in ${timeout/1000/60} minutes.`));
      }, timeout);

      pythonProcess.stdout?.on('data', (chunk: Buffer) => {
        outputSize += chunk.length;

        // Se output ainda é pequeno, manter em memória
        if (!useFileOutput && outputSize <= this.MAX_MEMORY_OUTPUT) {
          outputBuffer.push(chunk);
        } else {
          // Migrar para arquivo se ultrapassar limite
          if (!useFileOutput) {
            useFileOutput = true;
            logger.warn(`⚠️ Large output detected (>${this.MAX_MEMORY_OUTPUT} bytes). Switching to file-based output.`);
            outputStream = createWriteStream(tempOutputFile);

            // Escrever buffer acumulado no arquivo
            for (const buf of outputBuffer) {
              outputStream.write(buf);
            }
            outputBuffer = []; // Liberar memória
          }

          // Escrever novo chunk no arquivo
          outputStream?.write(chunk);
        }

        // Hard limit de 500MB (segurança)
        if (outputSize > 500 * 1024 * 1024) {
          logger.error('❌ Output too large (>500MB), killing process');
          cleanup();
          pythonProcess.kill('SIGTERM');
          reject(new Error('Output too large. The transcription is too big to process.'));
        }
      });

      pythonProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString('utf-8');

        // Circular buffer: manter apenas últimos MAX_STDERR_SIZE bytes
        stderrBuffer.push(message);
        stderrSize += message.length;

        // Remover mensagens antigas se ultrapassar limite
        while (stderrSize > this.MAX_STDERR_SIZE && stderrBuffer.length > 1) {
          const removed = stderrBuffer.shift();
          if (removed) stderrSize -= removed.length;
        }

        // Log apenas linhas importantes (não tudo)
        if (message.includes('PROGRESS:') || message.includes('Error') || message.includes('GPU') || message.includes('WARNING')) {
          logger.info(`Python stderr: ${message.trim()}`);
        }

        // Detectar mensagens de progresso
        const progressMatch = message.match(/PROGRESS:(\d+):(.+)/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          const status = progressMatch[2].trim();
          sendProgress(transcriptionId, progress, status);
        }

        // Detectar avisos importantes
        if (message.includes('Very large text')) {
          logger.warn('⚠️ Very large transcription detected');
        }
        if (message.includes('GPU')) {
          if (message.includes('cuda')) {
            logger.info('🚀 GPU detectada e ativa!');
          } else {
            logger.info('⚠️ Rodando em CPU (sem GPU)');
          }
        }
      });

      pythonProcess.on('close', (code: number | null) => {
        cleanup().then(() => {
          const errorOutput = stderrBuffer.join('');
          logger.info(`🔚 Python process closed with code: ${code}`);

          // Detectar erros específicos do Windows
          if (code === 3221226505 || code === -1073740791) {
            logger.error('❌ Stack buffer overrun (0xC0000409)');
            fs.unlink(tempOutputFile).catch(() => {});
            reject(new Error('Stack overflow durante processamento. Use um modelo menor ou divida o arquivo.'));
            return;
          }

          if (code === 3221225477 || code === -1073741819) {
            logger.error('❌ Access violation (0xC0000005)');
            fs.unlink(tempOutputFile).catch(() => {});
            reject(new Error('Erro de acesso à memória. O arquivo pode estar corrompido.'));
            return;
          }

          if (code === 0) {
            // Ler output do arquivo ou memória
            const readOutput = useFileOutput
              ? fs.readFile(tempOutputFile, 'utf-8').then(content => {
                  logger.info(`📂 Reading output from temp file: ${tempOutputFile}`);
                  // Deletar arquivo temporário após ler
                  return fs.unlink(tempOutputFile).then(() => content);
                })
              : Promise.resolve(Buffer.concat(outputBuffer).toString('utf-8'));

            readOutput.then(outputString => {
              outputBuffer = []; // Liberar memória

              logger.info(`📊 Output size: ${outputString.length} bytes (from ${useFileOutput ? 'file' : 'memory'})`);

              try {
                // Parse do resultado
                const result = JSON.parse(outputString);

                // Verificar se resultado usa arquivo
                if (result.text_file) {
                  logger.info(`📁 Result saved to file: ${result.text_file}`);
                  sendProgress(transcriptionId, 90, 'Processando arquivo de resultado...');
                } else {
                  sendProgress(transcriptionId, 90, 'Processamento concluído!');
                }

                resolve(result);
              } catch (e) {
                logger.error('❌ Failed to parse Python output:', e);
                logger.error('Output size:', outputSize, 'bytes');
                fs.unlink(tempOutputFile).catch(() => {});

                // Tentar extrair informação útil do erro
                if (errorOutput.includes('MemoryError')) {
                  reject(new Error('Python ran out of memory. Use a smaller model.'));
                } else {
                  reject(new Error('Failed to parse transcription result.'));
                }
              }
            }).catch(err => {
              logger.error('❌ Failed to read output:', err);
              fs.unlink(tempOutputFile).catch(() => {});
              reject(new Error('Failed to read transcription output.'));
            });
          } else if (code === null) {
            fs.unlink(tempOutputFile).catch(() => {});
            reject(new Error('Process was terminated (possibly out of memory)'));
          } else {
            fs.unlink(tempOutputFile).catch(() => {});
            logger.error(`❌ Python script exited with code: ${code}`);
            logger.error(`❌ Error output (last 1000 chars): ${errorOutput.slice(-1000)}`);

            // Extrair mensagem de erro mais útil
            const errorMatch = errorOutput.match(/Error: (.+)/);
            const errorMessage = errorMatch ? errorMatch[1] : 'Python script failed';

            reject(new Error(errorMessage));
          }
        }).catch(err => {
          logger.error('❌ Cleanup failed:', err);
          reject(err);
        });
      });

      pythonProcess.on('error', (error: Error) => {
        cleanup().then(() => {
          fs.unlink(tempOutputFile).catch(() => {});
          logger.error('❌ Failed to start Python process:', error);
          sendProgress(transcriptionId, 0, 'Erro ao executar Python');
          reject(error);
        }).catch(cleanupErr => {
          logger.error('❌ Cleanup failed on error:', cleanupErr);
          reject(error);
        });
      });

      // Monitorar uso de memória periodicamente
      const memoryMonitor = setInterval(() => {
        const usage = process.memoryUsage();
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

        if (usedMB > 1000) {
          logger.warn(`⚠️ High memory usage: ${usedMB}MB / ${totalMB}MB`);
        }

        // Se memória muito alta, considerar matar processo
        if (usedMB > 2000) {
          logger.error('❌ Memory limit exceeded, killing process');
          clearInterval(memoryMonitor);
          pythonProcess.kill('SIGTERM');
        }
      }, 5000);

      // Limpar monitor quando processo terminar
      pythonProcess.on('exit', () => {
        clearInterval(memoryMonitor);
      });
    });
  }

  /**
   * Obtém duração do arquivo de áudio/vídeo usando ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    const ffprobePath =
      process.env.FFPROBE_PATH ||
      (process.env.FFMPEG_PATH?.toLowerCase().endsWith('ffmpeg.exe')
        ? process.env.FFMPEG_PATH.replace(/ffmpeg\.exe$/i, 'ffprobe.exe')
        : undefined) ||
      'ffprobe';

    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ];

      logger.info(`🔍 Getting audio duration: ${ffprobePath} ${args.join(' ')}`);

      const process = spawn(ffprobePath, args, { windowsHide: true });

      let output = '';
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          logger.info(`📊 Audio duration: ${duration}s (${(duration/60).toFixed(2)}min)`);
          resolve(duration);
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Extrai áudio de vídeo usando ffmpeg
   * Retorna path do áudio extraído ou null se já é áudio
   */
  private async extractAudioFromVideo(filePath: string): Promise<string | null> {
    const ext = path.extname(filePath).toLowerCase();
    const audioExts = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.wma'];

    // Já é áudio
    if (audioExts.includes(ext)) {
      logger.info(`✅ File is already audio: ${filePath}`);
      return null;
    }

    // É vídeo, extrair áudio
    const audioPath = filePath.replace(/\.[^.]+$/, '.mp3');
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

    logger.info(`🎬 Extracting audio from video: ${filePath} → ${audioPath}`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', filePath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',
        '-ac', '1',
        '-b:a', '64k',
        audioPath
      ];

      const process = spawn(ffmpegPath, args, { windowsHide: true });

      process.on('close', (code) => {
        if (code === 0) {
          logger.info(`✅ Audio extracted: ${audioPath}`);
          resolve(audioPath);
        } else {
          reject(new Error(`ffmpeg extraction failed with code ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Divide áudio em chunks de 12 minutos usando ffmpeg
   * Usa a mesma extensão do arquivo original para evitar transcodificação
   */
  private async splitAudioIntoChunks(audioPath: string, chunkDuration: number = 720): Promise<string[]> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio_chunks_'));

    // Detectar extensão do arquivo original para usar nos chunks
    const audioExt = path.extname(audioPath); // Ex: .m4a, .mp3, .wav
    const chunkPattern = path.join(tempDir, `chunk_%03d${audioExt}`);
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

    logger.info(`📁 Splitting audio into ${chunkDuration}s chunks: ${audioPath}`);
    logger.info(`📄 Using extension: ${audioExt} (same as input to avoid re-encoding)`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-f', 'segment',
        '-segment_time', chunkDuration.toString(),
        '-c', 'copy',  // Copy stream without re-encoding (fast!)
        '-reset_timestamps', '1',
        chunkPattern
      ];

      const process = spawn(ffmpegPath, args, { windowsHide: true });

      process.stderr?.on('data', (data) => {
        // ffmpeg envia progresso para stderr
        logger.info(`ffmpeg: ${data.toString().trim()}`);
      });

      process.on('close', async (code) => {
        if (code === 0) {
          // Listar chunks criados (com a extensão correta)
          const files = await fs.readdir(tempDir);
          const chunks = files
            .filter(f => f.startsWith('chunk_') && f.endsWith(audioExt))
            .sort()
            .map(f => path.join(tempDir, f));

          logger.info(`✅ Created ${chunks.length} chunks (${audioExt} format) in ${tempDir}`);
          resolve(chunks);
        } else {
          reject(new Error(`ffmpeg split failed with code ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Transcreve chunk com retry em caso de OOM (Out of Memory)
   */
  private async transcribeSingleChunkWithRetry(
    chunkPath: string,
    modelSize: string,
    chunkNum: number,
    totalChunks: number,
    transcriptionId: string,
    maxRetries: number = 2
  ): Promise<{ text: string }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.transcribeSingleChunk(
          chunkPath,
          modelSize,
          chunkNum,
          totalChunks,
          transcriptionId
        );
      } catch (error: any) {
        const is_oom = error.message.includes('3221226505') ||
                       error.message.includes('0xC0000409') ||
                       error.message.includes('memory') ||
                       error.message.includes('Stack overflow');

        if (is_oom && attempt < maxRetries) {
          const delaySeconds = 10 * attempt; // Backoff: 10s, 20s
          logger.warn(`⚠️ Chunk ${chunkNum} OOM detected (attempt ${attempt}/${maxRetries}). Waiting ${delaySeconds}s for GPU cleanup...`);
          sendProgress(transcriptionId, 0, `Chunk ${chunkNum}: aguardando memória GPU (${delaySeconds}s)...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          logger.info(`🔄 Retrying chunk ${chunkNum} (attempt ${attempt + 1}/${maxRetries})`);
          continue;
        }

        throw error; // Re-throw se não for OOM ou última tentativa
      }
    }

    throw new Error(`Chunk ${chunkNum} failed after ${maxRetries} attempts`);
  }

  /**
   * Transcreve um único chunk usando processo Python independente com --simple flag
   */
  private async transcribeSingleChunk(
    chunkPath: string,
    modelSize: string,
    chunkNum: number,
    totalChunks: number,
    transcriptionId: string
  ): Promise<{ text: string }> {
    logger.info(`🎤 Processing chunk ${chunkNum}/${totalChunks}: ${chunkPath}`);

    // Enviar progresso
    const baseProgress = Math.floor((chunkNum - 1) / totalChunks * 80) + 10;
    sendProgress(transcriptionId, baseProgress, `Processando transcrição...`);

    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const pythonScript = path.join(__dirname, '../../python/transcribe.py');

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, ['-B', pythonScript, chunkPath, modelSize, '--simple'], {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          FFMPEG_PATH: process.env.FFMPEG_PATH || '',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        stderrData += text;

        // Repassar progresso
        const progressMatch = text.match(/PROGRESS:(\d+):(.+)/);
        if (progressMatch) {
          const chunkProgress = parseInt(progressMatch[1]);
          const message = progressMatch[2];

          // Mapear progresso do chunk (0-100) para progresso global
          const globalProgress = baseProgress + Math.floor((chunkProgress / 100) * (80 / totalChunks));
          sendProgress(transcriptionId, globalProgress, message);
        }

        logger.info(`[Chunk ${chunkNum}] ${text.trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdoutData);
            if (result.success) {
              // Python pode retornar texto diretamente ou referência a arquivo (se texto > 30KB)
              const textPromise = result.text_file
                ? fs.readFile(result.text_file, 'utf-8')
                    .then(text => {
                      logger.info(`📂 Read chunk ${chunkNum} text from file: ${result.text_file}`);
                      // Deletar arquivo após ler
                      return fs.unlink(result.text_file).then(() => text);
                    })
                : Promise.resolve(result.text);

              textPromise
                .then(text => {
                  logger.info(`✅ Chunk ${chunkNum}/${totalChunks} completed: ${text.length} chars`);
                  resolve({ text });
                })
                .catch(err => {
                  reject(new Error(`Failed to read chunk ${chunkNum} text file: ${err.message}`));
                });
            } else {
              reject(new Error(`Chunk ${chunkNum} failed: ${result.error}`));
            }
          } catch (e: any) {
            reject(new Error(`Failed to parse Python output for chunk ${chunkNum}: ${e.message}`));
          }
        } else {
          reject(new Error(`Python process for chunk ${chunkNum} exited with code ${code}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python for chunk ${chunkNum}: ${err.message}`));
      });
    });
  }

  /**
   * Helper: Calcular timeout baseado na duração
   */
  private calculateTimeoutFromDuration(durationSeconds: number): number {
    // Fórmula: duration * 60 segundos + buffer de 5 minutos
    const timeout = (durationSeconds * 60) + (5 * 60 * 1000);
    return Math.min(timeout, 2 * 60 * 60 * 1000); // Max 2 horas
  }
}
