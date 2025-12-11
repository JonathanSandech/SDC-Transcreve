#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de transcrição otimizado para arquivos grandes
Usa streaming e processamento incremental para evitar stack overflow
Otimizações: openai-whisper com suporte NVIDIA CUDA
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
from moviepy.editor import VideoFileClip, AudioFileClip
import whisper
import torch

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
            with AudioFileClip(file_path) as audio:
                duration = audio.duration
        else:
            with VideoFileClip(file_path) as video:
                duration = video.duration
        return duration
    except Exception as e:
        print(f"⚠️  Could not get duration: {e}", file=sys.stderr)
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

        audio_path = str(Path(input_path).with_suffix('.mp3'))

        with VideoFileClip(input_path) as video:
            video.audio.write_audiofile(audio_path, logger=None)

        print(f"✅ Audio extracted to: {audio_path}", file=sys.stderr)
        send_progress(15, "Áudio extraído com sucesso")
        return audio_path, True

    except Exception as e:
        raise Exception(f"Error preparing audio: {str(e)}")


def check_ffmpeg_installed():
    """Verifica se ffmpeg está instalado e retorna o caminho do executável."""
    # No Docker, confiamos que o ffmpeg está no PATH
    try:
        result = subprocess.run(['ffmpeg', '-version'],
                                capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"✅ Found ffmpeg in system PATH", file=sys.stderr)
            return 'ffmpeg'
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        pass

    print("❌ ffmpeg not found in PATH", file=sys.stderr)
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
    ffmpeg_path = check_ffmpeg_installed()
    if not ffmpeg_path:
        raise Exception("ffmpeg not found. Cannot split audio into chunks.")

    temp_dir = tempfile.mkdtemp(prefix='audio_chunks_')
    chunk_pattern = os.path.join(temp_dir, 'chunk_%03d.mp3')

    print(f"📁 Splitting audio into {chunk_duration}s chunks using: {ffmpeg_path}", file=sys.stderr)

    cmd = [
        ffmpeg_path,
        '-i', audio_path,
        '-f', 'segment',
        '-segment_time', str(chunk_duration),
        '-c', 'copy',
        '-reset_timestamps', '1',
        chunk_pattern
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ ffmpeg error: {e.stderr}", file=sys.stderr)
        raise Exception(f"Failed to split audio: {e.stderr}")

    chunk_files = sorted([
        os.path.join(temp_dir, f)
        for f in os.listdir(temp_dir)
        if f.startswith('chunk_') and f.endswith('.mp3')
    ])

    print(f"✅ Created {len(chunk_files)} chunks", file=sys.stderr)
    return chunk_files, temp_dir

def check_gpu_memory(min_free_gb=2.0):
    """
    Verifica se há memória GPU suficiente disponível

    Args:
        min_free_gb: Mínimo de GB livre requerido (padrão: 2.0 GB)

    Returns:
        bool: True se há memória suficiente, False caso contrário
    """
    if not torch.cuda.is_available():
        return True  # Modo CPU, sem limite

    try:
        props = torch.cuda.get_device_properties(0)
        free_memory = props.total_memory - torch.cuda.memory_allocated(0)
        free_gb = free_memory / (1024**3)

        print(f"📊 GPU Free Memory: {free_gb:.2f} GB", file=sys.stderr)

        if free_gb < min_free_gb:
            print(f"⚠️ Low GPU memory: {free_gb:.2f} GB (min required: {min_free_gb} GB)", file=sys.stderr)
            # Tenta forçar a limpeza
            gc.collect()
            torch.cuda.empty_cache()
            time.sleep(1)
            # Verifica novamente
            free_memory = props.total_memory - torch.cuda.memory_allocated(0)
            free_gb = free_memory / (1024**3)
            print(f"📊 GPU Free Memory after cleanup: {free_gb:.2f} GB", file=sys.stderr)
            return free_gb >= min_free_gb

        return True
    except Exception as e:
        print(f"⚠️ Error checking GPU memory: {e}", file=sys.stderr)
        return True

def transcribe_simple(audio_path, model_size='medium'):
    """
    Transcrição de um único arquivo de áudio.
    Usa Whisper (OpenAI) com suporte a NVIDIA CUDA.

    Args:
        audio_path: Caminho do arquivo de áudio
        model_size: Tamanho do modelo Whisper

    Returns:
        Texto transcrito
    """
    model = None
    try:
        send_progress(10, "Iniciando transcrição...")

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"🖥️  Using device: {device}", file=sys.stderr)

        send_progress(20, "Carregando modelo...")

        if device == "cuda" and not check_gpu_memory(2.0):
            raise Exception("Insufficient GPU memory.")

        model = whisper.load_model(model_size, device=device)

        send_progress(30, "Transcrevendo...")
        fp16 = device == "cuda"

        result = model.transcribe(
            audio_path,
            language="pt",
            fp16=fp16,
            beam_size=5,
            temperature=0.0,
            verbose=False
        )

        text = result["text"].strip()
        print(f"✅ Transcribed {len(text)} characters", file=sys.stderr)
        send_progress(95, "Finalizando...")
        return text

    except Exception as e:
        print(f"❌ Transcription error: {str(e)}", file=sys.stderr)
        raise
    finally:
        if model:
            del model
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def transcribe_with_chunking(audio_path, model_size):
    """
    Transcreve áudio dividindo-o em chunks para evitar estouro de memória.
    Usa Whisper (OpenAI) com suporte a NVIDIA CUDA.

    Args:
        audio_path: Caminho do arquivo de áudio
        model_size: Tamanho do modelo Whisper

    Returns:
        Texto transcrito completo
    """
    chunk_duration = 720  # 12 minutos por chunk
    temp_dir = None
    chunk_files = []

    try:
        send_progress(5, "Dividindo áudio em chunks...")
        chunk_files, temp_dir = split_audio_into_chunks(audio_path, chunk_duration)
        total_chunks = len(chunk_files)
        print(f"📊 Processing {total_chunks} chunks...", file=sys.stderr)

        partial_results = []
        for i, chunk_path in enumerate(chunk_files):
            chunk_num = i + 1
            progress = 10 + int((i / total_chunks) * 80)
            send_progress(progress, f"Processando chunk {chunk_num}/{total_chunks}...")

            print(f"🎤 Processing chunk {chunk_num}/{total_chunks}...", file=sys.stderr)
            chunk_text = transcribe_simple(chunk_path, model_size)
            partial_results.append(chunk_text)

        send_progress(92, "Concatenando resultados...")
        return ' '.join(partial_results)

    finally:
        if temp_dir:
            for f in chunk_files:
                try:
                    os.unlink(f)
                except OSError as e:
                    print(f"⚠️ Error deleting chunk file {f}: {e}", file=sys.stderr)
            try:
                os.rmdir(temp_dir)
            except OSError as e:
                print(f"⚠️ Error deleting temp dir {temp_dir}: {e}", file=sys.stderr)


