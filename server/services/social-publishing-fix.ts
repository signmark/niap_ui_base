import axios from 'axios';
import { log } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { directusApiManager } from '../directus';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '../../shared/types';

// Добавляем код для загрузки изображений с Directus с авторизацией
export async function downloadDirectusImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  log(`📥 Начинаю загрузку изображения с Directus: ${imageUrl.substring(0, 50)}...`, 'directus-download');
  
  try {
    // Подготавливаем заголовки с авторизацией
    const headers: Record<string, string> = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
      'Cache-Control': 'no-cache'
    };
    
    // Проверяем, является ли URL от Directus
    if (imageUrl.includes('directus.nplanner.ru')) {
      // Получаем токены всех пользователей (возьмем первый действующий)
      let directusToken = null;
      
      // Перебираем все ключи в кеше токенов
      const userIds = Object.keys(directusApiManager['authTokenCache'] || {});
      
      for (const userId of userIds) {
        const cachedToken = directusApiManager.getCachedToken(userId);
        if (cachedToken) {
          directusToken = cachedToken.token;
          log(`✅ Найден действующий токен Directus для пользователя ${userId}`, 'directus-download');
          break;
        }
      }
      
      // Если токен не найден в кеше, пробуем получить админский токен
      if (!directusToken) {
        try {
          const adminToken = await directusApiManager['getAdminToken']();
          if (adminToken) {
            directusToken = adminToken;
            log(`✅ Получен новый админский токен Directus`, 'directus-download');
          }
        } catch (adminTokenError) {
          log(`⚠️ Не удалось получить админский токен: ${adminTokenError}`, 'directus-download');
        }
      }
      
      // Если у нас есть токен, добавляем его в заголовки
      if (directusToken) {
        headers['Authorization'] = `Bearer ${directusToken}`;
        log(`🔑 Добавлен токен авторизации в запрос к Directus`, 'directus-download');
      } else {
        log(`⚠️ Не найден действующий токен Directus для авторизации`, 'directus-download');
      }
    }
    
    // Скачиваем изображение с заголовками авторизации
    log(`🔄 Выполняем запрос для скачивания изображения`, 'directus-download');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 секунд таймаут
      headers: headers
    });
    
    // Проверяем, что получили данные
    if (!response.data || response.data.length === 0) {
      throw new Error('Получен пустой ответ от сервера');
    }
    
    // Определяем тип контента
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    log(`✅ Изображение успешно загружено: ${response.data.length} байт, тип: ${contentType}`, 'directus-download');
    
    return {
      buffer: Buffer.from(response.data),
      contentType: contentType
    };
  } catch (error: any) {
    log(`❌ Ошибка при загрузке изображения: ${error.message}`, 'directus-download');
    if (error.response) {
      log(`📊 Код ответа: ${error.response.status}`, 'directus-download');
    }
    throw error;
  }
}

// Функция для отправки изображения в Telegram
export async function uploadImageToTelegram(
  imageBuffer: Buffer, 
  contentType: string,
  chatId: string,
  caption: string,
  token: string,
  baseUrl = 'https://api.telegram.org/bot'
): Promise<any> {
  // Создаем временную директорию
  const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Генерируем уникальное имя для временного файла
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
  const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.${fileExtension}`);
  
  try {
    // Сохраняем буфер во временный файл
    fs.writeFileSync(tempFilePath, imageBuffer);
    log(`💾 Изображение сохранено во временный файл: ${tempFilePath} (${fs.statSync(tempFilePath).size} байт)`, 'telegram-upload');
    
    // Создаем FormData для отправки изображения
    const formData = new FormData();
    
    // Добавляем основные параметры
    formData.append('chat_id', chatId);
    
    // Если есть подпись, добавляем её и формат разметки
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }
    
    // Добавляем файл изображения
    const fileStream = fs.createReadStream(tempFilePath);
    formData.append('photo', fileStream, { 
      filename: `image_${timestamp}.${fileExtension}`,
      contentType: contentType
    });
    
    // Отправляем запрос в Telegram API
    log(`🚀 Отправка изображения в Telegram чат: ${chatId}`, 'telegram-upload');
    console.time('⏱️ Время отправки в Telegram');
    
    const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60 секунд таймаут
    });
    
    console.timeEnd('⏱️ Время отправки в Telegram');
    
    // Закрываем поток чтения файла
    fileStream.destroy();
    
    // Удаляем временный файл
    fs.unlinkSync(tempFilePath);
    log(`🗑️ Временный файл удален: ${tempFilePath}`, 'telegram-upload');
    
    // Проверяем успешность отправки
    if (uploadResponse.data && uploadResponse.data.ok) {
      log(`✅ Изображение успешно отправлено в Telegram: message_id=${uploadResponse.data.result.message_id}`, 'telegram-upload');
      return uploadResponse.data;
    } else {
      log(`❌ Ошибка при отправке изображения в Telegram: ${JSON.stringify(uploadResponse.data)}`, 'telegram-upload');
      throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
    }
  } catch (error: any) {
    // Если временный файл был создан, удаляем его
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        log(`🗑️ Временный файл удален после ошибки: ${tempFilePath}`, 'telegram-upload');
      } catch (e) {
        // Игнорируем ошибки при очистке
      }
    }
    
    // Логируем и пробрасываем ошибку выше
    log(`❌ Ошибка при отправке изображения в Telegram: ${error.message}`, 'telegram-upload');
    if (error.response) {
      log(`📊 Код ответа: ${error.response.status}`, 'telegram-upload');
      log(`📝 Данные ответа: ${JSON.stringify(error.response.data)}`, 'telegram-upload');
    }
    throw error;
  }
}

// Полный процесс отправки изображения из Directus в Telegram
export async function sendDirectusImageToTelegram(
  imageUrl: string, 
  chatId: string, 
  caption: string, 
  token: string
): Promise<any> {
  try {
    // Шаг 1: Загружаем изображение с авторизацией
    const { buffer, contentType } = await downloadDirectusImage(imageUrl);
    
    // Шаг 2: Отправляем изображение в Telegram
    const result = await uploadImageToTelegram(buffer, contentType, chatId, caption, token);
    
    return result;
  } catch (error: any) {
    log(`❌ Ошибка в процессе отправки изображения из Directus в Telegram: ${error.message}`, 'social-publishing');
    throw error;
  }
}