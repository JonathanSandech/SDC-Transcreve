import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
//import { ProgressBar } from '../components/ProgressBar';
import { transcriptionApi } from '../services/api';
import { Transcription, SSEProgressData } from '../types';
import { API_URL } from '../config/api';

export const Processing: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para progresso SSE
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Estados para informações de fila
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueLength, setQueueLength] = useState<number | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  // Conectar ao SSE para progresso em tempo real
  useEffect(() => {
    if (!id) return;

    const eventSource = new EventSource(
      `${API_URL}/api/transcription/${id}/progress`
    );

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    eventSource.onmessage = (event) => {
      try {
        const data: SSEProgressData = JSON.parse(event.data);
        setProgress(data.progress);
        setStatusMessage(data.status);
        if (data.estimatedTime) {
          setEstimatedTime(data.estimatedTime);
        }

        // Atualizar informações de fila
        if (data.queuePosition !== undefined) {
          setQueuePosition(data.queuePosition);
        }
        if (data.queueLength !== undefined) {
          setQueueLength(data.queueLength);
        }
        if (data.isQueued !== undefined) {
          setIsQueued(data.isQueued);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      clearInterval(timer);
    };

    return () => {
      eventSource.close();
      clearInterval(timer);
    };
  }, [id]);

  // Verificar status periodicamente para detectar conclusão
  useEffect(() => {
    if (!id) return;

    const checkStatus = async () => {
      try {
        const data = await transcriptionApi.getStatus(id);
        setTranscription(data);

        if (data.status === 'completed') {
          setTimeout(() => {
            navigate(`/result/${id}`);
          }, 1000);
        } else if (data.status === 'failed') {
          setError(data.error_message || 'Erro ao processar transcrição');
        }
      } catch (err: any) {
        console.error('Status check error:', err);
        setError(err.response?.data?.error || 'Erro ao verificar status');
      }
    };

    // Check inicial
    checkStatus();

    // Check a cada 5 segundos (menos frequente que antes, pois temos SSE)
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [id, navigate]);

  // Helper para formatar tempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Erro no Processamento</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary text-light rounded-lg hover:bg-primary-dark transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-light mb-6">Processando Transcrição</h2>

        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            <p>Arquivo: <span className="text-light">{transcription?.filename}</span></p>
          </div>

          {/* Barra de progresso em tempo real */}
          <div className="space-y-3 bg-blue-50 bg-opacity-10 border border-blue-500 border-opacity-30 rounded-lg p-4">
            {/* Mensagem de status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm font-medium text-blue-300">
                  {statusMessage || 'Processando...'}
                </span>
              </div>
              {!isQueued && <span className="text-sm font-bold text-blue-400">{progress}%</span>}
            </div>

            {/* Informações de fila */}
            {isQueued && queuePosition !== null && queueLength !== null && (
              <div className="text-sm text-blue-300 text-center py-2">
                Posição na fila: <span className="font-bold">{queuePosition}</span> de <span className="font-bold">{queueLength}</span>
              </div>
            )}

            {/* Barra de progresso - apenas se não estiver na fila */}
            {!isQueued && (
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Tempos */}
            <div className="flex justify-between text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Tempo decorrido: {formatTime(elapsedTime)}</span>
              </div>
              {!isQueued && estimatedTime && estimatedTime > 0 && (
                <span>Tempo restante: ~{formatTime(estimatedTime)}</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-center text-gray-400 text-sm">
              O progresso é atualizado em tempo real.
              Para vídeos mais longos, o processamento pode levar alguns minutos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
