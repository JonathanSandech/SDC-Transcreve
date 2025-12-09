import React, { useState, useRef } from 'react';
import { ModelSize } from '../types';

interface FileUploaderProps {
  onUpload: (file: File, modelSize: ModelSize) => void;
  isUploading: boolean;
  uploadProgress?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, isUploading, uploadProgress = 0 }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modelSize, setModelSize] = useState<ModelSize>('medium');
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/x-matroska', 'video/quicktime', 'video/x-msvideo', 'video/webm',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/x-m4a', 'audio/mp4',
      'audio/flac', 'audio/x-flac', 'audio/ogg', 'audio/vorbis'
    ];
    const validExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.flac', '.ogg'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Por favor, selecione um arquivo válido (Vídeo: MP4, AVI, MOV, MKV, WebM | Áudio: MP3, WAV, M4A, FLAC, OGG)');
      return;
    }

    // Verificar tamanho (2GB)
    const maxSize = 2147483648; // 2GB em bytes
    if (file.size > maxSize) {
      alert('Arquivo muito grande. O tamanho máximo é 2GB');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      setUploadStartTime(Date.now());
      onUpload(selectedFile, modelSize);
    }
  };

  // Reset startTime quando upload termina
  React.useEffect(() => {
    if (!isUploading && uploadStartTime) {
      setUploadStartTime(null);
    }
  }, [isUploading]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const estimateUploadTime = (bytes: number): string => {
    // Estimar tempo baseado em conexão média de 25 Mbps
    const speedMbps = 25;
    const megabits = (bytes * 8) / (1024 * 1024);
    const seconds = megabits / speedMbps;

    if (seconds < 60) {
      return `~${Math.ceil(seconds)} segundos`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `~${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
  };

  // Calcula ETA dinâmico baseado na velocidade real de upload
  const calculateDynamicETA = (): string => {
    if (!uploadStartTime || !selectedFile || uploadProgress <= 0) {
      return '';
    }

    const elapsedMs = Date.now() - uploadStartTime;
    const bytesUploaded = (selectedFile.size * uploadProgress) / 100;

    if (bytesUploaded <= 0 || elapsedMs < 1000) {
      return 'Calculando...';
    }

    // Velocidade em bytes/segundo
    const speedBps = bytesUploaded / (elapsedMs / 1000);
    const bytesRemaining = selectedFile.size - bytesUploaded;
    const secondsRemaining = bytesRemaining / speedBps;

    // Formatar velocidade
    const speedMbps = (speedBps * 8) / (1024 * 1024);
    const speedFormatted = speedMbps >= 1
      ? `${speedMbps.toFixed(1)} Mbps`
      : `${(speedMbps * 1000).toFixed(0)} Kbps`;

    // Formatar tempo restante
    if (secondsRemaining < 60) {
      return `${Math.ceil(secondsRemaining)}s restantes (${speedFormatted})`;
    } else if (secondsRemaining < 3600) {
      const minutes = Math.floor(secondsRemaining / 60);
      const seconds = Math.ceil(secondsRemaining % 60);
      return `${minutes}m ${seconds}s restantes (${speedFormatted})`;
    } else {
      const hours = Math.floor(secondsRemaining / 3600);
      const minutes = Math.ceil((secondsRemaining % 3600) / 60);
      return `${hours}h ${minutes}m restantes (${speedFormatted})`;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary bg-opacity-10'
            : 'border-gray-600 hover:border-primary'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.avi,.mov,.mkv,.webm,.mp3,.wav,.m4a,.flac,.ogg"
          onChange={handleChange}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-400">
              Arraste um vídeo ou áudio aqui ou clique para selecionar
            </p>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1">
                  Vídeo
                </span>
                MP4, AVI, MOV, MKV, WebM
              </p>
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-1">
                  Áudio
                </span>
                MP3, WAV, M4A, FLAC, OGG
              </p>
              <p className="mt-2">Até 2GB</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-6 py-2 bg-primary text-light rounded-lg hover:bg-primary-dark transition-colors"
            >
              Selecionar Arquivo
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-light font-medium">{selectedFile.name}</span>
            </div>
            <p className="text-sm text-gray-400">{formatFileSize(selectedFile.size)}</p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-primary hover:text-primary-dark"
            >
              Remover
            </button>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Qualidade da Transcrição
            </label>
            <select
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value as ModelSize)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-light focus:outline-none focus:border-primary"
            >
              <option value="small">Muito precisa (~96%)</option>
              <option value="medium">Recomendado (~98%)</option>
              <option value="large">Melhor possível (~99%)</option>
            </select>
            <p className="mt-2 text-xs text-gray-400">
              Tempos estimados para vídeos de ~1h. Qualidade "medium" é recomendada para documentação de reuniões.
            </p>
          </div>

          {!isUploading && selectedFile && (
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-600">
              <div className="flex items-center text-sm text-gray-300">
                <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tempo estimado de upload: <strong>{estimateUploadTime(selectedFile.size)}</strong></span>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full px-6 py-3 bg-primary text-light rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Enviando...' : 'Iniciar Transcrição'}
          </button>

          {isUploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Enviando arquivo...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${uploadProgress}%` }}
                >
                  {uploadProgress > 10 && (
                    <span className="text-xs text-white font-medium drop-shadow">
                      {uploadProgress}%
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                {calculateDynamicETA() || 'Aguarde enquanto o arquivo é enviado ao servidor...'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
