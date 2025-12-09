export interface Transcription {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcription_text?: string;
  processing_time_seconds?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface UploadResponse {
  success: boolean;
  transcriptionId: string;
  queuePosition: number;
  queueLength: number;
  message: string;
  // Legacy fields for backward compatibility
  id?: string;
  status?: string;
}

export type ModelSize = 'small' | 'medium' | 'large';

export interface SSEProgressData {
  progress: number;
  status: string;
  estimatedTime?: number;
  timestamp: string;
  // Queue information (optional)
  queuePosition?: number;
  queueLength?: number;
  isQueued?: boolean;
}

export interface QueuePositionResponse {
  success: boolean;
  transcriptionId: string;
  position: number;
  queueLength: number;
  inQueue: boolean;
}
