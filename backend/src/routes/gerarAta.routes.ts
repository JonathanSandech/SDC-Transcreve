import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

// Endpoint para gerar ata completa
router.post('/gerar-ata', async (req: Request, res: Response) => {
  try {
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    const scriptPath = path.join(__dirname, '../../python/gerador_ata/gerar_ata.py');

    // Verificar se script existe
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        status: 'erro',
        mensagem: 'Script Python não encontrado',
        detalhes: scriptPath
      });
    }

    const python = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Enviar dados para o Python via stdin
    python.stdin.write(JSON.stringify(req.body));
    python.stdin.end();

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python stderr:', errorOutput);
        return res.status(500).json({
          status: 'erro',
          mensagem: 'Erro ao processar geração de ata',
          detalhes: errorOutput
        });
      }

      try {
        // Extrair apenas a última linha JSON do output (ignorar logs de debug)
        const lines = output.trim().split('\n');
        const jsonLine = lines[lines.length - 1];

        console.log('📝 Output completo recebido:', output.length, 'bytes');

        const result = JSON.parse(jsonLine);

        // Se for erro, logar JSON completo para debug
        if (result.status === 'erro') {
          console.log('❌ ERRO COMPLETO:', JSON.stringify(result, null, 2));
        } else {
          console.log('📦 JSON extraído:', jsonLine.substring(0, 100) + '...');
        }

        return res.json(result);
      } catch (e) {
        console.error('❌ Erro ao parsear output Python');
        console.error('Output completo:', output);
        console.error('Erro:', e);
        return res.status(500).json({
          status: 'erro',
          mensagem: 'Erro ao processar resposta do Python',
          detalhes: String(e)
        });
      }
    });

    python.on('error', (error) => {
      console.error('Erro ao executar Python:', error);
      return res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao executar script Python',
        detalhes: error.message
      });
    });

  } catch (err: any) {
    console.error('Erro no endpoint gerar-ata:', err);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro interno do servidor',
      detalhes: err.message
    });
  }
});

// Endpoint para download de ata gerada
router.get('/download-ata/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Sanitizar nome do arquivo (prevenir path traversal)
    const safeFilename = path.basename(filename);
    const outputDir = path.join(__dirname, '../../python/gerador_ata/output');
    const filePath = path.join(outputDir, safeFilename);

    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'erro',
        mensagem: 'Arquivo não encontrado'
      });
    }

    // Enviar arquivo
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error('Erro ao fazer download:', err);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'erro',
            mensagem: 'Erro ao fazer download do arquivo'
          });
        }
      }
    });

  } catch (err: any) {
    console.error('Erro no download de ata:', err);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao processar download',
      detalhes: err.message
    });
  }
});

// Endpoint para verificar status do Ollama
router.get('/ollama/status', async (req: Request, res: Response) => {
  try {
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    // Script Python simples para verificar Ollama
    const checkScript = `
import sys
import json
try:
    from gerador_ata.ollama_service import ollama_service
    from gerador_ata import config_ata

    is_online = ollama_service.check_health()
    modelos = ollama_service.list_models() if is_online else []

    result = {
        'status': 'online' if is_online else 'offline',
        'modelo_configurado': config_ata.OLLAMA_MODEL,
        'modelos_disponiveis': modelos,
        'url': config_ata.OLLAMA_BASE_URL
    }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'status': 'error', 'error': str(e)}))
`;

    const scriptPath = path.join(__dirname, '../../python/gerador_ata');
    const python = spawn(pythonPath, ['-c', checkScript], {
      cwd: path.join(__dirname, '../../python'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      try {
        const result = JSON.parse(output);
        const statusCode = result.status === 'online' ? 200 : 503;
        return res.status(statusCode).json(result);
      } catch (e) {
        return res.status(503).json({
          status: 'offline',
          modelo_configurado: '',
          modelos_disponiveis: [],
          url: ''
        });
      }
    });

  } catch (err: any) {
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao verificar status do Ollama',
      detalhes: err.message
    });
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    versao: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
