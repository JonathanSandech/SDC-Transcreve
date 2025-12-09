import fs from 'fs/promises';
import path from 'path';
import { DatabaseService } from './database.service';

export class FileService {
  private uploadDir: string;
  private dbService: DatabaseService;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.dbService = new DatabaseService();
  }

  /**
   * Garante que o diretório de uploads existe
   */
  async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log(`✅ Created upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Deleta um arquivo do disco
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
    } catch (error) {
      console.error(`⚠️ Error deleting file ${filePath}:`, error);
    }
  }

  /**
   * Deleta arquivos de entrada e áudio extraído de uma transcrição
   */
  async deleteTranscriptionFiles(inputPath?: string, audioPath?: string): Promise<void> {
    const deletePromises: Promise<void>[] = [];

    // Deletar arquivo de entrada (vídeo ou áudio original)
    if (inputPath) {
      deletePromises.push(
        this.deleteFile(inputPath).then(() => {
          console.log(`🗑️ Deleted input file: ${inputPath}`);
        })
      );
    }

    // Deletar áudio extraído SOMENTE se for diferente do input
    // (quando input era vídeo, foi criado um MP3 separado)
    if (audioPath && audioPath !== inputPath) {
      deletePromises.push(
        this.deleteFile(audioPath).then(() => {
          console.log(`🗑️ Deleted extracted audio: ${audioPath}`);
        })
      );
    } else if (audioPath === inputPath) {
      console.log(`ℹ️ Audio was original file, already deleted`);
    }

    await Promise.allSettled(deletePromises);
  }

  /**
   * Retorna o caminho completo de um arquivo
   */
  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  /**
   * Verifica se um arquivo existe
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Limpa arquivos antigos (opcional - executar periodicamente)
   * IMPORTANTE: Verifica se arquivo está em uso (pending/processing) antes de deletar
   */
  async cleanupOldFiles(uploadDir: string, maxAgeHours: number = 24): Promise<void> {
    try {
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      // Buscar file_paths de transcrições ativas (que NÃO devem ser deletadas)
      let activeFilePaths: string[] = [];
      try {
        activeFilePaths = await this.dbService.getActiveFilePaths();
        if (activeFilePaths.length > 0) {
          console.log(`🔒 ${activeFilePaths.length} arquivo(s) protegido(s) (em processamento/fila)`);
        }
      } catch (dbError) {
        console.warn('⚠️ Could not fetch active file paths from DB. Skipping cleanup to be safe.');
        return; // Se não conseguir verificar DB, não deleta nada por segurança
      }

      const files = await fs.readdir(uploadDir);
      let deletedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          // Verificar se arquivo está em uso
          const isActive = activeFilePaths.some(activePath =>
            activePath === filePath || activePath.endsWith(file)
          );

          if (isActive) {
            skippedCount++;
            console.log(`⏳ Skipped active file: ${file} (still in queue/processing)`);
            continue;
          }

          await fs.unlink(filePath);
          deletedCount++;
          console.log(`🗑️ Cleaned up old file: ${file} (age: ${Math.floor(age / 1000 / 60 / 60)}h)`);
        }
      }

      if (deletedCount > 0 || skippedCount > 0) {
        console.log(`✅ Cleanup completed: ${deletedCount} deleted, ${skippedCount} skipped (active)`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old files:', error);
    }
  }
}
