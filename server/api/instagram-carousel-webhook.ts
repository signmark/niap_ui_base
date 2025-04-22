/**
 * Оптимизированный сервер-эндпоинт для публикации карусели в Instagram
 * Использует более стабильную версию API и правильное форматирование параметров
 */

import express from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

export const register = (app: express.Express) => {
  app.post('/api/instagram/publish-carousel', async (req, res) => {
    const { contentId, campaignId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Не указан ID контента' });
    }
    
    logger.info(`Запрос на публикацию карусели Instagram для контента ${contentId}`);
    
    try {
      // Отправляем запрос на webhook n8n для обработки карусели
      const webhookResponse = await axios.post(
        'https://n8n.nplanner.ru/webhook/publish-instagram-carousel',
        { contentId, campaignId },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000 // Увеличиваем таймаут, т.к. публикация карусели может занять больше времени
        }
      );
      
      logger.info(`Ответ от webhook n8n для карусели Instagram: ${JSON.stringify(webhookResponse.data)}`);
      return res.status(200).json(webhookResponse.data);
    } catch (error) {
      logger.error(`Ошибка при публикации карусели в Instagram: ${error.message}`);
      if (error.response) {
        logger.error(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
      }
      
      return res.status(500).json({
        error: 'Ошибка при публикации карусели в Instagram',
        message: error.message,
        details: error.response?.data
      });
    }
  });
  
  // Тестовый эндпоинт для прямой публикации карусели в Instagram без n8n
  app.post('/api/test/instagram-direct-carousel', async (req, res) => {
    const { token, businessAccountId, images, caption } = req.body;
    
    if (!token || !businessAccountId || !images || !Array.isArray(images) || images.length < 2) {
      return res.status(400).json({ 
        error: 'Не указаны необходимые параметры',
        details: 'Требуется token, businessAccountId и массив images (минимум 2 изображения)'
      });
    }
    
    logger.info(`Тестовый запрос на прямую публикацию карусели в Instagram. Изображений: ${images.length}`);
    
    try {
      // Массив для хранения ID контейнеров
      const containerIds = [];
      
      // Создаем контейнеры для каждого изображения
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        logger.info(`Создание контейнера для изображения ${i+1}/${images.length}: ${imageUrl}`);
        
        // Важный момент: is_carousel_item должен быть true (boolean), а не строка "true"
        const containerResponse = await axios.post(
          `https://graph.facebook.com/v16.0/${businessAccountId}/media`,
          {
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: token
          }
        );
        
        if (containerResponse.data && containerResponse.data.id) {
          containerIds.push(containerResponse.data.id);
          logger.info(`Контейнер для изображения ${i+1} создан успешно, ID: ${containerResponse.data.id}`);
        } else {
          throw new Error(`Не удалось создать контейнер для изображения ${i+1}: ответ без ID`);
        }
        
        // Добавляем задержку между запросами
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Проверяем, что созданы контейнеры
      if (containerIds.length === 0) {
        throw new Error('Не удалось создать ни одного контейнера для изображений');
      }
      
      logger.info(`Создано ${containerIds.length} контейнеров. Создание контейнера карусели...`);
      
      // Создаем контейнер карусели
      const carouselResponse = await axios.post(
        `https://graph.facebook.com/v16.0/${businessAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: containerIds.join(','),
          caption: caption || '',
          access_token: token
        }
      );
      
      if (!carouselResponse.data || !carouselResponse.data.id) {
        throw new Error('Не удалось создать контейнер карусели: ответ без ID');
      }
      
      const carouselContainerId = carouselResponse.data.id;
      logger.info(`Контейнер карусели создан успешно, ID: ${carouselContainerId}. Публикация...`);
      
      // Публикуем карусель
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v16.0/${businessAccountId}/media_publish`,
        {
          creation_id: carouselContainerId,
          access_token: token
        }
      );
      
      if (!publishResponse.data || !publishResponse.data.id) {
        throw new Error('Не удалось опубликовать карусель: ответ без ID');
      }
      
      logger.info(`Карусель опубликована успешно, ID: ${publishResponse.data.id}`);
      
      // Получаем permalink
      const permalinkResponse = await axios.get(
        `https://graph.facebook.com/v16.0/${publishResponse.data.id}?fields=permalink&access_token=${token}`
      );
      
      const permalink = permalinkResponse.data?.permalink || '';
      
      // Возвращаем результат
      return res.status(200).json({
        success: true,
        message: 'Карусель успешно опубликована',
        postId: publishResponse.data.id,
        permalink: permalink,
        containerIds: containerIds,
        carouselContainerId: carouselContainerId
      });
    } catch (error) {
      logger.error(`Ошибка при прямой публикации карусели в Instagram: ${error.message}`);
      if (error.response) {
        logger.error(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при публикации карусели в Instagram',
        message: error.message,
        details: error.response?.data
      });
    }
  });
  
  logger.info('Instagram карусель-эндпоинты зарегистрированы');
};