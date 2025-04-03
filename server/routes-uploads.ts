/**
 * Маршруты для загрузки файлов изображений через Directus API
 */

import { Express, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { log } from './utils/logger';
import { directusApiManager } from './directus';

// Настраиваем временное хранилище для multer (файлы будут храниться в памяти)
const storage = multer.memoryStorage();

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
 * Загружает файл в Directus через API
 * @param fileData Данные файла
 * @param fileName Имя файла
 * @param mimeType MIME-тип файла
 * @param token Токен авторизации Directus
 * @returns Объект с информацией о загруженном файле
 */
async function uploadToDirectus(fileData: Buffer, fileName: string, mimeType: string, token: string) {
  try {
    log(`[uploads] Подготовка загрузки файла в Directus: ${fileName}, тип: ${mimeType}`);
    log(`[uploads] Размер файла: ${fileData.length} байт`);
    log(`[uploads] Токен авторизации (первые 20 символов): ${token.substring(0, 20)}...`);
    
    const formData = new FormData();
    formData.append('file', fileData, {
      filename: fileName,
      contentType: mimeType
    });

    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    log(`[uploads] Отправка запроса на ${directusUrl}/files с токеном авторизации`);
    
    // Проверка доступа к Directus перед загрузкой файла
    try {
      log(`[uploads] Проверка доступа к Directus через /users/me`);
      const userResponse = await axios.get(`${directusUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      log(`[uploads] Проверка доступа успешна, пользователь: ${userResponse.data?.data?.id || 'unknown'}`);
    } catch (userError: any) {
      log(`[uploads] Ошибка при проверке доступа к Directus: ${userError.message}`);
      if (userError.response) {
        log(`[uploads] Статус ошибки: ${userError.response.status}`);
        log(`[uploads] Данные ошибки: ${JSON.stringify(userError.response.data)}`);
      }
      // Не прерываем выполнение, продолжаем загрузку файла
    }
    
    const response = await axios.post(`${directusUrl}/files`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data || !response.data.data) {
      log(`[uploads] Некорректный ответ от Directus API: ${JSON.stringify(response.data)}`);
      throw new Error('Некорректный ответ от Directus API');
    }

    log(`[uploads] Файл успешно загружен в Directus. ID: ${response.data.data.id}`);
    return response.data.data;
  } catch (error: any) {
    log(`[uploads] Ошибка при загрузке файла в Directus: ${error.message}`);
    
    // Логируем детали ошибки, если доступны
    if (error.response) {
      log(`[uploads] Статус ошибки: ${error.response.status}`);
      log(`[uploads] Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Функция для загрузки файла в Directus через API с более простым интерфейсом
 * @param file Файл из multer
 * @param token Токен авторизации (может быть null)
 */
async function uploadFileToDirectus(file: Express.Multer.File, token: string | null) {
  if (!token) {
    throw new Error('Требуется авторизация');
  }

  try {
    // Генерируем уникальное имя файла с сохранением расширения
    const fileExt = path.extname(file.originalname) || '.jpg';
    const uniqueFilename = `${uuidv4()}${fileExt}`;
    
    // Загружаем файл в Directus
    const fileInfo = await uploadToDirectus(
      file.buffer, 
      uniqueFilename, 
      file.mimetype,
      token
    );
    
    log(`[uploads] Файл успешно загружен в Directus через универсальный маршрут: ${fileInfo.id}`);
    
    return {
      success: true,
      data: fileInfo,
      url: fileInfo.url || '',
      fileId: fileInfo.id || '',
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    };
  } catch (error: any) {
    log(`[uploads] Ошибка при загрузке файла через универсальный маршрут: ${error.message}`);
    throw error;
  }
}

/**
 * Регистрирует маршруты для загрузки файлов
 */
export function registerUploadRoutes(app: Express) {
  // Универсальный маршрут для загрузки файлов изображений
  app.post('/upload', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
    try {
      log(`[uploads] Начинаем обработку загрузки файла...`);
      
      if (!req.file) {
        log(`[uploads] Файл не был загружен в запросе`);
        return res.status(400).json({
          success: false,
          error: 'Файл не загружен'
        });
      }
      
      log(`[uploads] Файл получен: ${req.file.originalname}, размер: ${req.file.size}, тип: ${req.file.mimetype}`);
      
      const token = getAuthTokenFromRequest(req);
      if (!token) {
        log(`[uploads] Токен авторизации отсутствует в запросе`);
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация'
        });
      }
      
      log(`[uploads] Токен авторизации получен, длина: ${token.length}`);
      
      // Проверяем токен, запрашивая информацию о пользователе
      const userData = await directusApiManager.getUserInfo(token);
      if (!userData) {
        log(`[uploads] Не удалось проверить токен авторизации`);
        return res.status(401).json({
          success: false, 
          error: 'Недействительный токен авторизации'
        });
      }
      
      log(`[uploads] Токен авторизации проверен, пользователь: ${userData.id}`);
      
      // Генерируем уникальное имя файла с сохранением расширения
      const fileExt = path.extname(req.file.originalname) || '.jpg';
      const uniqueFilename = `${uuidv4()}${fileExt}`;
      
      log(`[uploads] Генерируем уникальное имя файла: ${uniqueFilename}`);
      
      try {
        // Загружаем файл в Directus
        const fileInfo = await uploadToDirectus(
          req.file.buffer, 
          uniqueFilename, 
          req.file.mimetype,
          token
        );
        
        log(`[uploads] Файл успешно загружен в Directus: ${fileInfo.id} с URL ${fileInfo.url || 'URL не получен'}`);
        
        return res.status(200).json({
          success: true,
          url: fileInfo.url || '',
          fileId: fileInfo.id || ''
        });
      } catch (uploadError: any) {
        log(`[uploads] Ошибка при загрузке в Directus: ${uploadError.message}`);
        if (uploadError.response) {
          log(`[uploads] Ответ сервера Directus: ${JSON.stringify(uploadError.response.data)}`);
        }
        throw uploadError; // Пробрасываем ошибку для обработки в catch блоке
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      log(`[uploads] Ошибка загрузки файла: ${errorMessage}`);
      
      // Более подробное логирование
      if (error.response) {
        log(`[uploads] Статус ошибки Axios: ${error.response.status}`);
        log(`[uploads] Данные ошибки Axios: ${JSON.stringify(error.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });
  
  // Эндпоинт для загрузки одного изображения (старый маршрут, для совместимости)
  app.post('/api/upload-image', authenticateUser, upload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не загружен'
        });
      }

      const token = getAuthTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация'
        });
      }

      // Получаем информацию о пользователе через Directus API
      const userData = await directusApiManager.getUserInfo(token);
      if (!userData) {
        return res.status(401).json({
          success: false,
          error: 'Не удалось получить информацию о пользователе'
        });
      }

      // Генерируем уникальное имя файла с сохранением расширения
      const fileExt = path.extname(req.file.originalname) || '.jpg';
      const uniqueFilename = `${uuidv4()}${fileExt}`;

      // Загружаем файл в Directus
      const fileInfo = await uploadToDirectus(
        req.file.buffer, 
        uniqueFilename, 
        req.file.mimetype,
        token
      );

      log(`[uploads] Файл успешно загружен в Directus: ${fileInfo.id}`);

      return res.json({
        success: true,
        fileInfo: fileInfo,
        fileUrl: fileInfo.url,
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
  app.post('/api/upload-multiple-images', authenticateUser, upload.array('images', 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Файлы не загружены'
        });
      }

      const token = getAuthTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация'
        });
      }

      // Получаем информацию о пользователе через Directus API
      const userData = await directusApiManager.getUserInfo(token);
      if (!userData) {
        return res.status(401).json({
          success: false,
          error: 'Не удалось получить информацию о пользователе'
        });
      }

      // Загружаем каждый файл в Directus
      const uploadPromises = files.map(async (file) => {
        const fileExt = path.extname(file.originalname) || '.jpg';
        const uniqueFilename = `${uuidv4()}${fileExt}`;

        const fileInfo = await uploadToDirectus(
          file.buffer,
          uniqueFilename,
          file.mimetype,
          token
        );

        return {
          fileInfo: fileInfo,
          fileUrl: fileInfo.url,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      log(`[uploads] Успешно загружено ${uploadedFiles.length} файлов в Directus`);

      return res.json({
        success: true,
        files: uploadedFiles
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

  log(`[uploads] Маршруты загрузки файлов через Directus успешно зарегистрированы`);
}