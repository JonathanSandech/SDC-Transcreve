# Refatoração V3: Multi-Process Chunking Architecture

## Data: 2025-11-25

## Objetivo

Eliminar completamente o crash de stack overflow (0xC0000409) em áudios longos movendo a lógica de chunking de Python para Node.js, transformando cada invocação Python em um processo curto (2-3 minutos), evitando acumulação de estado GPU/CUDA que causa o crash no Windows.

## Problema Original

- **Sintoma**: Crash com código 3221226505 (0xC0000409) ao processar áudios >60 minutos
- **Causa raiz**: Python rodando por tempo prolongado (50-84 minutos) acumula estado nas bibliotecas nativas (PyTorch/CUDA/ctranslate2), causando falha nos destrutores C++ mesmo com `os._exit()`
- **Tentativas anteriores**:
  - ✅ Forçar int8 para áudios >40min (melhorou mas não eliminou)
  - ✅ Cleanup em etapas com GPU sync (melhorou mas não eliminou)
  - ✅ Chunking em Python com modelo reutilizado (melhorou mas ainda crashava)
  - ❌ `os._exit()` para bypass de shutdown (ainda crashava)

## Arquitetura Nova

### Antes (V2)
```
Node.js → Python (processo único longo)
          └─ Carrega modelo
          └─ Chunk 1 (12min)
          └─ Chunk 2 (12min)
          └─ Chunk 3 (12min)
          └─ ...
          └─ Chunk N (12min)
          └─ Concatena
          └─ [CRASH AQUI] Cleanup/shutdown
```

### Depois (V3)
```
Node.js (orquestrador)
  ├─ Extrai áudio (ffmpeg)
  ├─ Divide em chunks (ffmpeg)
  ├─ Python (processo 1) → Chunk 1 → exit(0) ✅
  ├─ Python (processo 2) → Chunk 2 → exit(0) ✅
  ├─ Python (processo 3) → Chunk 3 → exit(0) ✅
  └─ ...
  └─ Python (processo N) → Chunk N → exit(0) ✅
  └─ Concatena resultados
```

**Benefícios**:
- ✅ Cada processo Python vive apenas 2-3 minutos
- ✅ Sem acumulação de estado GPU entre chunks
- ✅ Crash (se ocorrer) afeta apenas 1 chunk, não toda transcrição
- ✅ Possibilidade futura de paralelizar chunks (N processos simultâneos)

## Alterações Implementadas

### 1. Python: Novo modo `--simple`

**Arquivo**: `backend/python/transcribe.py`

**Mudanças**:
```python
import argparse

def transcribe_simple(audio_path, model_size='medium'):
    """
    Transcreve um único chunk de áudio (~12 minutos)
    Processo curto: carrega modelo → transcreve → retorna texto → exit
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "int8"  # Sempre int8 para chunks

    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(audio_path, language="pt", vad_filter=True, ...)

    texts = [seg.text.strip() for seg in segments]
    return ' '.join(texts)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input_path')
    parser.add_argument('model_size', nargs='?', default='medium')
    parser.add_argument('--simple', action='store_true')

    args = parser.parse_args()

    # MODO SIMPLES: apenas um chunk
    if args.simple:
        text = transcribe_simple(args.input_path, args.model_size)
        result = {'success': True, 'text': text, 'processing_time': ...}
        print(json.dumps(result))
        os._exit(0)  # Sair imediatamente

    # MODO NORMAL: mantém lógica antiga para retrocompatibilidade
    # (usado para áudios <40min que não precisam de chunking)
    else:
        # ... código existente ...
```

**Características**:
- Flag `--simple`: modo worker para processar 1 chunk
- Sempre usa `int8` (eficiente e rápido)
- Retorna JSON com `{success, text, processing_time}`
- `os._exit(0)` garante saída rápida sem cleanup complexo

### 2. Node.js: Funções auxiliares

**Arquivo**: `backend/src/services/transcription.service.ts`

#### 2.1. `extractAudioFromVideo()`
```typescript
/**
 * Extrai áudio de vídeo usando ffmpeg
 * @returns Caminho do arquivo MP3 ou null se já for áudio
 */
private async extractAudioFromVideo(videoPath: string): Promise<string | null> {
  // Se já for áudio (.mp3, .wav, etc), retornar null
  if (isAudioFile(videoPath)) return null;

  // Extrair usando ffmpeg
  ffmpeg -y -i video.mp4 -vn -acodec libmp3lame video.mp3

  return audioPath;
}
```

