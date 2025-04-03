/**
 * Маршруты для тестирования публикации в социальные сети
 */

import { Router, Request, Response } from 'express';
import TelegramPublisher from '../telegram-publisher.mjs';
import * as telegramPatch from './patches/telegram-publisher-patch';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import os from 'os';
import crypto from 'crypto';
import { createWriteStream } from 'fs';

const router = Router();

/**
 * Тестирование публикации изображения в Telegram
 */
router.post('/api/test-telegram-publish', async (req: Request, res: Response) => {
  try {
    const { imageUrl, chatId, caption, token } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'Не указан URL изображения' });
    }

    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Не указан ID чата' });
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'Не указан токен бота' });
    }

    // Используем патч для отправки изображения
    const result = await telegramPatch.sendDirectusImageToTelegram(imageUrl, chatId, caption || '', token);

    return res.json(result);
  } catch (error) {
    console.error('Ошибка при тестировании Telegram публикации:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при публикации в Telegram'
    });
  }
});

/**
 * Тестирование получения токена Directus
 */
router.get('/api/test-directus-token', async (req: Request, res: Response) => {
  try {
    const publisher = new TelegramPublisher({ verbose: true });
    const token = await publisher.getDirectusToken();

    if (token) {
      return res.json({ success: true, token: token.substring(0, 10) + '...' });
    } else {
      return res.status(401).json({ success: false, error: 'Не удалось получить токен' });
    }
  } catch (error) {
    console.error('Ошибка при получении токена Directus:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении токена Directus'
    });
  }
});

/**
 * Генерирует случайный временный файл
 * @param extension Расширение файла
 * @returns Путь к временному файлу
 */
function generateTempFilePath(extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return path.join(os.tmpdir(), `telegram_${timestamp}_${randomString}.${extension}`);
}

/**
 * Тестирование прямой отправки изображения в Telegram
 */
router.post('/api/test-direct-telegram', async (req: Request, res: Response) => {
  try {
    const { imageUrl, chatId, caption, token } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'Не указан URL изображения' });
    }

    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Не указан ID чата' });
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'Не указан токен бота' });
    }

    // Создаем временный файл
    const tempFilePath = generateTempFilePath('jpg');
    
    try {
      // Скачиваем изображение
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream'
      });
      
      const contentType = response.headers['content-type'];
      const writer = createWriteStream(tempFilePath);
      
      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Создаем форму для отправки
      const form = new FormData();
      form.append('chat_id', chatId);
      
      if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
      }
      
      // Добавляем файл с изображением
      form.append('photo', fs.createReadStream(tempFilePath), {
        filename: path.basename(tempFilePath),
        contentType: contentType || 'image/jpeg'
      });
      
      // Отправляем запрос в Telegram API
      const telegramResponse = await axios.post(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        form,
        {
          headers: {
            ...form.getHeaders()
          }
        }
      );
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.warn('Ошибка при удалении временного файла:', unlinkError);
      }
      
      return res.json(telegramResponse.data);
    } catch (error) {
      // Попытка удалить временный файл в случае ошибки
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (unlinkError) {
        console.warn('Ошибка при удалении временного файла:', unlinkError);
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при прямой отправке в Telegram:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при отправке в Telegram'
    });
  }
});

export default router;