def main():
    """Função principal"""
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Missing file path argument'}))
        sys.exit(1)

    input_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'medium'

    if not os.path.exists(input_path):
        print(json.dumps({'success': False, 'error': 'File not found'}))
        sys.exit(1)

    audio_path = None
    created_new_file = False
    try:
        start_time = time.time()
        send_progress(1, "Analisando arquivo...")

        audio_path, created_new_file = prepare_audio(input_path)
        duration = get_duration(audio_path)
        print(f"📊 Audio duration: {duration/60:.2f} min", file=sys.stderr)

        # Usar chunking para áudios maiores que 1 hora
        CHUNKING_THRESHOLD = 3600

        if duration > CHUNKING_THRESHOLD:
            print(f"⚠️ Long audio detected, using chunking strategy", file=sys.stderr)
            text = transcribe_with_chunking(audio_path, model_size)
        else:
            print(f"✅ Normal duration, using standard method", file=sys.stderr)
            text = transcribe_simple(audio_path, model_size)

        processing_time = int(time.time() - start_time)
        print(f"⏱️ Total time: {processing_time/60:.2f} min", file=sys.stderr)

        # Lógica para evitar stack overflow em saídas grandes
        OUTPUT_FILE_THRESHOLD = 30_000  # 30KB
        text_size = len(text.encode('utf-8'))

        if text_size > OUTPUT_FILE_THRESHOLD:
            output_file = str(Path(input_path).with_suffix('.json'))
            result = {
                'success': True,
                'text_file': output_file,
                'processing_time': processing_time,
                'text_length': len(text)
            }
            # Salvar o texto grande em um arquivo separado
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({'text': text}, f, ensure_ascii=False)
            print(f"✅ Large output saved to file: {output_file}", file=sys.stderr)

        else:
            result = {
                'success': True,
                'text': text,
                'processing_time': processing_time,
                'text_length': len(text)
            }

        print(json.dumps(result, ensure_ascii=False))
        send_progress(100, "Transcrição concluída!")

    except Exception as e:
        send_progress(0, f"Erro: {str(e)}")
        error_result = {'success': False, 'error': str(e)}
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    finally:
        # Limpar arquivo de áudio extraído, se foi criado
        if created_new_file and audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
                print(f"🗑️  Deleted temporary audio file: {audio_path}", file=sys.stderr)
            except OSError as e:
                print(f"⚠️ Failed to delete temporary audio file {audio_path}: {e}", file=sys.stderr)

if __name__ == '__main__':
    main()
