/**
 * Надежная реализация функции загрузки изображений в Telegram
 * с поддержкой изображений из Directus и других источников.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import FormData from 'form-data';
import { log } from '../utils/logger';

/**
 * Функция для создания временного файла
 * @param extension Расширение файла
 * @returns Путь к временному файлу
 */
function createTempFile(extension = 'tmp'): string {
  const tempDir = os.tmpdir();
  const randomName = crypto.randomBytes(16).toString('hex');
  return path.join(tempDir, `${randomName}.${extension}`);
}

/**
 * Функция для получения токена авторизации Directus
 * @returns Токен авторизации или null
 */
async function getDirectusToken(): Promise<string | null> {
  const directusEmail = process.env.DIRECTUS_EMAIL;
  const directusPassword = process.env.DIRECTUS_PASSWORD;
  
  if (!directusEmail || !directusPassword) {
    log('DIRECTUS_EMAIL или DIRECTUS_PASSWORD не указаны!', 'social-publishing', 'error');
    return null;
  }
  
  try {
    log('Получение токена Directus...', 'social-publishing');
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: directusEmail,
      password: directusPassword
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Токен Directus успешно получен', 'social-publishing');
      return response.data.data.access_token;
    } else {
      log('Неожиданный формат ответа от Directus API', 'social-publishing', 'error');
      return null;
    }
  } catch (error: any) {
    log(`Ошибка получения токена Directus: ${error.message}`, 'social-publishing', 'error');
    return null;
  }
}

/**
 * Функция для скачивания изображения с поддержкой авторизации Directus
 * @param imageUrl URL изображения
 * @param directusToken Токен авторизации Directus
 * @returns Информация о скачанном изображении
 */
async function downloadImage(imageUrl: string, directusToken: string | null = null): Promise<{ path: string; contentType: string; buffer: Buffer }> {
  try {
    log(`Скачивание изображения с URL: ${imageUrl}`, 'social-publishing');
    
    const options: any = {
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      maxContentLength: 50 * 1024 * 1024, // 50 MB
      timeout: 30000,
      maxRedirects: 5
    };
    
    // Если есть токен Directus и URL содержит directus.nplanner.ru, добавляем токен
    if (directusToken && (imageUrl.includes('directus.nplanner.ru') || imageUrl.includes('/assets/'))) {
      options.headers['Authorization'] = `Bearer ${directusToken}`;
      log('Добавлен токен авторизации для Directus', 'social-publishing');
    }
    
    const response = await axios(options);
    
    if (response.status !== 200) {
      throw new Error(`Неуспешный статус ответа: ${response.status}`);
    }
    
    // Определяем MIME-тип из заголовков
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Определяем расширение файла из MIME-типа
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const extension = extensionMap[contentType] || 'jpg';
    
    // Создаем временный файл и сохраняем изображение
    const tempFilePath = createTempFile(extension);
    fs.writeFileSync(tempFilePath, response.data);
    
    log(`Изображение успешно скачано и сохранено во временный файл: ${tempFilePath}`, 'social-publishing');
    
    return {
      path: tempFilePath,
      contentType,
      buffer: response.data
    };
  } catch (error: any) {
    log(`Ошибка при скачивании изображения: ${error.message}`, 'social-publishing', 'error');
    
    // Добавляем подробности ошибки, если доступны
    if (axios.isAxiosError(error) && error.response) {
      log(`Статус ошибки: ${error.response.status}`, 'social-publishing', 'error');
      
      // Если это ошибка 401/403 и URL содержит directus.nplanner.ru
      if ((error.response.status === 401 || error.response.status === 403) && 
          (imageUrl.includes('directus.nplanner.ru') || imageUrl.includes('/assets/'))) {
        log('Ошибка авторизации при скачивании изображения. Попытка получить новый токен.', 'social-publishing', 'warn');
      }
    }
    
    throw error;
  }
}

/**
 * Функция для отправки изображения в Telegram с использованием FormData
 * @param imagePath Путь к временному файлу с изображением
 * @param chatId ID чата Telegram
 * @param caption Подпись к изображению
 * @param token Токен бота Telegram
 * @param baseUrl Базовый URL Telegram API
 * @returns Результат отправки
 */
