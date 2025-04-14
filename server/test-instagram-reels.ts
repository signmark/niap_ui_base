/**
 * Тестовый скрипт для прямой публикации Reels в Instagram
 * с использованием оптимизированных параметров видео
 * 
 * Этот скрипт создает отдельную точку доступа для тестирования 
 * Instagram Reels API с более простым подходом и детальным логированием
 */

import express from 'express';
import axios from 'axios';
import { log } from '../shared/utils/logger';
import fs from 'fs';
import { videoProcessor } from './services/video-processor';

// Создаем роутер для тестовых маршрутов
const instagramTestRouter = express.Router();

// Путь к файлу логов для более детального анализа
const logFilePath = './logs/instagram-reels-test.log';

// Функция для записи в файл логов
function writeToLogFile(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logFilePath, logMessage);
  } catch (error) {
    console.error('Ошибка записи в лог-файл:', error);
  }
}

/**
 * Маршрут для тестирования публикации Reels в Instagram
 * с упрощенными параметрами и улучшенным логированием
 */
instagramTestRouter.post('/test-reels', async (req, res) => {
  const { videoUrl, caption, token, businessAccountId } = req.body;
  
  if (!videoUrl || !token || !businessAccountId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Требуются параметры: videoUrl, token, businessAccountId' 
    });
  }
  
  // Записываем входные данные в лог
  writeToLogFile(`======= НОВАЯ ПОПЫТКА ПУБЛИКАЦИИ REELS =======`);
  writeToLogFile(`Видео URL: ${videoUrl}`);
  writeToLogFile(`Бизнес-аккаунт ID: ${businessAccountId}`);
  writeToLogFile(`Наличие токена: ${token ? 'Да' : 'Нет'}`);
  writeToLogFile(`Подпись: ${caption || '(нет подписи)'}`);
  
  try {
    log(`[InstagramReelsTest] Начало тестирования публикации Reels`, 'instagram-test');
    log(`[InstagramReelsTest] Оптимизация видео для Instagram...`, 'instagram-test');
    
    // Шаг 1: Обработка видео для Instagram (оптимизация под Reels)
    const processedVideoUrl = await videoProcessor.processVideo(videoUrl, 'instagram');
    
    if (!processedVideoUrl) {
      writeToLogFile(`ОШИБКА: Не удалось обработать видео для Instagram`);
      return res.status(500).json({
        success: false,
        error: 'Ошибка обработки видео'
      });
    }
    
    log(`[InstagramReelsTest] Видео успешно обработано: ${processedVideoUrl}`, 'instagram-test');
    writeToLogFile(`Обработанное видео URL: ${processedVideoUrl}`);
    
    // Шаг 2: Создание контейнера для Reels
    const baseUrl = `https://graph.facebook.com/v19.0/${businessAccountId}/media`;
    
    // Упрощенные и минимальные параметры для создания контейнера
    const containerParams = {
      media_type: 'REELS',
      video_url: processedVideoUrl,
      access_token: token
    };
    
    // Добавляем подпись, если она предоставлена
    if (caption) {
      containerParams['caption'] = caption;
    }
    
    writeToLogFile(`Параметры контейнера: ${JSON.stringify(containerParams, null, 2)}`);
    log(`[InstagramReelsTest] Создание контейнера для Reels`, 'instagram-test');
    
    const containerResponse = await axios.post(baseUrl, containerParams, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SMM-Manager/1.0'
      }
    });
    
    const containerId = containerResponse.data.id;
    log(`[InstagramReelsTest] Контейнер создан с ID: ${containerId}`, 'instagram-test');
    writeToLogFile(`Создан контейнер с ID: ${containerId}`);
    
    // Шаг 3: Ожидание обработки видео на серверах Instagram
    // Увеличиваем начальное ожидание для большей вероятности успеха
    log(`[InstagramReelsTest] Ожидание 60 секунд для обработки видео...`, 'instagram-test');
    writeToLogFile(`Ожидание 60 секунд для начальной обработки видео`);
    
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Шаг 4: Проверка статуса контейнера
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts && !isReady) {
      attempts++;
      
      const statusUrl = `https://graph.facebook.com/v19.0/${containerId}`;
      const statusParams = {
        fields: 'status_code',  // Запрашиваем только статус для минимизации ошибок
        access_token: token
      };
      
      log(`[InstagramReelsTest] Проверка статуса контейнера (попытка ${attempts}/${maxAttempts})`, 'instagram-test');
      writeToLogFile(`Проверка статуса контейнера (попытка ${attempts}/${maxAttempts})`);
      
      try {
        const statusResponse = await axios.get(statusUrl, { params: statusParams });
        
        writeToLogFile(`Ответ проверки статуса: ${JSON.stringify(statusResponse.data, null, 2)}`);
        
        if (statusResponse.data.status_code === 'FINISHED') {
          log(`[InstagramReelsTest] Статус: FINISHED - видео готово к публикации`, 'instagram-test');
          writeToLogFile(`Статус: FINISHED - видео готово к публикации`);
          isReady = true;
        } else if (statusResponse.data.status_code === 'IN_PROGRESS') {
          log(`[InstagramReelsTest] Статус: IN_PROGRESS - продолжаем ждать`, 'instagram-test');
          writeToLogFile(`Статус: IN_PROGRESS - продолжаем ждать`);
          
          // Ждем перед следующей проверкой
          const waitTime = 45000 + (attempts * 15000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (statusResponse.data.status_code === 'ERROR') {
          log(`[InstagramReelsTest] Статус: ERROR - проблема с обработкой видео`, 'instagram-test');
          writeToLogFile(`Статус: ERROR - проблема с обработкой видео`);
          
          // Пробуем получить дополнительные детали ошибки
          try {
            const detailsUrl = `https://graph.facebook.com/v19.0/${containerId}`;
            const detailsParams = {
              fields: 'status_code,error_message',
              access_token: token
            };
            
            const detailsResponse = await axios.get(detailsUrl, { params: detailsParams });
            writeToLogFile(`Детали ошибки: ${JSON.stringify(detailsResponse.data, null, 2)}`);
          } catch (detailsError) {
            writeToLogFile(`Не удалось получить детали ошибки: ${detailsError.message}`);
          }
          
          // Продолжаем попытки, если не достигли максимума
          if (attempts < maxAttempts) {
            const waitTime = 45000 + (attempts * 15000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } else {
          log(`[InstagramReelsTest] Неизвестный статус: ${statusResponse.data.status_code}`, 'instagram-test');
          writeToLogFile(`Неизвестный статус: ${statusResponse.data.status_code}`);
          
          // Ждем перед следующей проверкой
          const waitTime = 45000 + (attempts * 15000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (statusError) {
        log(`[InstagramReelsTest] Ошибка при проверке статуса: ${statusError.message}`, 'instagram-test');
        writeToLogFile(`Ошибка при проверке статуса: ${statusError.message}`);
        
        // Ждем перед следующей проверкой
        const waitTime = 45000 + (attempts * 15000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Шаг 5: Публикация контейнера (даже если статус не FINISHED)
    log(`[InstagramReelsTest] Публикация контейнера ${containerId}`, 'instagram-test');
    writeToLogFile(`Публикация контейнера ${containerId}`);
    
    const publishUrl = `https://graph.facebook.com/v19.0/${businessAccountId}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: token
    };
    
    try {
      const publishResponse = await axios.post(publishUrl, publishParams);
      
      log(`[InstagramReelsTest] Успешная публикация! ID: ${publishResponse.data.id}`, 'instagram-test');
      writeToLogFile(`УСПЕХ! Опубликовано с ID: ${publishResponse.data.id}`);
      
      // Получение постоянной ссылки
      try {
        const mediaInfoUrl = `https://graph.facebook.com/v19.0/${publishResponse.data.id}`;
        const mediaInfoParams = {
          fields: 'id,permalink',
          access_token: token
        };
        
        const mediaInfoResponse = await axios.get(mediaInfoUrl, { params: mediaInfoParams });
        
        if (mediaInfoResponse.data.permalink) {
          log(`[InstagramReelsTest] Постоянная ссылка: ${mediaInfoResponse.data.permalink}`, 'instagram-test');
          writeToLogFile(`Постоянная ссылка: ${mediaInfoResponse.data.permalink}`);
          
          // Возвращаем успешный результат с постоянной ссылкой
          return res.json({
            success: true,
            mediaId: publishResponse.data.id,
            permalink: mediaInfoResponse.data.permalink
          });
        } else {
          // Возвращаем успешный результат без постоянной ссылки
          return res.json({
            success: true,
            mediaId: publishResponse.data.id,
            permalink: null
          });
        }
      } catch (permalinkError) {
        log(`[InstagramReelsTest] Успешно опубликовано, но не удалось получить ссылку: ${permalinkError.message}`, 'instagram-test');
        writeToLogFile(`Успешно опубликовано, но не удалось получить ссылку: ${permalinkError.message}`);
        
        // Возвращаем успешный результат без постоянной ссылки
        return res.json({
          success: true,
          mediaId: publishResponse.data.id,
          permalink: null
        });
      }
    } catch (publishError) {
      log(`[InstagramReelsTest] Ошибка при публикации: ${publishError.message}`, 'instagram-test');
      writeToLogFile(`ОШИБКА ПУБЛИКАЦИИ: ${publishError.message}`);
      
      if (publishError.response && publishError.response.data) {
        writeToLogFile(`Детали ошибки: ${JSON.stringify(publishError.response.data, null, 2)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации: ${publishError.message}`,
        containerId
      });
    }
  } catch (error) {
    log(`[InstagramReelsTest] Общая ошибка: ${error.message}`, 'instagram-test');
    writeToLogFile(`КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Общая ошибка: ${error.message}`
    });
  }
});

export { instagramTestRouter };