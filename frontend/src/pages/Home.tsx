import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUploader } from '../components/FileUploader';
import { transcriptionApi } from '../services/api';
import { ModelSize } from '../types';

export const Home: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpload = async (file: File, modelSize: ModelSize) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      console.log(`Uploading ${file.name} with model ${modelSize}`);
      const response = await transcriptionApi.upload(
        file,
        modelSize,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      console.log('Upload successful:', response);
      navigate(`/processing/${response.transcriptionId}`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Erro ao fazer upload do arquivo');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-light mb-2">
          Transcreva seus vídeos de reunião com IA
        </h2>
        <p className="text-gray-400">
          Envie gravações de reuniões e receba a transcrição completa em texto
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      )}

      <FileUploader
        onUpload={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-light mb-3">Como funciona?</h3>
        <ol className="space-y-2 text-gray-400">
          <li>1. Faça upload do vídeo da sua reunião (MP4, AVI, MOV, MKV - até 2GB)</li>
          <li>2. Escolha a qualidade da transcrição (recomendamos "medium")</li>
          <li>3. Aguarde o processamento (pode levar alguns minutos)</li>
          <li>4. Baixe ou copie o texto transcrito</li>
        </ol>

        <div className="mt-4 p-3 bg-gray-900 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>💡 Dica:</strong> Para reuniões de ~1h, recomendamos a qualidade "Excelente (medium)"
            que oferece precisão de ~98%.
          </p>
        </div>
      </div>
    </div>
  );
};
