import { query } from '../config/database';
import { Transcription, CreateTranscriptionDTO } from '../types';

export class DatabaseService {
  /**
   * Cria uma nova transcrição no banco de dados
   */
  async createTranscription(data: CreateTranscriptionDTO): Promise<string> {
    const result = await query(
      `INSERT INTO transcriptions (filename, original_size, file_path, model_size, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [data.filename, data.original_size, data.file_path, data.model_size]
    );
    return result.rows[0].id;
  }

  /**
   * Busca uma transcrição por ID
   */
  async getTranscription(id: string): Promise<Transcription | null> {
    const result = await query(
      'SELECT * FROM transcriptions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Atualiza o status de uma transcrição
   */
  async updateStatus(id: string, status: string, error?: string): Promise<void> {
    if (status === 'processing') {
      await query(
        'UPDATE transcriptions SET status = $1, started_at = NOW() WHERE id = $2',
        [status, id]
      );
    } else if (status === 'completed') {
      await query(
        'UPDATE transcriptions SET status = $1, completed_at = NOW() WHERE id = $2',
        [status, id]
      );
    } else if (status === 'failed') {
      await query(
        'UPDATE transcriptions SET status = $1, error_message = $2, completed_at = NOW() WHERE id = $3',
        [status, error, id]
      );
    }
  }

  /**
   * Salva o resultado da transcrição
   */
  async updateTranscription(id: string, text: string, processingTime: number): Promise<void> {
    await query(
      'UPDATE transcriptions SET transcription_text = $1, processing_time_seconds = $2 WHERE id = $3',
      [text, processingTime, id]
    );
  }

  /**
   * Deleta uma transcrição do banco
   */
  async deleteTranscription(id: string): Promise<void> {
    await query('DELETE FROM transcriptions WHERE id = $1', [id]);
  }

  /**
   * Limpa transcrições expiradas (24h)
   */
  async cleanupExpired(): Promise<number> {
    const result = await query(
      'DELETE FROM transcriptions WHERE expires_at < NOW() RETURNING id'
    );
    return result.rowCount || 0;
  }

  /**
   * Busca transcrições expiradas com paths de arquivos
   */
  async getExpiredWithFiles(): Promise<Array<{ id: string; file_path?: string; audio_path?: string }>> {
    const result = await query(
      'SELECT id, file_path, audio_path FROM transcriptions WHERE expires_at < NOW()'
    );
    return result.rows;
  }

  /**
   * Busca transcrição por caminho do arquivo
   */
  async getTranscriptionByFilePath(filePath: string): Promise<Transcription | null> {
    const result = await query(
      'SELECT * FROM transcriptions WHERE file_path = $1',
      [filePath]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca todas transcrições com status pending ou processing
   * Retorna os file_paths que NÃO devem ser deletados
   */
  async getActiveFilePaths(): Promise<string[]> {
    const result = await query(
      `SELECT file_path FROM transcriptions
       WHERE status IN ('pending', 'processing')
       AND file_path IS NOT NULL`
    );
    return result.rows.map((row: { file_path: string }) => row.file_path);
  }
}
