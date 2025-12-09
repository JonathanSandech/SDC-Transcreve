import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Users, Calendar, MapPin, User,
  Loader2, Send, ArrowLeft, CheckCircle, XCircle, Download, AlertCircle
} from 'lucide-react';
import { useTranscription } from '../contexts/TranscriptionContext';
import { gerarAtaCompleta, checkOllamaStatus, getDownloadUrl, AtaFormData } from '../services/ataApi';

export const GeraAta = () => {
  const navigate = useNavigate();
  const { transcriptionText, clearTranscription } = useTranscription();

  const [formData, setFormData] = useState<AtaFormData>({
    participantes: '',
    dataHora: '',
    local: '',
    convocadoPor: '',
    transcricao: ''
  });

  const [errors, setErrors] = useState<Partial<AtaFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [submitResult, setSubmitResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  useEffect(() => {
    if (transcriptionText) {
      setFormData(prev => ({ ...prev, transcricao: transcriptionText }));
    }
  }, [transcriptionText]);

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const status = await checkOllamaStatus();
        setOllamaOnline(status.status === 'online');
      } catch {
        setOllamaOnline(false);
      }
    };
    checkOllama();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<AtaFormData> = {};

    if (!formData.participantes.trim()) newErrors.participantes = 'Campo obrigatório';
    if (!formData.dataHora) newErrors.dataHora = 'Campo obrigatório';
    if (!formData.local.trim()) newErrors.local = 'Campo obrigatório';
    if (!formData.convocadoPor.trim()) newErrors.convocadoPor = 'Campo obrigatório';
    if (!formData.transcricao.trim()) {
      newErrors.transcricao = 'Campo obrigatório';
    } else if (formData.transcricao.trim().length < 50) {
      newErrors.transcricao = 'Transcrição muito curta (mínimo 50 caracteres)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitResult({ status: 'idle', message: '' });
    setDownloadUrl('');

    try {
      const result = await gerarAtaCompleta(formData);

      if (result.status === 'sucesso') {
        setDownloadUrl(getDownloadUrl(result.download_url));
        setSubmitResult({
          status: 'success',
          message: `Ata gerada com sucesso! ${result.dados_extraidos.num_pontos} pontos identificados, ${result.dados_extraidos.num_proximos_passos} próximos passos definidos.`
        });
        clearTranscription();
      } else {
        throw new Error(result.mensagem || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setSubmitResult({
        status: 'error',
        message: error.response?.data?.mensagem || error.response?.data?.detalhes || error.message || 'Erro ao gerar ata'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof AtaFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleNovaAta = () => {
    setFormData({
      participantes: '',
      dataHora: '',
      local: '',
      convocadoPor: '',
      transcricao: ''
    });
    setSubmitResult({ status: 'idle', message: '' });
    setDownloadUrl('');
    clearTranscription();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#c52e33] bg-opacity-20 rounded-lg">
            <FileText className="w-6 h-6 text-[#c52e33]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Gerador de Ata</h1>
            <p className="text-gray-300">Preencha os dados para gerar a ata automaticamente com IA</p>
          </div>
        </div>
      </div>

      {ollamaOnline === false && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Serviço de IA Offline</p>
            <p className="text-red-700 text-sm">O Ollama não está disponível. Execute: <code className="bg-red-100 px-1 rounded">ollama serve</code></p>
          </div>
        </div>
      )}

      {ollamaOnline === true && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-medium">Processamento pode demorar</p>
            <p className="text-yellow-700 text-sm">O modelo de IA pode levar até <strong>15 minutos</strong> para processar transcrições longas (reuniões de +1h). Por favor, aguarde.</p>
          </div>
        </div>
      )}

      {transcriptionText && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-[#c52e33]" />
          <span className="text-[#80000d] text-sm">
            Transcrição carregada automaticamente ({transcriptionText.length.toLocaleString()} caracteres)
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              Participantes
            </label>
            <input
              type="text"
              value={formData.participantes}
              onChange={(e) => handleChange('participantes', e.target.value)}
              placeholder="João Silva, Maria Santos, Pedro Oliveira"
              className={`w-full px-4 py-2.5 bg-[#2b2b2b] text-white border rounded-lg focus:ring-2 focus:ring-[#c52e33] focus:border-[#c52e33] placeholder-gray-500 ${
                errors.participantes ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-gray-600'
              }`}
            />
            {errors.participantes && <p className="mt-1 text-sm text-red-600">{errors.participantes}</p>}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              Data e Hora
            </label>
            <input
              type="datetime-local"
              value={formData.dataHora}
              onChange={(e) => handleChange('dataHora', e.target.value)}
              className={`w-full px-4 py-2.5 bg-[#2b2b2b] text-white border rounded-lg focus:ring-2 focus:ring-[#c52e33] focus:border-[#c52e33] ${
                errors.dataHora ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-gray-600'
              }`}
            />
            {errors.dataHora && <p className="mt-1 text-sm text-red-600">{errors.dataHora}</p>}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              Local
            </label>
            <input
              type="text"
              value={formData.local}
              onChange={(e) => handleChange('local', e.target.value)}
              placeholder="Sala de Reuniões 3º Andar"
              className={`w-full px-4 py-2.5 bg-[#2b2b2b] text-white border rounded-lg focus:ring-2 focus:ring-[#c52e33] focus:border-[#c52e33] placeholder-gray-500 ${
                errors.local ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-gray-600'
              }`}
            />
            {errors.local && <p className="mt-1 text-sm text-red-600">{errors.local}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 text-gray-400" />
              Convocado Por
            </label>
            <input
              type="text"
              value={formData.convocadoPor}
              onChange={(e) => handleChange('convocadoPor', e.target.value)}
              placeholder="Eduardo Asth"
              className={`w-full px-4 py-2.5 bg-[#2b2b2b] text-white border rounded-lg focus:ring-2 focus:ring-[#c52e33] focus:border-[#c52e33] placeholder-gray-500 ${
                errors.convocadoPor ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-gray-600'
              }`}
            />
            {errors.convocadoPor && <p className="mt-1 text-sm text-red-600">{errors.convocadoPor}</p>}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Transcrição da Reunião
          </label>
          <textarea
            value={formData.transcricao}
            onChange={(e) => handleChange('transcricao', e.target.value)}
            placeholder="Cole aqui a transcrição completa da reunião..."
            rows={14}
            className={`w-full px-4 py-2.5 bg-[#2b2b2b] text-white border rounded-lg focus:ring-2 focus:ring-[#c52e33] focus:border-[#c52e33] resize-y font-mono text-sm placeholder-gray-500 ${
              errors.transcricao ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-gray-600'
            }`}
          />
          <div className="flex justify-between mt-1">
            {errors.transcricao && <p className="text-sm text-red-600">{errors.transcricao}</p>}
            <p className="text-sm text-gray-400 ml-auto">
              {formData.transcricao.length.toLocaleString()} caracteres
            </p>
          </div>
        </div>

        {submitResult.status !== 'idle' && (
          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            submitResult.status === 'success'
              ? 'bg-green-900 bg-opacity-20 border border-green-700'
              : 'bg-red-900 bg-opacity-20 border border-red-700'
          }`}>
            {submitResult.status === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={submitResult.status === 'success' ? 'text-green-300' : 'text-red-300'}>
                {submitResult.message}
              </p>
              {submitResult.status === 'success' && downloadUrl && (
                <div className="mt-3 flex gap-3">
                  <a
                    href={downloadUrl}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#c52e33] text-white rounded-lg hover:bg-[#80000d] transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Ata (.docx)
                  </a>
                  <button
                    type="button"
                    onClick={handleNovaAta}
                    className="text-sm text-[#c52e33] hover:text-[#80000d] underline"
                  >
                    Criar nova ata
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || ollamaOnline === false}
          className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium text-white transition-all duration-200 ${
            isSubmitting || ollamaOnline === false
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#c52e33] hover:bg-[#80000d] shadow-sm hover:shadow-md'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Gerando Ata com IA...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Gerar Ata
            </>
          )}
        </button>
      </form>
    </div>
  );
};
