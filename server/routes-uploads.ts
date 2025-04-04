import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';

// Создаем роутер для загрузки файлов
const router = express.Router();

// Конфигурация хранилища multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Определяем директорию для загрузки файлов
    const uploadDir = path.join(process.cwd(), 'uploads');
    const targetDir = path.join(uploadDir, 'images');
    
    // Создаем директории, если они не существуют
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Создаем уникальное имя файла с сохранением оригинального расширения
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    cb(null, fileName);
  }
});

// Фильтр файлов - принимаем только изображения
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP, SVG)'));
  }
};

// Настраиваем multer
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Максимальный размер файла - 10MB
  },
  fileFilter
});

// Маршрут для загрузки изображений
router.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    // Проверяем, был ли загружен файл
    if (!req.file) {
      logger.warn('[Uploads] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Получаем путь к загруженному файлу
    const filePath = path.join('/uploads/images', req.file.filename);
    
    logger.info(`[Uploads] File successfully uploaded: ${req.file.filename}`);
    
    // Возвращаем информацию о загруженном файле
    res.status(200).json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: filePath,
        url: filePath
      }
    });
  } catch (error) {
    logger.error(`[Uploads] Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;