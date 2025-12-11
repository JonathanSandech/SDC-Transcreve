#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de transcrição otimizado para arquivos grandes
Usa streaming e processamento incremental para evitar stack overflow
Otimizações: openai-whisper com suporte AMD ROCm
"""

import sys
import io
import json
import time
import os
import gc
import tempfile
import subprocess
from pathlib import Path
from moviepy import VideoFileClip, AudioFileClip
import torch
import whisper

# Forçar UTF-8 no stdout e stderr ANTES de qualquer print
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def send_progress(progress: int, message: str):
    """Envia mensagem de progresso para stderr"""
    print(f"PROGRESS:{progress}:{message}", file=sys.stderr, flush=True)

def is_audio_file(file_path):
    """Verifica se o arquivo é áudio puro"""
    audio_extensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.wma']
    ext = Path(file_path).suffix.lower()
    return ext in audio_extensions

def get_duration(file_path):
    """Obtém duração do áudio/vídeo em segundos"""
    try:
        if is_audio_file(file_path):
            audio = AudioFileClip(file_path)
            duration = audio.duration
            audio.close()
        else:
            video = VideoFileClip(file_path)
            duration = video.duration
            video.close()
        return duration
    except:
        return 0

def prepare_audio(input_path):
    """Prepara arquivo de áudio para transcrição"""
    try:
        if is_audio_file(input_path):
            print(f"✅ Input is audio file, using directly: {input_path}", file=sys.stderr)
            send_progress(15, "Áudio detectado, processando...")
            return input_path, False

        print(f"🎬 Input is video file, extracting audio...", file=sys.stderr)
        send_progress(10, "Extraindo áudio do vídeo...")

        audio_path = input_path.rsplit('.', 1)[0] + '.mp3'

        video = VideoFileClip(input_path)
        video.audio.write_audiofile(audio_path, logger=None)
        video.close()

        print(f"✅ Audio extracted to: {audio_path}", file=sys.stderr)
        send_progress(15, "Áudio extraído com sucesso")
        return audio_path, True

    except Exception as e:
        raise Exception(f"Error preparing audio: {str(e)}")

def check_ffmpeg_installed():
    """
    Verifica se ffmpeg está instalado e retorna o caminho do executável.

    Search order:
    1. FFMPEG_PATH environment variable (explicitly set by Node.js)
    2. IMAGEIO_FFMPEG_EXE environment variable (used by moviepy/imageio_ffmpeg)
    3. System PATH ('ffmpeg')

    Returns:
        str: Path to working ffmpeg executable, or None if not found
    """
    # Priority 1: FFMPEG_PATH env var (set by Node.js service)
    ffmpeg_env = os.environ.get('FFMPEG_PATH')
    if ffmpeg_env:
        try:
            result = subprocess.run([ffmpeg_env, '-version'],
                                    capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✅ Found ffmpeg via FFMPEG_PATH: {ffmpeg_env}", file=sys.stderr)
                return ffmpeg_env
        except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError) as e:
            print(f"⚠️ FFMPEG_PATH set but invalid ({ffmpeg_env}): {e}", file=sys.stderr)

    # Priority 2: IMAGEIO_FFMPEG_EXE env var (used by moviepy)
    imageio_env = os.environ.get('IMAGEIO_FFMPEG_EXE')
    if imageio_env:
        try:
            result = subprocess.run([imageio_env, '-version'],
                                    capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✅ Found ffmpeg via IMAGEIO_FFMPEG_EXE: {imageio_env}", file=sys.stderr)
                return imageio_env
        except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError) as e:
            print(f"⚠️ IMAGEIO_FFMPEG_EXE set but invalid ({imageio_env}): {e}", file=sys.stderr)

    # Priority 3: System PATH
    try:
        result = subprocess.run(['ffmpeg', '-version'],
                                capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"✅ Found ffmpeg in system PATH", file=sys.stderr)
            return 'ffmpeg'
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        pass

    # Nothing found
    print("❌ ffmpeg not found in any location", file=sys.stderr)
    return None

def split_audio_into_chunks(audio_path, chunk_duration=720):
    """
    Divide áudio em chunks usando ffmpeg

    Args:
        audio_path: caminho do arquivo de áudio
        chunk_duration: duração de cada chunk em segundos (default: 720 = 12 minutos)

    Returns:
        Lista de caminhos para os chunks criados e o diretório temporário
    """
    # Get ffmpeg path
    ffmpeg_path = check_ffmpeg_installed()
    if not ffmpeg_path:
        raise Exception("ffmpeg not found. Cannot split audio into chunks. "
                        "Please install ffmpeg or set FFMPEG_PATH environment variable.")

    # Criar diretório temporário para chunks
    temp_dir = tempfile.mkdtemp(prefix='audio_chunks_')
    chunk_pattern = os.path.join(temp_dir, 'chunk_%03d.mp3')

    print(f"📁 Splitting audio into {chunk_duration}s chunks using: {ffmpeg_path}", file=sys.stderr)

    # Usar ffmpeg para dividir áudio sem re-encoding (rápido)
    cmd = [
        ffmpeg_path,  # Use detected path instead of hardcoded 'ffmpeg'
        '-i', audio_path,
        '-f', 'segment',
        '-segment_time', str(chunk_duration),
        '-c', 'copy',  # Copiar sem re-encoding
        '-reset_timestamps', '1',  # Reset timestamps para cada chunk
        chunk_pattern
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ ffmpeg error: {e.stderr}", file=sys.stderr)
        raise Exception(f"Failed to split audio: {e.stderr}")

    # Listar chunks criados
    chunk_files = sorted([
        os.path.join(temp_dir, f)
        for f in os.listdir(temp_dir)
        if f.startswith('chunk_') and f.endswith('.mp3')
    ])

    print(f"✅ Created {len(chunk_files)} chunks", file=sys.stderr)
    return chunk_files, temp_dir

def get_whisper_options(duration):
    """Opções de transcrição baseadas na duração do áudio"""
    options = {
        'language': 'pt',
        'verbose': False,
        'condition_on_previous_text': True,
        'temperature': 0.0,
    }

    if duration >= 3600:  # > 1 hora
        options.update({
            'condition_on_previous_text': False,
            'beam_size': 1,
        })
        print(f"⚠️ Very long video ({duration/3600:.1f}h): using minimal config", file=sys.stderr)
    elif duration >= 1800:  # 30-60 minutos
        options.update({
            'condition_on_previous_text': False,
            'beam_size': 3,
        })
        print(f"⚠️ Long video ({duration/60:.1f}min): using conservative config", file=sys.stderr)
    elif duration >= 600:  # 10-30 minutos
        options.update({
            'beam_size': 5,
        })
        print(f"📊 Medium video ({duration/60:.1f}min): using balanced config", file=sys.stderr)
    else:
        print(f"✅ Short video ({duration/60:.1f}min): using quality config", file=sys.stderr)

    return options

def transcribe_audio_streaming(audio_path, model_size='medium'):
    """
    Transcreve áudio usando openai-whisper
    Suporta GPU AMD via ROCm
    """
    try:
        send_progress(5, "Iniciando transcrição...")

        # WORKAROUND: Forçar CPU para evitar crash no driver AMD
        device = "cpu"
        print(f"🖥️ WORKAROUND: Forcing CPU to avoid AMD driver crash. Using device: {device}", file=sys.stderr)

        # Obter duração e opções
        duration = get_duration(audio_path)
        options = get_whisper_options(duration)

        send_progress(10, "Carregando modelo de IA...")

        # Carregar modelo whisper
        model = whisper.load_model(model_size, device=device)

        send_progress(20, "Modelo carregado, iniciando transcrição...")

        # Transcrever
        print(f"Starting transcription...", file=sys.stderr)
        send_progress(30, "Processando transcrição...")

        fp16 = device == "cuda"

        result = model.transcribe(
            audio_path,
            language="pt",
            fp16=fp16,
            beam_size=options.get('beam_size', 5),
            condition_on_previous_text=options['condition_on_previous_text'],
            temperature=options['temperature'],
            verbose=False
        )

        text = result["text"].strip()

        print(f"📊 Transcription completed: {len(text)} characters", file=sys.stderr)
        send_progress(92, "Finalizando transcrição...")

        # Limpar modelo da memória
        del model
        gc.collect()
        if device == "cuda":
            torch.cuda.empty_cache()

        send_progress(95, "Transcrição concluída!")

        return text

    except Exception as e:
        print(f"❌ Transcription error: {str(e)}", file=sys.stderr)
        raise Exception(f"Error transcribing audio: {str(e)}")

def check_gpu_memory(min_free_gb=2.0):
    """
    Verifica se há memória GPU suficiente disponível

    Args:
        min_free_gb: Mínimo de GB livre requerido (padrão: 2.0 GB)

    Returns:
        bool: True se há memória suficiente, False caso contrário
    """
    if not torch.cuda.is_available():
        return True  # CPU mode, sem limite

    try:
        free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
        free_gb = free_memory / (1024**3)

        print(f"📊 GPU Free Memory: {free_gb:.2f} GB", file=sys.stderr)

        if free_gb < min_free_gb:
            print(f"⚠️ Low GPU memory: {free_gb:.2f} GB (min required: {min_free_gb} GB)", file=sys.stderr)
            print(f"🧹 Attempting aggressive GPU cleanup...", file=sys.stderr)

            # Forçar limpeza agressiva
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            gc.collect()
            time.sleep(2)  # Esperar 2 segundos para liberação completa

            # Verificar novamente
            free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
            free_gb = free_memory / (1024**3)
            print(f"📊 GPU Free Memory after cleanup: {free_gb:.2f} GB", file=sys.stderr)

            return free_gb >= min_free_gb

        return True
    except Exception as e:
        print(f"⚠️ Error checking GPU memory: {e}", file=sys.stderr)
        return True  # Continuar mesmo se falhar verificação

def transcribe_simple(audio_path, model_size='medium'):
    """
    Transcrição simples de um único arquivo sem chunking interno.
    Usado pela arquitetura V3 onde cada processo Python processa apenas um chunk.
    Usa Whisper oficial (OpenAI) com suporte AMD ROCm.

    Args:
        audio_path: Caminho do arquivo de áudio (já é um chunk)
        model_size: Tamanho do modelo Whisper

    Returns:
        Texto transcrito
    """
    try:
        send_progress(10, "Iniciando transcrição (modo simples)...")

        # WORKAROUND: Forçar CPU para evitar crash no driver AMD
        device = "cpu"
        print(f"🖥️ WORKAROUND: Forcing CPU to avoid AMD driver crash. Using device: {device}", file=sys.stderr)

        # Obter duração
        duration = get_duration(audio_path)
        print(f"📊 Audio duration: {duration:.2f}s ({duration/60:.2f}min)", file=sys.stderr)

        send_progress(20, "Carregando modelo...")

        # Carregar modelo Whisper oficial
        print(f"Loading Whisper model: {model_size}", file=sys.stderr)
        model = whisper.load_model(model_size, device=device)

        send_progress(30, "Transcrevendo...")

        # Usar FP16 se GPU disponível
        fp16 = device == "cuda"

        # Transcrever com Whisper oficial
        result = model.transcribe(
            audio_path,
            language="pt",
            fp16=fp16,
            beam_size=5,
            condition_on_previous_text=True,
            temperature=0.0,
            verbose=False
        )

        text = result["text"].strip()

        print(f"✅ Transcribed {len(text)} characters", file=sys.stderr)

        send_progress(95, "Finalizando...")

        # Cleanup
        del model
        gc.collect()
        if device == "cuda":
            torch.cuda.empty_cache()

        return text

    except Exception as e:
        print(f"❌ Transcription error: {str(e)}", file=sys.stderr)
        raise Exception(f"Error transcribing audio: {str(e)}")

def transcribe_with_chunking(audio_path, model_size, duration):
    """
    Transcreve áudio dividindo em chunks para evitar crash em arquivos muito longos
    Usa Whisper oficial (OpenAI) com suporte AMD ROCm

    Args:
        audio_path: caminho do arquivo de áudio
        model_size: tamanho do modelo Whisper
        duration: duração total do áudio em segundos

    Returns:
        Texto transcrito completo
    """
    chunk_duration = 720  # 12 minutos por chunk
    chunk_files = []
    temp_dir = None

    try:
        send_progress(5, "Dividindo áudio em chunks...")

        # Dividir áudio em chunks
        chunk_files, temp_dir = split_audio_into_chunks(audio_path, chunk_duration)
        total_chunks = len(chunk_files)

        print(f"📊 Processing {total_chunks} chunks of {chunk_duration}s each", file=sys.stderr)
        send_progress(10, f"Processando {total_chunks} chunks...")

        # WORKAROUND: Forçar CPU para evitar crash no driver AMD
        device = "cpu"
        print(f"🖥️ WORKAROUND: Forcing CPU to avoid AMD driver crash. Using device: {device}", file=sys.stderr)

        # Processar cada chunk
        partial_results = []

        for i, chunk_path in enumerate(chunk_files):
            chunk_num = i + 1

            # Calcular progresso: 10% já usado, distribuir 80% entre chunks, 10% para finalização
            chunk_base_progress = 10 + int((i / total_chunks) * 80)
            chunk_end_progress = 10 + int(((i + 1) / total_chunks) * 80)

            send_progress(chunk_base_progress, f"Chunk {chunk_num}/{total_chunks}: carregando modelo...")
            print(f"🎤 Processing chunk {chunk_num}/{total_chunks}: {chunk_path}", file=sys.stderr)

            # Carregar modelo NOVO para cada chunk
            model = whisper.load_model(model_size, device=device)

            send_progress(chunk_base_progress + 2, f"Chunk {chunk_num}/{total_chunks}: transcrevendo...")

            # Usar FP16 se GPU disponível
            fp16 = device == "cuda"

            # Transcrever chunk com Whisper oficial
            result = model.transcribe(
                chunk_path,
                language="pt",
                fp16=fp16,
                beam_size=5,
                condition_on_previous_text=False,  # False para chunks independentes
                temperature=0.0,
                verbose=False
            )

            chunk_text = result["text"].strip()
            partial_results.append(chunk_text)

            print(f"✅ Chunk {chunk_num}/{total_chunks} completed: {len(chunk_text)} chars", file=sys.stderr)

            send_progress(chunk_end_progress - 2, f"Chunk {chunk_num}/{total_chunks}: limpando memória...")

            # CRÍTICO: Limpar modelo completamente antes do próximo chunk
            try:
                del model
            except Exception as e:
                print(f"⚠️ Erro ao deletar model do chunk {chunk_num}: {e}", file=sys.stderr)

            # Limpar memória
            gc.collect()
            if device == "cuda":
                try:
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                except Exception as e:
                    print(f"⚠️ Erro ao limpar GPU após chunk {chunk_num}: {e}", file=sys.stderr)

            send_progress(chunk_end_progress, f"Chunk {chunk_num}/{total_chunks} concluído")

        # Concatenar todos os resultados
        send_progress(92, "Concatenando resultados...")
        final_text = ' '.join(partial_results)

        print(f"✅ All chunks processed. Total text length: {len(final_text)} characters", file=sys.stderr)

        return final_text

    finally:
        # Limpar chunks temporários
        send_progress(95, "Limpando arquivos temporários...")
        if chunk_files:
            for chunk_path in chunk_files:
                try:
                    if os.path.exists(chunk_path):
                        os.unlink(chunk_path)
                except Exception as e:
                    print(f"⚠️ Erro ao deletar chunk {chunk_path}: {e}", file=sys.stderr)

        if temp_dir and os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except Exception as e:
                print(f"⚠️ Erro ao deletar diretório temporário {temp_dir}: {e}", file=sys.stderr)

def main():
    """Função principal com melhor tratamento de erros"""
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Missing file path argument'}))
        sys.exit(1)

    input_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'medium'

    # Parse --simple flag for single-chunk mode (V3 architecture)
    simple_mode = '--simple' in sys.argv
    if simple_mode:
        print(f"🔧 [SIMPLE MODE] Processing single file without internal chunking", file=sys.stderr)

    # Diagnostic: Log environment variables related to ffmpeg
    print(f"🔍 [DEBUG] FFMPEG_PATH env: {os.environ.get('FFMPEG_PATH', 'NOT SET')}", file=sys.stderr)
    print(f"🔍 [DEBUG] IMAGEIO_FFMPEG_EXE env: {os.environ.get('IMAGEIO_FFMPEG_EXE', 'NOT SET')}", file=sys.stderr)

    # Pre-check ffmpeg availability (early detection of issues)
    try:
        ffmpeg_path = check_ffmpeg_installed()
        if ffmpeg_path:
            print(f"✅ [STARTUP] ffmpeg detected: {ffmpeg_path}", file=sys.stderr)
        else:
            print(f"⚠️ [STARTUP] ffmpeg not found - chunking will fail if needed", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ [STARTUP] Error checking ffmpeg: {e}", file=sys.stderr)

    # Validar arquivo
    if not os.path.exists(input_path):
        print(json.dumps({'success': False, 'error': 'File not found'}))
        sys.exit(1)

    # Mostrar tamanho do arquivo
    file_size = os.path.getsize(input_path)
    print(f"📊 File size: {file_size / 1024**3:.2f} GB", file=sys.stderr)

    # Verificar se arquivo é muito grande e sugerir modelo menor
    if file_size > 2 * 1024**3 and model_size == 'large':  # > 2GB com modelo large
        print(f"⚠️ WARNING: Large file with large model. Consider using 'medium' or 'small' model.", file=sys.stderr)

    try:
        start_time = time.time()

        send_progress(1, "Analisando arquivo...")

        # Preparar áudio
        print(f"📂 Processing file: {input_path}", file=sys.stderr)
        audio_path, created_new_file = prepare_audio(input_path)

        # Obter duração do áudio para escolher estratégia
        duration = get_duration(audio_path)
        print(f"📊 Audio duration: {duration:.2f}s ({duration/60:.2f}min)", file=sys.stderr)

        # Threshold para chunking: 60 minutos (3600 segundos)
        CHUNKING_THRESHOLD = 3600

        # Transcrever (escolher estratégia baseado na duração e modo)
        print(f"🎤 Transcribing with model: {model_size}", file=sys.stderr)

        # Se --simple flag está presente, usar modo simples (V3 architecture)
        if simple_mode:
            print(f"✅ Simple mode: processing file directly", file=sys.stderr)
            text = transcribe_simple(audio_path, model_size)
        elif duration > CHUNKING_THRESHOLD:
            # DEPRECATED: Python chunking interno (será removido após V3 estar estável)
            print(f"⚠️ [DEPRECATED] Using Python internal chunking - will be replaced by V3", file=sys.stderr)
            print(f"⚠️ Long audio ({duration/60:.1f}min) detected: using chunking strategy", file=sys.stderr)
            text = transcribe_with_chunking(audio_path, model_size, duration)
        else:
            print(f"✅ Normal duration ({duration/60:.1f}min): using standard method", file=sys.stderr)
            text = transcribe_audio_streaming(audio_path, model_size)

        processing_time = int(time.time() - start_time)
        print(f"⏱️ Total time: {processing_time}s ({processing_time/60:.2f}min)", file=sys.stderr)

        send_progress(98, "Preparando resultado...")

        # Para textos muito grandes, considerar comprimir ou dividir
        text_size = len(text)
        if text_size > 5_000_000:  # > 5MB de texto
            print(f"⚠️ Very large text ({text_size} chars), consider post-processing", file=sys.stderr)

        # Preparar resultado
        result = {
            'success': True,
            'text': text,
            'audio_path': audio_path if created_new_file else None,
            'processing_time': processing_time,
            'input_type': 'audio' if is_audio_file(input_path) else 'video',
            'text_length': text_size
        }

        send_progress(100, "Transcrição concluída!")

        # Serializar e enviar resultado
        # IMPORTANTE: Sempre usar arquivo para textos > 30KB para evitar stack overflow
        # O json.dumps() com ensure_ascii=False pode causar crash em strings UTF-8 grandes
        OUTPUT_FILE_THRESHOLD = 30_000  # 30KB - limite seguro para stdout

        try:
            if text_size > OUTPUT_FILE_THRESHOLD:
                # Salvar em arquivo para evitar stack overflow no json.dumps()
                output_file = input_path.rsplit('.', 1)[0] + '_transcription.json'

                # Usar json.dump() direto no arquivo (mais seguro que json.dumps())
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False)

                # Enviar referência ao arquivo via stdout (JSON pequeno, seguro)
                small_result = {
                    'success': True,
                    'text_file': output_file,
                    'processing_time': processing_time,
                    'text_length': text_size
                }
                print(json.dumps(small_result))
            else:
                # Textos pequenos podem ir via stdout
                print(json.dumps(result, ensure_ascii=False))

            sys.stdout.flush()

        except Exception as json_error:
            # Fallback: se falhar, tentar salvar em arquivo
            print(f"⚠️ JSON serialization failed, using file fallback: {str(json_error)}", file=sys.stderr)
            try:
                output_file = input_path.rsplit('.', 1)[0] + '_transcription.json'
                with open(output_file, 'w', encoding='utf-8') as f:
                    # Escrever manualmente para evitar json.dumps()
                    f.write('{"success": true, "text": ')
                    f.write(json.dumps(text, ensure_ascii=False))
                    f.write(f', "processing_time": {processing_time}')
                    f.write(f', "text_length": {text_size}')
                    if created_new_file and audio_path:
                        f.write(f', "audio_path": "{audio_path}"')
                    f.write('}')

                fallback_result = {
                    'success': True,
                    'text_file': output_file,
                    'processing_time': processing_time,
                    'text_length': text_size
                }
                print(json.dumps(fallback_result))
                print(f"📤 Fallback: Result saved to file: {output_file}", file=sys.stderr)
            except Exception as fallback_error:
                print(f"❌ Fallback also failed: {str(fallback_error)}", file=sys.stderr)
                raise json_error

    except Exception as e:
        send_progress(0, f"Erro: {str(e)}")
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()