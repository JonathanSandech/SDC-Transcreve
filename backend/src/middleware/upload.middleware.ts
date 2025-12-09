import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Formatos de vídeo
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];

  // Formatos de áudio
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.wma'];

  const allowedTypes = [...videoExtensions, ...audioExtensions];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Formato não suportado. Use:\nVídeo: MP4, AVI, MOV, MKV, WebM\nÁudio: MP3, WAV, M4A, FLAC, OGG'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648'), // 2GB
  },
});
