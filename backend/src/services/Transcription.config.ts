// transcription.config.ts
// Configurações otimizadas para o sistema de transcrição

export interface TranscriptionConfig {
  // Limites de tamanho
  maxFileSize: number;
  maxTextLength: number;
  maxMemoryUsage: number;
  
  // Configurações por duração
  durationThresholds: {
    short: number;    // até X minutos
    medium: number;   // até X minutos
    long: number;     // até X minutos
    veryLong: number; // acima de X minutos
  };
  
  // Configurações de modelo por categoria
  modelSettings: {
    [key: string]: {
      beam_size: number;
      batch_size: number;
      num_workers: number;
      condition_on_previous_text: boolean;
      vad_filter: boolean;
      compression_ratio_threshold: number;
      no_speech_threshold: number;
      max_initial_timestamp: number;
    };
  };
  
  // Timeouts
  timeouts: {
    base: number;
    perGB: number;
    max: number;
  };
  
  // Configurações de memória
  memory: {
    maxOutputBuffer: number;
    maxChunkSize: number;
    gcThreshold: number;
  };
}

export const transcriptionConfig: TranscriptionConfig = {
  // Limites máximos
  maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
  maxTextLength: 50_000_000, // 50 milhões de caracteres
  maxMemoryUsage: 2048, // 2GB em MB
  
  // Categorias de duração (em segundos)
  durationThresholds: {
    short: 600,      // 10 minutos
    medium: 1800,    // 30 minutos
    long: 3600,      // 60 minutos
    veryLong: 7200   // 2 horas
  },
  
  // Configurações de modelo por categoria
  modelSettings: {
    // Para vídeos curtos (< 10 min) - qualidade máxima
    short: {
      beam_size: 5,
      batch_size: 16,
      num_workers: 2,
      condition_on_previous_text: true,
      vad_filter: true,
      compression_ratio_threshold: 2.4,
      no_speech_threshold: 0.6,
      max_initial_timestamp: 1.0
    },
    
    // Para vídeos médios (10-30 min) - balanceado
    medium: {
      beam_size: 3,
      batch_size: 12,
      num_workers: 2,
      condition_on_previous_text: true,
      vad_filter: true,
      compression_ratio_threshold: 2.4,
      no_speech_threshold: 0.6,
      max_initial_timestamp: 1.0
    },
    
    // Para vídeos longos (30-60 min) - conservador
    long: {
      beam_size: 1,
      batch_size: 8,
      num_workers: 1,
      condition_on_previous_text: false, // Economizar memória
      vad_filter: true,
      compression_ratio_threshold: 2.4,
      no_speech_threshold: 0.6,
      max_initial_timestamp: 1.0
    },
    
    // Para vídeos muito longos (> 1 hora) - mínimo
    veryLong: {
      beam_size: 1,
      batch_size: 4,
      num_workers: 1,
      condition_on_previous_text: false,
      vad_filter: true,
      compression_ratio_threshold: 2.2, // Mais tolerante
      no_speech_threshold: 0.7,         // Mais agressivo
      max_initial_timestamp: 1.0
    }
  },
  
  // Configuração de timeouts
  timeouts: {
    base: 5 * 60 * 1000,      // 5 minutos base
    perGB: 15 * 60 * 1000,    // 15 minutos por GB
    max: 120 * 60 * 1000      // Máximo de 2 horas
  },
  
  // Configurações de memória
  memory: {
    maxOutputBuffer: 50 * 1024 * 1024,  // 50MB buffer máximo
    maxChunkSize: 100,                  // Segmentos por chunk
    gcThreshold: 200                    // Rodar GC a cada 200 segmentos
  }
};

// Função auxiliar para obter configuração baseada na duração
export function getModelSettingsByDuration(durationSeconds: number) {
  const thresholds = transcriptionConfig.durationThresholds;
  
  if (durationSeconds <= thresholds.short) {
    return transcriptionConfig.modelSettings.short;
  } else if (durationSeconds <= thresholds.medium) {
    return transcriptionConfig.modelSettings.medium;
  } else if (durationSeconds <= thresholds.long) {
    return transcriptionConfig.modelSettings.long;
  } else {
    return transcriptionConfig.modelSettings.veryLong;
  }
}

// Função para calcular timeout baseado no tamanho do arquivo
export function calculateTimeout(fileSizeBytes: number): number {
  const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
  const timeout = Math.min(
    transcriptionConfig.timeouts.base + (fileSizeGB * transcriptionConfig.timeouts.perGB),
    transcriptionConfig.timeouts.max
  );
  return Math.round(timeout);
}

// Função para verificar se arquivo é muito grande
export function isFileTooLarge(fileSizeBytes: number): boolean {
  return fileSizeBytes > transcriptionConfig.maxFileSize;
}

// Função para sugerir modelo baseado no tamanho
export function suggestModelSize(fileSizeBytes: number, currentModel: string): string {
  const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
  
  // Para arquivos muito grandes, forçar modelos menores
  if (fileSizeGB > 2 && currentModel === 'large') {
    console.warn('⚠️ File > 2GB with large model. Suggesting medium.');
    return 'medium';
  }
  
  if (fileSizeGB > 3 && currentModel === 'medium') {
    console.warn('⚠️ File > 3GB with medium model. Suggesting small.');
    return 'small';
  }
  
  if (fileSizeGB > 4) {
    console.warn('⚠️ File > 4GB. Using base model for stability.');
    return 'base';
  }
  
  return currentModel;
}

export default transcriptionConfig;