import axios from 'axios';
import { log } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

/**
 * Загружает изображение из URL и отправляет его в Telegram
 * @param imageUrl URL изображения для загрузки
 * @param chatId ID чата для отправки
 * @param caption Текст подписи к изображению
 * @param token Токен Telegram API
 * @param baseUrl Базовый URL Telegram API
 * @returns Ответ от Telegram API
 */
export async function uploadTelegramImageFromUrl(
  imageUrl: string,
  chatId: string,
  caption: string,
  token: string,
  baseUrl: string = 'https://api.telegram.org/bot'
): Promise<any> {
  try {
    log(`Загрузка изображения в Telegram из URL: ${imageUrl.substring(0, 100)}...`, 'social-publishing');
    
    // Создаем временную директорию, если она не существует
    const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Генерируем уникальное имя для временного файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
    
    // Скачиваем изображение во временный файл
    log(`Скачивание изображения во временный файл: ${tempFilePath}`, 'social-publishing');
    
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
        }
      });
      
      // Проверяем размер полученного файла
      const dataSize = response.data.length;
      if (dataSize === 0) {
        throw new Error(`Скачан пустой файл (0 байт) с URL: ${imageUrl}`);
      }
      
      // Сохраняем файл на диск
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      log(`Изображение сохранено во временный файл, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
      
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
      formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
      
      // Отправляем запрос в Telegram API
      log(`Отправка изображения в Telegram чат: ${chatId}`, 'social-publishing');
      const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000
      });
      
      // Закрываем поток чтения файла
      fileStream.destroy();
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFilePath);
        log(`Временный файл удален: ${tempFilePath}`, 'social-publishing');
      } catch (unlinkError) {
        log(`Не удалось удалить временный файл: ${unlinkError}`, 'social-publishing');
      }
      
      // Проверяем успешность отправки
      if (uploadResponse.data && uploadResponse.data.ok) {
        log(`Изображение успешно отправлено в Telegram: message_id=${uploadResponse.data.result.message_id}`, 'social-publishing');
        return uploadResponse.data;
      } else {
        log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
        throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
      }
      
    } catch (downloadError: any) {
      // Если временный файл был создан, удаляем его
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          log(`Временный файл удален после ошибки: ${tempFilePath}`, 'social-publishing');
        } catch (e) {
          // Игнорируем ошибки при очистке
        }
      }
      
      // Логируем и пробрасываем ошибку выше
      log(`Ошибка при скачивании/отправке изображения: ${downloadError.message}`, 'social-publishing');
      if (downloadError.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(downloadError.response.data)}`, 'social-publishing');
      }
      throw downloadError;
    }
    
  } catch (error: any) {
    log(`Общая ошибка при загрузке изображения в Telegram: ${error.message}`, 'social-publishing');
    throw error;
  }
}