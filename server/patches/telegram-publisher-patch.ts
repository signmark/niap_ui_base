/**
 * Патч для публикации изображений в Telegram
 * с поддержкой авторизации при доступе к Directus
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import FormData from 'form-data';
import { DownloadImageResult, TelegramSendResponse } from '../types/telegram-publisher';

// Кэш для хранения токена Directus
interface DirectusTokenCache {
  token: string | null;
  expiration: number | null;
}

// Инициализация кэша токена
const tokenCache: DirectusTokenCache = {
  token: null,
  expiration: null
};

/**
 * Проверяет, не истек ли срок действия токена
 * @returns {boolean} true если токен действителен, false если истек или не установлен
 */
export function isTokenValid(): boolean {
  if (!tokenCache.token || !tokenCache.expiration) {
    return false;
  }
  
  // Проверяем, истек ли срок действия токена (с запасом в 15 минут)
  const now = Date.now();
  const expirationWithBuffer = tokenCache.expiration - 15 * 60 * 1000; // 15 минут в мс
  
  return now < expirationWithBuffer;
}

/**
 * Получает токен авторизации Directus
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
export async function getDirectusToken(): Promise<string | null> {
  try {
    // Проверяем, действителен ли существующий токен
    if (isTokenValid()) {
      return tokenCache.token;
    }
    
    // Получаем данные для авторизации из переменных окружения
    const email = process.env.DIRECTUS_EMAIL;
    const password = process.env.DIRECTUS_PASSWORD;
    const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
    
    if (!email || !password) {
      console.error('Не заданы учетные данные Directus в переменных окружения');
      return null;
    }
    
    // Выполняем запрос для получения токена
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email,
      password
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      // Сохраняем токен и вычисляем срок его действия
      tokenCache.token = response.data.data.access_token;
      
      // Стандартный срок действия токена Directus - 15 минут
      // Устанавливаем срок действия на 60 минут от текущего времени
      tokenCache.expiration = Date.now() + 60 * 60 * 1000; // 60 минут в мс
      
      return tokenCache.token;
    } else {
      console.error('Некорректный ответ при авторизации в Directus:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при получении токена Directus:', error);
    return null;
  }
}

/**
 * Генерирует путь к временному файлу
 * @param {string} extension Расширение файла
 * @returns {string} Путь к временному файлу
 */
export function generateTempFilePath(extension = 'jpg'): string {
  const tempDir = os.tmpdir();
  const randomName = `telegram-image-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  return path.join(tempDir, randomName);
}

/**
 * Скачивает изображение с авторизацией (если это URL Directus)
 * @param {string} imageUrl URL изображения для скачивания
 * @returns {Promise<Object>} Объект с буфером изображения и типом контента
 */
export async function downloadImage(imageUrl: string): Promise<DownloadImageResult> {
  try {
    let headers = {};
    const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
    
    // Если URL изображения содержит домен Directus, добавляем токен авторизации
    if (imageUrl.includes(directusUrl) || imageUrl.includes('db.nplanner.ru')) {
      const token = await getDirectusToken();
      if (token) {
        headers = {
          'Authorization': `Bearer ${token}`
        };
      }
    }
    
    // Запрашиваем изображение
    const response = await axios.get(imageUrl, {
      headers,
      responseType: 'arraybuffer'
    });
    
    // Создаем временный файл для хранения изображения
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const extension = contentType.split('/')[1] || 'jpg';
    const tempFilePath = generateTempFilePath(extension);
    
    // Сохраняем буфер во временный файл
    fs.writeFileSync(tempFilePath, response.data);
    
    return {
      buffer: response.data,
      contentType,
      tempFilePath
    };
  } catch (error) {
    console.error('Ошибка при скачивании изображения:', error);
    throw new Error(`Ошибка при скачивании изображения: ${error}`);
  }
}

/**
 * Отправляет изображение в Telegram
 * @param {Buffer} imageBuffer Буфер с данными изображения
 * @param {string} contentType MIME-тип изображения
 * @param {string} chatId ID чата Telegram для отправки
 * @param {string} caption Подпись к изображению
 * @param {string} token Токен бота Telegram
 * @param {string|null} tempFilePath Путь к временному файлу изображения, если есть
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendImageToTelegram(
  imageBuffer: Buffer, 
  contentType: string, 
  chatId: string, 
  caption: string, 
  token: string,
  tempFilePath: string
): Promise<TelegramSendResponse> {
  try {
    const form = new FormData();
    
    // Добавляем параметры в форму
    form.append('chat_id', chatId);
    
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    
    // Добавляем файл изображения
    form.append('photo', fs.createReadStream(tempFilePath));
    
    // Отправляем запрос в Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders()
        }
      }
    );
    
    return {
      ok: response.data.ok,
      result: response.data.result,
      description: response.data.description
    };
  } catch (error) {
    console.error('Ошибка при отправке изображения в Telegram:', error);
    return {
      ok: false,
      description: `Ошибка при отправке изображения: ${error}`,
      error
    };
  } finally {
    // Удаляем временный файл, если он был создан
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.warn('Не удалось удалить временный файл:', tempFilePath, error);
      }
    }
  }
}

/**
 * Полный процесс отправки изображения из Directus в Telegram
 * @param {string} imageUrl URL изображения (может быть ссылкой на Directus)
 * @param {string} chatId ID чата Telegram
 * @param {string} caption Подпись к изображению (поддерживает HTML)
 * @param {string} token Токен бота Telegram
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendDirectusImageToTelegram(imageUrl: string, chatId: string, caption: string, token: string): Promise<TelegramSendResponse> {
  try {
    // Скачиваем изображение
    const { buffer, contentType, tempFilePath } = await downloadImage(imageUrl);
    
    // Отправляем изображение в Telegram
    return await sendImageToTelegram(buffer, contentType, chatId, caption, token, tempFilePath);
  } catch (error) {
    console.error('Ошибка при отправке изображения в Telegram:', error);
    return {
      ok: false,
      description: `Ошибка при отправке изображения: ${error}`,
      error
    };
  }
}