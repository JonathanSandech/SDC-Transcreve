import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TranscriptionResult } from '../components/TranscriptionResult';
import { transcriptionApi } from '../services/api';
import { Transcription } from '../types';
import { useTranscription } from '../contexts/TranscriptionContext';

export const Result: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTranscriptionText } = useTranscription();
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchTranscription = async () => {
      try {
        const data = await transcriptionApi.getStatus(id);

        if (data.status !== 'completed') {
          navigate(`/processing/${id}`);
          return;
        }

        setTranscription(data);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.error || 'Erro ao carregar transcrição');
      }
    };

    fetchTranscription();
  }, [id, navigate]);

  const handleDownload = async () => {
    if (id && transcription) {
      try {
        await transcriptionApi.download(id, transcription.filename);
      } catch (err) {
        alert('Erro ao fazer download');
      }
    }
  };

  const handleNewTranscription = () => {
    navigate('/');
  };

  const handleGerarAta = () => {
    if (transcription?.transcription_text) {
      setTranscriptionText(transcription.transcription_text);
      navigate('/gerar-ata');
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-6">
          <p className="text-red-400 text-center mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-2 bg-primary text-light rounded-lg hover:bg-primary-dark transition-colors"
          >
            Voltar ao Início
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
    <TranscriptionResult
      transcription={transcription}
      onDownload={handleDownload}
      onNewTranscription={handleNewTranscription}
      onGerarAta={handleGerarAta}
    />
  );
};
