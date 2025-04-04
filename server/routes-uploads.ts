import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { logger } from './utils/logger';
import { requireAuth } from './middleware/auth';

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Проверяем, существует ли директория, если нет - создаем
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`[Upload] Создана директория для загрузок: ${uploadDir}`);
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Генерируем уникальное имя файла с сохранением оригинального расширения
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

// Фильтр для проверки типов файлов
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Разрешенные типы файлов
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
  }
};

// Создаем middleware для загрузки
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: fileFilter
});

// Регистрируем маршруты для загрузки файлов
export function registerUploadRoutes(app: express.Express): void {
  const router = express.Router();
  
  // Middleware для всех маршрутов загрузки
  router.use(requireAuth);
  
  // Маршрут для загрузки одного изображения
  router.post('/upload/image', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не был загружен'
        });
      }
      
      // Формируем URL для доступа к загруженному файлу
      const fileUrl = `/uploads/${req.file.filename}`;
      
      return res.json({
        success: true,
        data: {
          url: fileUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });
    } catch (error) {
      logger.error(`[Upload] Ошибка при загрузке изображения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при загрузке файла'
      });
    }
  });
  
  // Маршрут для загрузки нескольких изображений
  router.post('/upload/images', upload.array('images', 10), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Файлы не были загружены'
        });
      }
      
      // Формируем массив URL для доступа к загруженным файлам
      const fileUrls = files.map(file => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
      
      return res.json({
        success: true,
        data: fileUrls
      });
    } catch (error) {
      logger.error(`[Upload] Ошибка при загрузке нескольких изображений: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при загрузке файлов'
      });
    }
  });
  
  // Обработчик ошибок multer
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      logger.error(`[Upload] Multer error: ${err.message}`);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'Размер файла превышает допустимый лимит (10 MB)'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: `Ошибка загрузки: ${err.message}`
      });
    }
    
    if (err) {
      logger.error(`[Upload] Error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
    
    next();
  });
  
  // Подключаем маршруты к приложению с префиксом /api
  app.use('/api', router);
}