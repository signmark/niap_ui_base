/**
 * Маршруты для загрузки файлов изображений
 */

import { Express, Request, Response } from 'express';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { log } from './utils/logger';

// Создаем директорию для хранения загруженных файлов, если она не существует
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настраиваем хранилище для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла с сохранением расширения
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Принимаем только изображения
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый формат файла. Разрешены только изображения (JPEG, PNG, GIF, WEBP, SVG)'));
  }
};

// Настраиваем middleware загрузки
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Максимальный размер файла - 5МБ
  },
  fileFilter: fileFilter
});

// Получение токена из заголовка авторизации
function getAuthTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}

// Middleware для проверки аутентификации
const authenticateUser = (req: Request, res: Response, next: Function) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация'
    });
  }
  next();
};

/**
 * Регистрирует маршруты для загрузки файлов
 */
export function registerUploadRoutes(app: Express) {
  // Эндпоинт для загрузки одного изображения
  app.post('/api/upload-image', authenticateUser, upload.single('image'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не загружен'
        });
      }

      // Создаем URL для доступа к загруженному файлу
      const fileUrl = `/uploads/${req.file.filename}`;
      log(`[uploads] Файл успешно загружен: ${fileUrl}`);

      return res.json({
        success: true,
        fileUrl: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error: any) {
      log(`[uploads] Ошибка при загрузке файла: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при загрузке файла'
      });
    }
  });

  // Эндпоинт для загрузки нескольких изображений
  app.post('/api/upload-multiple-images', authenticateUser, upload.array('images', 10), (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Файлы не загружены'
        });
      }

      // Создаем URL для каждого загруженного файла
      const fileUrls = files.map(file => ({
        fileUrl: `/uploads/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));

      log(`[uploads] Успешно загружено ${files.length} файлов`);

      return res.json({
        success: true,
        files: fileUrls
      });
    } catch (error: any) {
      log(`[uploads] Ошибка при загрузке файлов: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при загрузке файлов'
      });
    }
  });

  // Добавим обработчик ошибок для multer
  app.use((err: any, req: Request, res: Response, next: Function) => {
    if (err instanceof multer.MulterError) {
      // Ошибка multer
      log(`[uploads] Ошибка Multer: ${err.message}`);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    } else if (err) {
      // Другие ошибки
      log(`[uploads] Ошибка: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
    next();
  });

  // Статический маршрут для доступа к загруженным файлам
  app.use('/uploads', (req: Request, res: Response, next: Function) => {
    log(`[uploads] Запрос файла: ${req.path}`);
    next();
  }, (req, res, next) => {
    // Добавляем заголовки для браузера, чтобы разрешить кэширование
    res.set({
      'Cache-Control': 'public, max-age=86400',
      'Pragma': 'no-cache'
    });
    next();
  }, express.static(uploadDir));

  log(`[uploads] Маршруты загрузки файлов успешно зарегистрированы`);
}