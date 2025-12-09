import React from 'react';

interface ProgressBarProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ status }) => {
  const getProgress = () => {
    switch (status) {
      case 'pending':
        return 25;
      case 'processing':
        return 75;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-primary';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Aguardando processamento...';
      case 'processing':
        return 'Transcrevendo vídeo...';
      case 'completed':
        return 'Transcrição concluída!';
      case 'failed':
        return 'Falha na transcrição';
      default:
        return '';
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-light">{getStatusText()}</span>
        <span className="text-sm font-medium text-light">{getProgress()}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${getProgress()}%` }}
        />
      </div>
    </div>
  );
};
