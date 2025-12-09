import React, { useState } from 'react';
import { Transcription } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { FileText } from 'lucide-react';

interface TranscriptionResultProps {
  transcription: Transcription;
  onDownload: () => void;
  onNewTranscription: () => void;
  onGerarAta?: () => void;
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({
  transcription,
  onDownload,
  onNewTranscription,
  onGerarAta,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (transcription.transcription_text) {
      try {
        await copyToClipboard(transcription.transcription_text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Erro ao copiar:', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro ao copiar texto';
        alert(errorMessage);
      }
    }
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-light mb-4">Transcrição Completa</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-400">Arquivo:</span>
            <span className="ml-2 text-light">{transcription.filename}</span>
          </div>
          <div>
            <span className="text-gray-400">Tempo de processamento:</span>
            <span className="ml-2 text-light">
              {formatTime(transcription.processing_time_seconds)}
            </span>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
          <p className="text-light whitespace-pre-wrap leading-relaxed">
            {transcription.transcription_text}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <button
            onClick={onDownload}
            className="px-6 py-3 bg-primary text-light rounded-lg font-medium hover:bg-primary-dark transition-colors"
          >
            Download TXT
          </button>
          <button
            onClick={handleCopy}
            className="px-6 py-3 bg-gray-700 text-light rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            {copied ? '✓ Copiado!' : 'Copiar Texto'}
          </button>
          {onGerarAta && (
            <button
              onClick={onGerarAta}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#c52e33] text-white rounded-lg font-medium hover:bg-[#80000d] transition-colors"
            >
              <FileText className="w-5 h-5" />
              Gerar Ata
            </button>
          )}
        </div>

        <button
          onClick={onNewTranscription}
          className="w-full mt-4 px-6 py-3 bg-gray-700 text-light rounded-lg font-medium hover:bg-gray-600 transition-colors"
        >
          Nova Transcrição
        </button>
      </div>
    </div>
  );
};
