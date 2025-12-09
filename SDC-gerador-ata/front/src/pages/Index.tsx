import { useState } from "react";

// Substitua pela URL real do seu webhook n8n
const WEBHOOK_URL = "https://sandech-n8n.theworkpc.com/webhook-test/gerador-ata";

interface FormData {
  participantes: string;
  dataHora: string;
  local: string;
  convocadoPor: string;
  transcricao: string;
}

interface FormErrors {
  participantes?: string;
  dataHora?: string;
  local?: string;
  convocadoPor?: string;
  transcricao?: string;
}

const Index = () => {
  const [formData, setFormData] = useState<FormData>({
    participantes: "",
    dataHora: "",
    local: "",
    convocadoPor: "",
    transcricao: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpar erro do campo ao digitar
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.participantes.trim()) {
      newErrors.participantes = "Campo obrigatório";
    }
    if (!formData.dataHora) {
      newErrors.dataHora = "Campo obrigatório";
    }
    if (!formData.local.trim()) {
      newErrors.local = "Campo obrigatório";
    }
    if (!formData.convocadoPor.trim()) {
      newErrors.convocadoPor = "Campo obrigatório";
    }
    if (!formData.transcricao.trim()) {
      newErrors.transcricao = "Campo obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");

    if (validateForm()) {
      // Dados prontos para envio
      const dataToSend = {
        participantes: formData.participantes,
        dataHora: formData.dataHora,
        local: formData.local,
        convocadoPor: formData.convocadoPor,
        transcricao: formData.transcricao,
      };

      try {
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSend)
        });
        
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Resposta do webhook:", result);
        
        // Aqui você pode receber um link de download do documento gerado
        // if (result.downloadUrl) {
        //   setDownloadLink(result.downloadUrl);
        // }
        
        setSuccessMessage("Ata gerada com sucesso!");
      } catch (error) {
        console.error('Erro ao enviar dados:', error);
        setSuccessMessage("Erro ao gerar ata. Tente novamente.");
      }
    }
  };

  const handleClear = () => {
    setFormData({
      participantes: "",
      dataHora: "",
      local: "",
      convocadoPor: "",
      transcricao: "",
    });
    setErrors({});
    setSuccessMessage("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header com logo */}
      <header className="w-full bg-primary py-6">
        <div className="container mx-auto px-4 flex justify-center">
          <img
            src="/src/assets/Logo_branco_horizontal.png"
            alt="Logo"
            className="h-12 md:h-16"
          />
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Título e descrição */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Gerador de Ata de Reunião com IA
          </h1>
          <p className="text-lg text-muted-foreground">
            Preencha os dados da reunião, cole a transcrição e gere automaticamente a ata.
          </p>
        </div>

        {/* Card "Como funciona?" */}
        <div className="bg-card border border-border rounded-lg p-8 mb-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Como funciona?
          </h2>
          <ol className="space-y-3 text-card-foreground">
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold mr-4 flex-shrink-0">
                1
              </span>
              <span className="pt-1">
                Copie a transcrição da reunião a partir do sistema de transcrição.
              </span>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold mr-4 flex-shrink-0">
                2
              </span>
              <span className="pt-1">
                Preencha os dados da reunião nos campos abaixo.
              </span>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold mr-4 flex-shrink-0">
                3
              </span>
              <span className="pt-1">
                Cole a transcrição completa no campo "Transcrição da reunião".
              </span>
            </li>
            <li className="flex items-start">
              <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-semibold mr-4 flex-shrink-0">
                4
              </span>
              <span className="pt-1">
                Clique em "Gerar ata da reunião" para enviar os dados para processamento (integração com IA/n8n será adicionada depois).
              </span>
            </li>
          </ol>
        </div>

        {/* Card com formulário */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Dados da reunião
          </h2>

          {/* Mensagem de sucesso */}
          {successMessage && (
            <div className="mb-6 p-4 bg-primary/10 border border-primary rounded-lg text-foreground">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Grid responsivo para os primeiros 4 campos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Participantes */}
              <div>
                <label
                  htmlFor="participantes"
                  className="block text-sm font-medium text-card-foreground mb-2"
                >
                  Participantes *
                </label>
                <input
                  type="text"
                  id="participantes"
                  name="participantes"
                  value={formData.participantes}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome dos participantes"
                />
                {errors.participantes && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.participantes}
                  </p>
                )}
              </div>

              {/* Data e hora */}
              <div>
                <label
                  htmlFor="dataHora"
                  className="block text-sm font-medium text-card-foreground mb-2"
                >
                  Data e hora *
                </label>
                <input
                  type="datetime-local"
                  id="dataHora"
                  name="dataHora"
                  value={formData.dataHora}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.dataHora && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.dataHora}
                  </p>
                )}
              </div>

              {/* Local */}
              <div>
                <label
                  htmlFor="local"
                  className="block text-sm font-medium text-card-foreground mb-2"
                >
                  Local *
                </label>
                <input
                  type="text"
                  id="local"
                  name="local"
                  value={formData.local}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Local da reunião"
                />
                {errors.local && (
                  <p className="text-sm text-destructive mt-1">{errors.local}</p>
                )}
              </div>

              {/* Convocado por */}
              <div>
                <label
                  htmlFor="convocadoPor"
                  className="block text-sm font-medium text-card-foreground mb-2"
                >
                  Convocado por *
                </label>
                <input
                  type="text"
                  id="convocadoPor"
                  name="convocadoPor"
                  value={formData.convocadoPor}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome do convocador"
                />
                {errors.convocadoPor && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.convocadoPor}
                  </p>
                )}
              </div>
            </div>

            {/* Transcrição (sempre 100% largura) */}
            <div>
              <label
                htmlFor="transcricao"
                className="block text-sm font-medium text-card-foreground mb-2"
              >
                Transcrição da reunião *
              </label>
              <textarea
                id="transcricao"
                name="transcricao"
                value={formData.transcricao}
                onChange={handleChange}
                rows={10}
                className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                placeholder="Cole aqui a transcrição completa da reunião..."
              />
              {errors.transcricao && (
                <p className="text-sm text-destructive mt-1">
                  {errors.transcricao}
                </p>
              )}
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-3 border-2 border-foreground text-foreground rounded-lg font-medium hover:bg-foreground hover:text-background transition-colors"
              >
                Limpar formulário
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary-dark transition-colors"
              >
                Gerar ata da reunião
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Index;