#### 2.2. `splitAudioIntoChunks()`
```typescript
/**
 * Divide áudio em chunks de 12 minutos usando ffmpeg
 * @returns Array de caminhos dos chunks
 */
private async splitAudioIntoChunks(audioPath: string, chunkDuration = 720): Promise<string[]> {
  const tempDir = mkdtemp('audio_chunks_');

  // Usar ffmpeg segment (rápido, sem re-encoding)
  ffmpeg -y -i audio.mp3 -f segment -segment_time 720 -c copy chunk_%03d.mp3

  return [chunk_000.mp3, chunk_001.mp3, ...];
}
```

#### 2.3. `getAudioDuration()`
```typescript
/**
 * Obtém duração do arquivo usando ffprobe
 * @returns Duração em segundos
 */
private async getAudioDuration(filePath: string): Promise<number> {
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 file.mp4

  return duration;
}
```

#### 2.4. `transcribeSingleChunk()`
```typescript
/**
 * Transcreve 1 chunk usando Python em modo --simple
 * @returns {text, processingTime}
 */
private async transcribeSingleChunk(
  chunkPath: string,
  modelSize: string,
  chunkNumber: number,
  totalChunks: number
): Promise<{text: string; processingTime: number}> {

  // Spawn Python com --simple
  python transcribe.py chunk_000.mp3 medium --simple

  // Parse resultado JSON
  const result = JSON.parse(stdout);
  return {text: result.text, processingTime: result.processing_time};
}
```

### 3. Node.js: Refatoração de `processTranscription()`

**Arquivo**: `backend/src/services/transcription.service.ts`

**Mudanças principais**:

```typescript
async processTranscription(id: string, filePath: string, modelSize: string) {
  const CHUNKING_THRESHOLD = 2400; // 40 minutos
  const CHUNK_DURATION = 720; // 12 minutos

  // 1. Obter duração do arquivo
  const duration = await this.getAudioDuration(filePath);

  // 2. Decidir estratégia
  const useChunking = duration > CHUNKING_THRESHOLD || fileSizeMB > 500;

  if (useChunking) {
    // ESTRATÉGIA MULTI-PROCESS

    // a) Extrair áudio (se for vídeo)
    sendProgress(id, 5, 'Extraindo áudio...');
    const extractedAudio = await this.extractAudioFromVideo(filePath);
    const audioPath = extractedAudio || filePath;

    // b) Dividir em chunks
    sendProgress(id, 10, 'Dividindo em chunks...');
    const chunks = await this.splitAudioIntoChunks(audioPath, CHUNK_DURATION);

    // c) Processar cada chunk (15-90%)
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      sendProgress(id, 15 + (i / chunks.length) * 75, `Chunk ${i+1}/${chunks.length}...`);

      const result = await this.transcribeSingleChunk(chunks[i], modelSize, i+1, chunks.length);
      results.push(result);

      // Deletar chunk após processar (liberar espaço)
      await fs.unlink(chunks[i]);
    }

    // d) Concatenar resultados
    sendProgress(id, 90, 'Concatenando...');
    const fullText = results.map(r => r.text).join(' ');
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);

    // e) Salvar no banco
    await this.dbService.updateTranscription(id, fullText, totalTime);

    sendProgress(id, 100, 'Concluído!');

  } else {
    // ESTRATÉGIA DIRETA (arquivos <40min)
    // Usar Python em modo normal (sem --simple)
    const result = await this.runPythonScript(filePath, modelSize, id, timeout);
    // ... código existente ...
  }
}
```

**Mapeamento de progresso**:
- 0-5%: Upload (frontend)
- 5-10%: Extração de áudio + chunking
- 10-90%: Processamento de N chunks (distribuído igualmente)
- 90-95%: Concatenação
- 95-100%: Salvamento no banco

## Thresholds e Configurações

| Parâmetro | Valor | Justificativa |
|-----------|-------|---------------|
| `CHUNKING_THRESHOLD` | 2400s (40min) | Áudios >40min historicamente problemáticos |
| `CHUNK_DURATION` | 720s (12min) | Balance entre: overhead de spawning vs duração por processo |
| `compute_type` (chunks) | `int8` | Sempre int8 para chunks (eficiência) |
| `compute_type` (direto) | `float16` (GPU) ou `int8` (CPU) | Qualidade vs performance |

## Arquivos Modificados

### 1. `backend/python/transcribe.py`
- ✅ Adicionado import `argparse`
- ✅ Criada função `transcribe_simple(audio_path, model_size)`
- ✅ Refatorada `main()` para suportar flag `--simple`
- ✅ Mantida retrocompatibilidade com modo normal

