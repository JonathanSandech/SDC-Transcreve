# Sistema de Transcrição de Vídeos

Sistema interno para transcrição automática de reuniões corporativas usando IA.

## Desenvolvido por

**SDC Innovation Team**

Sistema de transcrição automática de vídeos usando IA (Whisper).

## Tecnologias
- Backend: Node.js + TypeScript + PostgreSQL
- Frontend: React + TypeScript + Tailwind CSS
- IA: Faster Whisper (GPU AMD ROCm)
- Infraestrutura: GPU AMD (Ex: RX 6600, RX 7800 XT)

## Recursos
- Transcrição com GPU (5-10x mais rápida)
- Progresso em tempo real
- Sistema de fila inteligente
- Acesso via hostname (No-IP)
- Múltiplos modelos (tiny, small, medium, large)

## Requisitos
- Node.js 18+
- Python 3.8+
- PostgreSQL (já configurado)

## Instalação

### Backend
```bash
cd backend
npm install
# Configure o .env com a senha do banco
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Acesso
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Configuração
Edite `backend/.env` e substitua `[INSIRA_SUA_SENHA_AQUI]` pela senha real do PostgreSQL.
