/**
 * Copia texto para a área de transferência com fallback para contextos inseguros (HTTP)
 *
 * A Clipboard API moderna (navigator.clipboard) requer contexto seguro (HTTPS),
 * mas funciona em localhost. Para ambientes HTTP em produção, usamos o método
 * legado document.execCommand como fallback.
 *
 * @param text - Texto a ser copiado
 * @returns Promise que resolve quando o texto é copiado com sucesso
 * @throws Error com mensagem descritiva se a cópia falhar
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Tenta usar a Clipboard API moderna primeiro (HTTPS ou localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('✓ Texto copiado usando Clipboard API');
      return;
    } catch (err) {
      console.warn('Clipboard API falhou, tentando fallback:', err);
      // Se falhar, tenta o fallback abaixo
    }
  }

  // Fallback para contextos inseguros (HTTP em produção)
  try {
    // Cria elemento temporário
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Estilos para torná-lo invisível mas funcional
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // Tenta copiar usando o comando legado
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error('Comando de cópia falhou');
    }

    console.log('✓ Texto copiado usando execCommand (fallback)');
  } catch (err) {
    console.error('Erro ao copiar texto:', err);
    throw new Error('Não foi possível copiar o texto. Tente usar Ctrl+C manualmente.');
  }
}

/**
 * Verifica se a Clipboard API está disponível no contexto atual
 * @returns true se a Clipboard API moderna está disponível
 */
export function isClipboardAPIAvailable(): boolean {
  return !!(navigator.clipboard && window.isSecureContext);
}