async function sendImageToTelegram(
  imagePath: string, 
  chatId: string, 
  caption: string | null = null,
  token: string,
  baseUrl: string = 'https://api.telegram.org/bot'
): Promise<any> {
  try {
    if (!token) {
      throw new Error('Токен Telegram не указан');
    }
    
    if (!chatId) {
      throw new Error('ID чата Telegram не указан');
    }
    
    log(`Отправка изображения в Telegram, chat_id: ${chatId}`, 'social-publishing');
    
    // Создаем FormData для multipart/form-data запроса
    const form = new FormData();
    form.append('chat_id', chatId);
    
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    
    // Добавляем файл изображения с уникальным именем для предотвращения кэширования
    const timestamp = Date.now();
    const filename = `image_${timestamp}.jpg`;
    form.append('photo', fs.createReadStream(imagePath), { filename });
    
    // Отправляем запрос к Telegram API
    const response = await axios.post(
      `${baseUrl}${token}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000
      }
    );
    
    if (response.data && response.data.ok) {
      log('Изображение успешно отправлено в Telegram', 'social-publishing');
      return response.data;
    } else {
      log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing', 'error');
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    log(`Ошибка при отправке изображения в Telegram: ${error.message}`, 'social-publishing', 'error');
    
    // Попытка получить больше информации об ошибке
    if (axios.isAxiosError(error) && error.response) {
      log(`Статус ошибки: ${error.response.status}`, 'social-publishing', 'error');
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`, 'social-publishing', 'error');
    }
    
    throw error;
  } finally {
    // Удаляем временный файл в любом случае
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        log(`Временный файл ${imagePath} удален`, 'social-publishing');
      } catch (unlinkError) {
        log(`Ошибка при удалении временного файла: ${(unlinkError as Error).message}`, 'social-publishing', 'warn');
      }
    }
  }
}

/**
 * Полная функция для загрузки изображения из URL и отправки в Telegram
 * @param imageUrl URL изображения
 * @param chatId ID чата Telegram
 * @param caption Подпись к изображению
 * @param token Токен бота Telegram
 * @param baseUrl Базовый URL Telegram API
 * @returns Результат отправки
 */
export async function uploadTelegramImageFromUrl(
  imageUrl: string,
  chatId: string,
  caption: string | null = null,
  token: string,
  baseUrl: string = 'https://api.telegram.org/bot'
): Promise<any> {
  let directusToken = null;
  let tempImageInfo = null;
  
  try {
    // Если URL содержит directus.nplanner.ru, получаем токен авторизации
    if (imageUrl.includes('directus.nplanner.ru') || imageUrl.includes('/assets/')) {
      try {
        directusToken = await getDirectusToken();
        if (!directusToken) {
          log('Не удалось получить токен Directus, попытка скачать без авторизации', 'social-publishing', 'warn');
        }
      } catch (tokenError) {
        log(`Ошибка получения токена Directus: ${(tokenError as Error).message}`, 'social-publishing', 'error');
      }
    }
    
    // Скачиваем изображение во временный файл
    try {
      tempImageInfo = await downloadImage(imageUrl, directusToken);
    } catch (downloadError) {
      // Если произошла ошибка авторизации, пробуем получить новый токен и повторить скачивание
      if (axios.isAxiosError(downloadError) && downloadError.response && 
          (downloadError.response.status === 401 || downloadError.response.status === 403) &&
          (imageUrl.includes('directus.nplanner.ru') || imageUrl.includes('/assets/'))) {
        log('Ошибка авторизации при скачивании. Попытка получить новый токен и повторить запрос.', 'social-publishing', 'warn');
        
        try {
          directusToken = await getDirectusToken();
          if (directusToken) {
            tempImageInfo = await downloadImage(imageUrl, directusToken);
          } else {
            throw new Error('Не удалось получить токен для повторной попытки скачивания');
          }
        } catch (retryError) {
          log(`Ошибка при повторной попытке скачивания: ${(retryError as Error).message}`, 'social-publishing', 'error');
          throw retryError;
        }
      } else {
        // Это не ошибка авторизации или не URL Directus, просто передаем ошибку дальше
        throw downloadError;
      }
    }
    
    // Если скачивание успешно, отправляем изображение в Telegram
    if (tempImageInfo && tempImageInfo.path) {
      // Отправляем изображение в Telegram
      const result = await sendImageToTelegram(tempImageInfo.path, chatId, caption, token, baseUrl);
      
      return result;
    } else {
      throw new Error('Не удалось скачать изображение или получить путь к временному файлу');
    }
  } catch (error) {
    log(`Ошибка в процессе uploadTelegramImageFromUrl: ${(error as Error).message}`, 'social-publishing', 'error');
    throw error;
  }
}