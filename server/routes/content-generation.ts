/**
 * Роут для безопасной генерации контента
 * Действует как прокси между клиентом и Directus API
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// Простая функция логирования
const logger = {
  info: (message: string, data?: any) => console.log(`INFO: ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`ERROR: ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`WARN: ${message}`, data || ''),
  debug: (message: string, data?: any) => console.log(`DEBUG: ${message}`, data || '')
};

// Основной маршрут для генерации контента
router.post('/generate-content', async (req, res) => {
  try {
    const { campaignId, keywords, platform, tone, prompt, service, useCampaignData } = req.body;
    
    // Проверка обязательных параметров
    if (!campaignId || !keywords || !platform || !tone || !prompt || !service) {
      return res.status(400).json({
        success: false,
        message: 'Не все обязательные параметры указаны'
      });
    }
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    // Логирование запроса
    logger.info(`[CONTENT-GEN] Запрос на генерацию контента для кампании ${campaignId} с ${keywords.length} ключевыми словами`);
    logger.info(`[CONTENT-GEN] useCampaignData: ${useCampaignData}`);
    
    let campaignWebsiteUrl = null;
    let campaignQuestionnaire = null;
    
    // Если включено использование данных кампании, получаем данные из Directus
    if (useCampaignData) {
      try {
        logger.info(`Получение данных кампании ${campaignId} с токеном пользователя`);
        
        const campaignResponse = await axios.get(`${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        logger.info('Ответ Directus для кампании:', JSON.stringify(campaignResponse.data, null, 2));
        
        if (campaignResponse.data?.data?.link) {
          campaignWebsiteUrl = campaignResponse.data.data.link;
          logger.info(`Получена ссылка на сайт кампании: ${campaignWebsiteUrl}`);
        } else {
          logger.warn('Ссылка на сайт кампании не найдена в ответе Directus');
        }

        // Получаем анкету
        if (campaignResponse.data?.data?.questionnaire) {
          campaignQuestionnaire = campaignResponse.data.data.questionnaire;
          logger.info(`Получена анкета кампании, длина: ${campaignQuestionnaire.length} символов`);
        } else {
          logger.warn('Анкета кампании не найдена в ответе Directus');
        }
      } catch (error) {
        logger.error('Не удалось получить данные кампании из Directus:', error);
      }
    }
    
    try {
      // Используем Directus API для генерации контента
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Логи для отладки
      logger.info('Параметры запроса генерации контента:', {
        campaignId,
        keywordCount: keywords?.length || 0,
        platform,
        tone,
        service
      });
      
      // Создаем запрос к Directus
      const response = await axios({
        method: 'post',
        url: `${directusUrl}/content/generate`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          campaignId,
          keywords,
          platform,
          tone,
          prompt: useCampaignData ? 
            `${prompt}${campaignWebsiteUrl ? ` Обязательно включи ссылку на наш сайт: ${campaignWebsiteUrl}` : ''}${campaignQuestionnaire ? ` Используй информацию из анкеты: ${campaignQuestionnaire}` : ''}` : 
            prompt,
          service,
          useCampaignData,
          campaignWebsiteUrl
        },
        timeout: 60000 // 60 секунд таймаут для генерации
      });
      
      // Если запрос успешный, возвращаем результат клиенту
      logger.info(`Контент успешно сгенерирован для кампании ${campaignId}`);
      
      // Форматируем ответ в формат, ожидаемый клиентом
      console.log('Ответ от Directus API:', response.data);
      
      // Извлекаем контент из ответа, учитывая разные возможные структуры
      let content = '';
      if (response.data.content) {
        content = response.data.content;
      } else if (response.data.text) {
        content = response.data.text;
      } else if (response.data.data?.content) {
        content = response.data.data.content;
      } else if (response.data.data?.text) {
        content = response.data.data.text;
      } else if (typeof response.data === 'string') {
        content = response.data;
      } else if (response.data.data && typeof response.data.data === 'string') {
        content = response.data.data;
      }
      
      console.log('Извлеченный контент для отправки клиенту:', content);
      
      // Отправляем ответ в формате, ожидаемом клиентом
      return res.status(200).json({
        content: content || 'Не удалось извлечь контент из ответа API',
        service: service // Возвращаем выбранный сервис
      });
      
    } catch (directusError: any) {
      // Обработка ошибок от Directus
      logger.error(`Ошибка при запросе к Directus: ${directusError.message}`, {
        status: directusError.response?.status,
        statusText: directusError.response?.statusText,
        responseData: directusError.response?.data
      });
      
      // Если проблема с авторизацией, возвращаем соответствующую ошибку
      if (directusError.response?.status === 401 || directusError.response?.status === 403) {
        return res.status(401).json({
          success: false,
          message: 'Необходима повторная авторизация',
          requireReauth: true
        });
      }
      
      // Возвращаем информацию об ошибке
      return res.status(directusError.response?.status || 500).json({
        success: false,
        message: `Ошибка при генерации контента: ${directusError.message}`,
        details: directusError.response?.data
      });
    }
    
  } catch (error: any) {
    // Общая обработка ошибок
    logger.error(`Ошибка в роуте генерации контента: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при генерации контента'
    });
  }
});

// Роут для прямого прокси к API Directus
router.post('/direct-generate', async (req, res) => {
  try {
    const { campaignId, keywords, platform, tone, prompt, service } = req.body;
    
    // Проверка обязательных параметров
    if (!campaignId || !keywords || !platform || !tone || !prompt || !service) {
      return res.status(400).json({
        success: false,
        message: 'Не все обязательные параметры указаны'
      });
    }
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    // Логирование запроса
    logger.info(`Прямой запрос на генерацию контента через Directus для кампании ${campaignId}`);
    
    // Здесь можно использовать альтернативный метод генерации контента
    // например, через прямые вызовы моделей ИИ, минуя Directus API
    
    // Пример заглушки для тестирования
    return res.status(200).json({
      success: true,
      data: {
        title: `Сгенерированный контент для платформы ${platform}`,
        text: `Текст публикации на тему: ${keywords.join(', ')}. Тон: ${tone}. С использованием: ${service}`,
        generated: true,
        campaignId
      }
    });
    
  } catch (error: any) {
    logger.error(`Ошибка в прямом роуте генерации: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при прямой генерации контента'
    });
  }
});

// Экспортируем роутер
export default router;