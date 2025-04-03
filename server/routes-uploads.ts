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
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Безопасное логирование объектов (с обработкой циклических ссылок)
 * @param obj Объект для логирования
 * @returns Безопасная строка для логирования
 */
function safeStringify(obj: any): string {
  try {
    // Обработка циклических ссылок
    const cache: any[] = [];
    const str = JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        // Обнаружение циклических ссылок
        if (cache.indexOf(value) !== -1) {
          return '[Циклическая ссылка]';
        }
        cache.push(value);
      }
      return value;
    }, 2);
    return str || String(obj);
  } catch (error) {
    return `[Невозможно преобразовать объект: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

// Получаем путь к текущему файлу и директории в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Директория для хранения загруженных файлов
const uploadDir = path.join(__dirname, '../uploads');

// Создаем директорию для загрузок, если она не существует
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  log(`[uploads] Создана директория для локального хранения файлов: ${uploadDir}`);
}

/**
 * Сохраняет файл локально, когда Directus недоступен
 * @param fileData Буфер с данными файла
 * @param fileName Имя файла
 * @param mimeType MIME-тип файла
 * @returns Информация о сохраненном файле
 */
async function saveFileLocally(fileData: Buffer, fileName: string, mimeType: string) {
  try {
    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, fileData);
    
    // Формируем URL для доступа к файлу
    const fileUrl = `/uploads/${fileName}`;
    
    log(`[uploads] Файл успешно сохранен локально: ${filePath}`);
    log(`[uploads] URL для доступа к файлу: ${fileUrl}`);
    
    return {
      id: fileName,
      title: fileName,
      filename_download: fileName,
      type: mimeType,
      filesize: fileData.length,
      url: fileUrl,
      uploaded_on: new Date().toISOString(),
      uploaded_by: 'local-system',
      storage: 'local',
      is_local: true
    };
  } catch (error: any) {
    log(`[uploads] Ошибка при сохранении файла локально: ${error.message}`);
    throw error;
  }
}

async function uploadToDirectus(fileData: Buffer, fileName: string, mimeType: string, token: string) {
  try {
    log(`[uploads] Подготовка загрузки файла в Directus: ${fileName}, тип: ${mimeType}`);
    log(`[uploads] Размер файла: ${fileData.length} байт`);
    log(`[uploads] Токен авторизации (первые 20 символов): ${token.substring(0, 20)}...`);
    
    // Проверка доступа к Directus перед загрузкой файла
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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
        log(`[uploads] Данные ошибки: ${safeStringify(userError.response.data)}`);
      }
      
      // Если получили 401, выбрасываем ошибку, чтобы прервать загрузку
      if (userError.response && userError.response.status === 401) {
        throw new Error('Недействительный токен авторизации для Directus');
      }
    }
    
    try {
      // Сначала пробуем загрузить в Directus
      const formData = new FormData();
      formData.append('file', fileData, {
        filename: fileName,
        contentType: mimeType
      });

      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      log(`[uploads] Отправка запроса на ${directusUrl}/files с токеном авторизации`);
      
      // Создаем экземпляр axios с настройкой таймаута и повторными попытками
      const axiosInstance = axios.create({
        timeout: 30000, // 30 секунд таймаут
      });
      
      // Добавляем информацию о форме и заголовки авторизации
      const config = {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      
      log(`[uploads] Отправка запроса на ${directusUrl}/files, размер данных: ${fileData.length} байт`);
      
      // Пробуем загрузить файл с повторными попытками
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries < maxRetries) {
        try {
          response = await axiosInstance.post(`${directusUrl}/files`, formData, config);
          break; // Выходим из цикла, если запрос успешен
        } catch (retryError: any) {
          retries++;
          log(`[uploads] Ошибка при попытке ${retries}/${maxRetries}: ${retryError.message}`);
          
          if (retries >= maxRetries) {
            // Если исчерпали все попытки, пробрасываем последнюю ошибку
            throw retryError;
          }
          
          // Ждем перед следующей попыткой (экспоненциальное увеличение времени ожидания)
          const delay = 1000 * Math.pow(2, retries - 1);
          log(`[uploads] Ждем ${delay}мс перед следующей попыткой`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!response || !response.data || !response.data.data) {
        log(`[uploads] Некорректный ответ от Directus API: ${safeStringify(response?.data || 'нет данных')}`);
        throw new Error('Некорректный ответ от Directus API');
      }

      log(`[uploads] Файл успешно загружен в Directus. ID: ${response.data.data.id}`);
      return response.data.data;
    } catch (directusError: any) {
      log(`[uploads] Не удалось загрузить файл в Directus: ${directusError.message}`);
      
      // Логируем детали ошибки, если доступны
      if (directusError.response) {
        log(`[uploads] Статус ошибки Directus: ${directusError.response.status}`);
        log(`[uploads] Данные ошибки Directus: ${safeStringify(directusError.response.data)}`);
      }
      
      // Если Directus сервис файлов недоступен, используем локальное сохранение
      log(`[uploads] Переключение на локальное хранение файлов`);
      return await saveFileLocally(fileData, fileName, mimeType);
    }
  } catch (error: any) {
    log(`[uploads] Ошибка при загрузке файла: ${error.message}`);
    
    // Если произошла ошибка на любом этапе, пробуем сохранить локально
    try {
      log(`[uploads] Пробуем сохранить файл локально после ошибки`);
      return await saveFileLocally(fileData, fileName, mimeType);
    } catch (localError: any) {
      log(`[uploads] Не удалось сохранить файл даже локально: ${localError.message}`);
      throw localError;
    }
  }
}

/**
 * Функция для загрузки файла в Directus через API с более простым интерфейсом
 * @param file Файл из multer
 * @param token Токен авторизации (может быть null)
 */
async function uploadFileToDirectus(file: Express.Multer.File, token: string | null) {
  if (!token) {
    log(`[uploads] Попытка загрузки без токена авторизации`);
    throw new Error('Требуется авторизация');
  }

  try {
    log(`[uploads] Начинаем загрузку файла: ${file.originalname}, размер: ${file.size}, MIME: ${file.mimetype}`);
    log(`[uploads] Токен авторизации (первые 10 символов): ${token.substring(0, 10)}...`);
    
    // Генерируем уникальное имя файла с сохранением расширения
    const fileExt = path.extname(file.originalname) || '.jpg';
    const uniqueFilename = `${uuidv4()}${fileExt}`;
    log(`[uploads] Сгенерировано уникальное имя файла: ${uniqueFilename}`);
    
    // Загружаем файл в Directus
    const fileInfo = await uploadToDirectus(
      file.buffer, 
      uniqueFilename, 
      file.mimetype,
      token
    );
    
    log(`[uploads] Файл успешно загружен в Directus через универсальный маршрут: ${fileInfo.id}`);
    log(`[uploads] URL файла: ${fileInfo.url || 'URL не получен'}`);
    
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
    
    // Логируем детали ошибки
    if (error.response) {
      log(`[uploads] Статус ошибки: ${error.response.status}`);
      log(`[uploads] Данные ошибки: ${safeStringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Регистрирует маршруты для загрузки файлов
 */
export function registerUploadRoutes(app: Express) {
  // Универсальный маршрут для загрузки файлов изображений (новый формат с префиксом /api/)
  app.post('/api/upload', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
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
        
        // Формируем полный URL для Directus для прямого доступа к файлу
        const directusUrl = `https://directus.nplanner.ru/assets/${fileInfo.id}`;
        log(`[uploads] Сформирован URL для доступа к файлу Directus: ${directusUrl}`);
        
        return res.status(200).json({
          success: true,
          url: directusUrl,
          fileUrl: directusUrl,  // Дублируем для совместимости с разными клиентскими компонентами
          fileId: fileInfo.id || ''
        });
      } catch (uploadError: any) {
        log(`[uploads] Ошибка при загрузке в Directus: ${uploadError.message}`);
        if (uploadError.response) {
          log(`[uploads] Ответ сервера Directus: ${safeStringify(uploadError.response.data)}`);
        }
        throw uploadError; // Пробрасываем ошибку для обработки в catch блоке
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      log(`[uploads] Ошибка загрузки файла: ${errorMessage}`);
      
      // Более подробное логирование
      if (error.response) {
        log(`[uploads] Статус ошибки Axios: ${error.response.status}`);
        log(`[uploads] Данные ошибки Axios: ${safeStringify(error.response.data)}`);
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

      // Формируем правильный URL для файла в Directus
      const directusUrl = `https://directus.nplanner.ru/assets/${fileInfo.id}`;
      log(`[uploads] Сформирован URL для доступа к файлу Directus: ${directusUrl}`);

      return res.json({
        success: true,
        fileInfo: fileInfo,
        fileUrl: directusUrl,
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

  // Дополнительный маршрут для /api/upload удален, чтобы избежать дублирования

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

        // Формируем правильный URL для файла в Directus
        const directusUrl = `https://directus.nplanner.ru/assets/${fileInfo.id}`;
        log(`[uploads] Сформирован URL для доступа к файлу Directus: ${directusUrl}`);
        
        return {
          fileInfo: fileInfo,
          fileUrl: directusUrl,
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

  // Прокси для файлов Directus, чтобы решить проблемы с CORS и доступом 403
  app.get('/api/proxy-file', async (req: Request, res: Response) => {
    const fileUrl = req.query.url as string;
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: 'URL файла не указан'
      });
    }

    try {
      log(`[uploads] Запрошен прокси для файла: ${fileUrl}`);
      
      // Проверяем, является ли это UUID Directus
      const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
      const match = fileUrl.match(uuidRegex);
      
      let finalUrl = fileUrl;
      let authToken = null;
      
      // Если URL содержит directus.nplanner.ru - получаем токен администратора для доступа
      if (fileUrl.includes('directus.nplanner.ru') || fileUrl.includes('/assets/')) {
        // Попытка 1: Используем глобальную функцию getAdminToken из ./directus
        try {
          const { getAdminToken } = await import('./directus');
          authToken = await getAdminToken();
          log(`[uploads] Получен токен администратора через глобальную функцию getAdminToken`);
        } catch (tokenError) {
          log(`[uploads] Ошибка получения токена через глобальную функцию getAdminToken: ${(tokenError as Error).message}`);
          // Продолжаем и пробуем другие методы
        }
        
        // Попытка 2: Используем directusCrud, если первая попытка не удалась
        if (!authToken) {
          try {
            const { directusCrud } = await import('./services/directus-crud');
            authToken = await directusCrud.getAdminToken();
            log(`[uploads] Получен токен администратора через directusCrud`);
          } catch (tokenError) {
            log(`[uploads] Ошибка получения токена через directusCrud: ${(tokenError as Error).message}`);
          }
        }
        
        // Попытка 3: Используем прямой метод получения токена, если предыдущие попытки не удались
        if (!authToken) {
          try {
            const { getAdminTokenDirect } = await import('./directus');
            authToken = await getAdminTokenDirect();
            log(`[uploads] Получен токен администратора через getAdminTokenDirect`);
          } catch (tokenError) {
            log(`[uploads] Ошибка получения токена через getAdminTokenDirect: ${(tokenError as Error).message}`);
          }
        }
        
        if (!authToken) {
          log(`[uploads] КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить токен администратора никаким методом!`);
        } else {
          log(`[uploads] Успешно получен токен администратора одним из методов`);
        }
        
        // Если это UUID Directus, добавляем расширение .jpg для правильного MIME-типа
        if (match && (fileUrl.includes('/assets/') || fileUrl.includes('directus.nplanner.ru'))) {
          const uuid = match[0];
          if (!fileUrl.includes('.')) {
            finalUrl = `https://directus.nplanner.ru/assets/${uuid}.jpg`;
            log(`[uploads] Преобразован URL Directus с добавлением расширения: ${finalUrl}`);
          }
        }
      }
      
      // Добавляем дополнительные опции для стабильного соединения
      // Создаем конфигурацию для запроса
      const headers: Record<string, string> = {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // Если есть токен и это URL Directus - добавляем токен в заголовки
      if (authToken && (fileUrl.includes('directus.nplanner.ru') || fileUrl.includes('/assets/'))) {
        headers['Authorization'] = `Bearer ${authToken}`;
        log(`[uploads] Добавлен заголовок авторизации для Directus`);
      }
      
      const axiosOptions = {
        url: finalUrl,
        method: 'GET',
        responseType: 'arraybuffer' as const, // Используем arraybuffer вместо stream для более стабильного получения
        maxContentLength: 20 * 1024 * 1024, // 20 MB
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status: number) => status < 500, // Не считаем 4xx ошибками, обработаем их отдельно
        // Добавляем случайный параметр для избежания кеширования
        params: {
          '_nocache': Date.now()
        },
        headers
      };
      
      log(`[uploads] Отправка запроса к: ${finalUrl}`);
      const response = await axios(axiosOptions);
      
      // Если статус 403 или 401, пробуем запросить файл еще раз с обновленным токеном
      if (response.status === 403 || response.status === 401) {
        log(`[uploads] Получен отказ в доступе (${response.status}), попытка обновить токен...`);
        
        // Пробуем получить новый токен администратора напрямую
        try {
          // Пытаемся получить новый токен напрямую
          const { getAdminTokenDirect } = await import('./directus');
          const newToken = await getAdminTokenDirect();
          
          if (newToken) {
            log(`[uploads] Получен новый токен администратора, повторная попытка доступа к файлу`);
            const newHeaders = { ...headers };
            newHeaders['Authorization'] = `Bearer ${newToken}`;
            
            const retryOptions = {
              ...axiosOptions,
              headers: newHeaders
            };
            
            const retryResponse = await axios(retryOptions);
            
            // Если статус снова 403/401, сдаемся
            if (retryResponse.status === 403 || retryResponse.status === 401) {
              throw new Error(`Отказ в доступе (${retryResponse.status}) даже с обновленным токеном`);
            } else {
              log(`[uploads] Успешно получен доступ к файлу со второй попытки`);
              // Продолжаем обработку с успешным ответом
              return handleSuccessfulResponse(retryResponse, res);
            }
          } else {
            throw new Error('Не удалось получить новый токен администратора');
          }
        } catch (refreshError) {
          log(`[uploads] Ошибка при получении нового токена: ${(refreshError as Error).message}`);
          throw new Error(`Не удалось получить новый токен: ${(refreshError as Error).message}`);
        }
      }
      
      // Обработка успешного ответа
      return handleSuccessfulResponse(response, res);
      
    } catch (error: any) {
      log(`[uploads] Ошибка прокси файла: ${error.message}`);
      
      // Добавляем подробный вывод о запросе и ошибке
      if (axios.isAxiosError(error) && error.response) {
        log(`[uploads] Статус ошибки: ${error.response.status}`);
        
        // Безопасно логируем данные ошибки
        try {
          const errorData = error.response.data;
          if (typeof errorData === 'object') {
            log(`[uploads] Данные ошибки: ${JSON.stringify(errorData)}`);
          } else {
            log(`[uploads] Данные ошибки: ${String(errorData)}`);
          }
        } catch (jsonError) {
          log(`[uploads] Невозможно сериализовать данные ошибки: ${(jsonError as Error).message}`);
        }
      }
      
      // Если файл не найден, возвращаем изображение-заглушку
      if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
        return res.redirect('https://placehold.co/400x225?text=Image+Not+Found');
      }
      
      return res.status(500).json({
        success: false,
        error: `Ошибка доступа к файлу: ${error.message}`
      });
    }
  });
  
  // Вспомогательная функция для обработки успешного ответа от сервера
  function handleSuccessfulResponse(response: any, res: Response) {
    // Устанавливаем соответствующие заголовки, обрабатывая их более надежно
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    // Устанавливаем заголовки CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Проверяем тип данных ответа и отправляем соответствующим образом
    if (Buffer.isBuffer(response.data)) {
      // Если это буфер, отправляем как есть
      res.end(response.data);
    } else if (typeof response.data === 'object' && response.data.pipe && typeof response.data.pipe === 'function') {
      // Если это поток, передаем его
      response.data.pipe(res);
    } else {
      // В других случаях пытаемся преобразовать и отправить
      try {
        const buffer = Buffer.from(response.data);
        res.end(buffer);
      } catch (conversionError) {
        log(`[uploads] Ошибка при преобразовании данных ответа: ${(conversionError as Error).message}`);
        res.status(500).json({
          success: false,
          error: 'Ошибка формата данных ответа'
        });
      }
    }
    
    return; // Явное завершение функции
  }

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