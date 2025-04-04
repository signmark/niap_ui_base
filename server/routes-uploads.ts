/**
 * Маршруты для обработки загрузки и получения файлов
 */

import { Express, Request, Response } from 'express';
import { log } from './vite';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import { getAuthTokenFromRequest } from './utils/auth';

// Загружаем переменные окружения
dotenv.config();

// Создаем директорию для хранения файлов, если её нет
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Конфигурируем multer для хранения файлов
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    // Генерируем уникальное имя файла
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Фильтр для проверки типов файлов
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}. Разрешены только: ${allowedMimeTypes.join(', ')}`));
  }
};

// Настройка загрузчика
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB максимальный размер файла
  },
  fileFilter: fileFilter
});

/**
 * Регистрирует маршруты для загрузки и получения файлов
 * @param app Express приложение
 */
export function registerUploadRoutes(app: Express) {
  // Маршрут для загрузки изображений
  app.post('/api/upload-image', upload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не был загружен'
        });
      }

      const filename = req.file.filename;
      const filePath = req.file.path;
      const fileUrl = `/uploads/${filename}`;

      log(`[uploads] Файл успешно загружен: ${filename}`);

      return res.json({
        success: true,
        data: {
          filename,
          filePath,
          url: fileUrl,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });
    } catch (error: any) {
      log(`[uploads] Ошибка при загрузке файла: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при загрузке файла'
      });
    }
  });

  // Маршрут для получения загруженного файла
  app.get('/uploads/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }

    // Определяем MIME-тип файла
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    switch(ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }

    res.set('Content-Type', contentType);
    res.sendFile(filePath);
  });

  // Прокси маршрут для получения файлов из Directus
  app.get('/api/proxy-image', async (req: Request, res: Response) => {
    try {
      const imageUrl = req.query.url as string;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'URL изображения не указан'
        });
      }

      // Получаем токен пользователя или администратора для доступа к Directus
      const token = getAuthTokenFromRequest(req) || process.env.DIRECTUS_ADMIN_TOKEN;

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация для доступа к изображению'
        });
      }

      // Выполняем запрос к Directus с токеном авторизации
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Устанавливаем заголовки для ответа
      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // Кэшируем на 24 часа

      // Отправляем данные изображения
      return res.send(response.data);
    } catch (error: any) {
      log(`[uploads] Ошибка при получении изображения через прокси: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при получении изображения'
      });
    }
  });
}