### 2. `backend/src/services/transcription.service.ts`
- ✅ Adicionados imports: `spawnSync`, `existsSync`
- ✅ Criada função `extractAudioFromVideo()`
- ✅ Criada função `splitAudioIntoChunks()`
- ✅ Criada função `getAudioDuration()`
- ✅ Criada função `transcribeSingleChunk()`
- ✅ Refatorada `processTranscription()` com multi-process strategy
- ✅ Mantida estratégia direta para arquivos <40min

## Testes Necessários

### ✅ Compilação TypeScript
```bash
cd backend
npx tsc --noEmit
# ✅ Sem erros
```

### ⏳ Teste funcional pendente
```bash
# Teste 1: Áudio curto (deve usar estratégia direta)
# Upload: arquivo de 20 minutos
# Esperado: Sem chunking, transcrito diretamente

# Teste 2: Áudio longo (deve usar multi-process)
# Upload: arquivo de 84 minutos
# Esperado:
# - 7 chunks de ~12min cada
# - 7 processos Python independentes
# - Sem crash 0xC0000409
# - Transcrição completa concatenada
```

## Benefícios Esperados

### Performance
- ✅ **Processos curtos**: cada Python vive apenas 2-3 minutos
- ✅ **Memória controlada**: sem acumulação entre chunks
- ✅ **Escalabilidade**: preparado para paralelização futura

### Confiabilidade
- ✅ **Crash isolado**: se 1 chunk falhar, apenas ele é afetado
- ✅ **Retry granular**: possível re-tentar apenas chunk que falhou
- ✅ **Cleanup automático**: chunks deletados após processamento

### Manutenibilidade
- ✅ **Separação de responsabilidades**:
  - Node.js = orquestração, I/O, progress
  - Python = IA, transcrição
- ✅ **Logs detalhados**: cada chunk logado individualmente
- ✅ **Retrocompatibilidade**: modo direto mantido para arquivos pequenos

## Próximos Passos

1. ✅ **Implementação concluída**
2. ✅ **Compilação TypeScript validada**
3. ⏳ **Teste com arquivo de 84 minutos** (pendente - aguardando execução pelo usuário)
4. ⏳ **Validação em produção**
5. ⏳ **Considerar paralelização** (processar múltiplos chunks simultaneamente)
6. ⏳ **Implementar retry por chunk** (se 1 chunk falhar, retentar apenas ele)

## Notas Técnicas

### Diferenças vs V2
| Aspecto | V2 (Python chunking) | V3 (Node.js chunking) |
|---------|---------------------|----------------------|
| Quem faz chunking? | Python (ffmpeg) | Node.js (ffmpeg) |
| Duração processo Python | 50-84 minutos | 2-3 minutos |
| Reutilização de modelo | Sim (1 modelo para todos) | Não (1 modelo por chunk) |
| Overhead spawning | 1x (início) | N× (1 por chunk) |
| Estado GPU acumulado | Alto (>60min) | Baixo (<3min) |
| Risco de crash | Alto | Muito baixo |

### Trade-offs

**Prós da V3**:
- ✅ Elimina crash de stack overflow
- ✅ Processos independentes (mais robusto)
- ✅ Preparado para paralelização
- ✅ Cleanup mais simples

**Contras da V3**:
- ⚠️ Overhead de spawning (N processos vs 1)
- ⚠️ Overhead de loading modelo (N vezes vs 1)
- ⚠️ Mais complexidade em Node.js

**Mitigação dos contras**:
- Uso de int8 (loading rápido)
- Chunks de 12min (balance entre overhead e duração)
- Paralelização futura compensará overhead

## Comandos de Teste

### Teste manual do modo --simple
```bash
# Testar Python em modo simples
cd backend
python python/transcribe.py "caminho/para/chunk_001.mp3" medium --simple

# Esperado: JSON com {success: true, text: "...", processing_time: ...}
```

### Teste integrado
```bash
# 1. Compilar TypeScript
cd backend
npm run build

# 2. Iniciar servidor
npm run dev

# 3. Upload de arquivo longo via frontend
# Frontend → http://localhost:3000
# Upload: arquivo de 84 minutos

# 4. Monitorar logs do servidor
# Esperado:
# - "Using multi-process chunking strategy"
# - "Split into 7 chunks"
# - "Transcribing chunk 1/7", ..., "chunk 7/7"
# - "Multi-process transcription completed"
```

## Referências

- **Issue original**: Stack overflow em arquivos de 50+ minutos
- **Código de erro**: 3221226505 (0xC0000409) - Stack Buffer Overrun
- **Causa raiz**: Destrutores nativos PyTorch/CUDA no Windows
- **Documentos anteriores**:
  - `SOLUCAO_CRASH.md` (V1 e V2)
  - `review.md` (análise de tentativas anteriores)
