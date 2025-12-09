export interface Transcription {
  id: string;
  filename: string;
  original_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model_size: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  file_path?: string;
  audio_path?: string;
  transcription_text?: string;
  duration_seconds?: number;
  processing_time_seconds?: number;
  error_message?: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  expires_at: Date;
}

export interface CreateTranscriptionDTO {
  filename: string;
  original_size: number;
  file_path: string;
  model_size: string;
}

export interface TranscriptionResponse {
  id: string;
  status: string;
  filename: string;
  transcription_text?: string;
  processing_time_seconds?: number;
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
}

export interface PythonTranscriptionResult {
  success: boolean;
  text?: string;
  text_file?: string;      // Para textos muito grandes (>50MB), path do arquivo
  text_size?: number;      // Tamanho do texto em caracteres
  audio_path?: string;
  processing_time?: number;
  error?: string;
}
