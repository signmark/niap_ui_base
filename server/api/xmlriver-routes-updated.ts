/**
 * XMLRiver API интеграция - маршруты для работы с API XMLRiver
 * Включает методы для:
 * - получения ключевых слов из XMLRiver API
 * - обогащения ключевых слов данными о частоте и конкуренции
 * - обновления данных о частоте для существующих ключевых слов
 * - сохранения API ключей пользователей
 */

import express, { Express, Request, Response, NextFunction } from "express";
import axios from "axios";
import { apiKeyService } from "../services/api-keys";
// Удалены неиспользуемые импорты
import { log } from "../utils/logger";

/**
 * Middleware для авторизации запросов
 */
const authenticateXmlRiverRequest = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Не авторизован',
      message: 'Требуется токен авторизации'
    });
  }
  
  // Извлекаем токен
  const token = authHeader.substring(7);
  
  try {
    // Используем наш собственный API для проверки токена
    // Получаем хост из запроса для правильного формирования URL
    const protocol = req.protocol;
    const host = req.get('host');
    const meUrl = `${protocol}://${host}/api/auth/me`;
    
    const response = await axios.get(meUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data?.user?.id) {
      log('Invalid token: cannot get user info', 'xmlriver-auth');
      return res.status(401).json({ error: 'Не авторизован: Недействительный токен' });
    }

    // Устанавливаем информацию о пользователе в объект запроса
    const userId = response.data.user.id;
    
    log(`User authenticated: ${userId}`, 'xmlriver-auth');
    
    // Сохраняем информацию о пользователе в запросе
    (req as any).userId = userId;
    (req as any).token = token;
    
    next();
  } catch (error) {
    log(`Auth error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'xmlriver-auth');
    return res.status(401).json({ 
      error: 'Не авторизован: Ошибка проверки токена',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Функция для безопасного создания заголовков авторизации
 * Проверяет, что токен не null, не undefined и не строка 'null'
 */
const createAuthHeaders = (token: string | null | undefined) => {
  // Проверяем, что токен существует и не равен строке 'null'
  if (token && token !== 'null') {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
};

/**
 * Регистрирует маршруты для работы с XMLRiver API
 * @param app Express приложение
 */
export function registerXmlRiverRoutes(app: Express): void {
  // Маршрут для обновления данных о трендах ключевых слов (новая версия)
  app.post('/api/xmlriver/update-keywords-trends', async (req: Request, res: Response) => {
    const { campaignId } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат данных',
        message: 'Необходимо указать ID кампании'
      });
    }
    
    try {
      // Предустановленные данные API для запроса
      const apiUrl = 'http://xmlriver.com/wordstat/json';
      const hardcodedKey = {"user":"16797","key":"f7947eff83104621deb713275fe3260bfde4f001"};
      
      // Получаем токен для доступа к Directus
      const authHeader = req.headers.authorization;
      let token = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        console.log('[XMLRiver] Токен авторизации не предоставлен, используем базовый запрос к Directus');
      }
      
      // Получаем список существующих ключевых слов для кампании
      const protocol = req.protocol;
      const host = req.get('host');
      const keywordsUrl = `${protocol}://${host}/api/keywords/${campaignId}`;
      
      // Добавляем специальный заголовок для внутренних запросов, чтобы получить доступ к API без токена
      const keywordsResponse = await axios.get(keywordsUrl, {
        headers: {
          ...createAuthHeaders(token),
          'x-internal-request': 'xmlriver-service'
        }
      });
      
      if (!keywordsResponse.data) {
        return res.status(404).json({
          success: false,
          error: 'Ключевые слова не найдены',
          message: 'Не удалось получить список ключевых слов для кампании'
        });
      }
      
      const keywords = keywordsResponse.data;
      
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Ключевые слова не найдены',
          message: 'Список ключевых слов пуст'
        });
      }
      
      // Обрабатываем каждое ключевое слово
      let updatedCount = 0;
      const updatedKeywords = [];
      
      for (const keywordObj of keywords) {
        try {
          // Запрос к XMLRiver API для получения данных о ключевом слове
          console.log(`[XMLRiver] Обновление данных для ключевого слова: ${keywordObj.keyword}`);
          
          const response = await axios.get(apiUrl, {
            params: {
              user: hardcodedKey.user,
              key: hardcodedKey.key,
              query: keywordObj.keyword
            }
          });
          
          // Проверяем структуру ответа
          if (response.data?.content?.includingPhrases?.items) {
            const items = response.data.content.includingPhrases.items;
            
            // Ищем наше ключевое слово в результатах
            const keywordData = items.find((item: any) => 
              item.phrase.toLowerCase() === keywordObj.keyword.toLowerCase()
            );
            
            if (keywordData) {
              const frequency = parseInt(keywordData.number.replace(/\s/g, '')) || 3500;
              // Теперь обновляем только частоту, игнорируя конкуренцию
              
              // Определяем пути к Directus API и нашему собственному API
              const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055/items/campaign_keywords';
              
              if (directusUrl && directusUrl.includes('directus')) {
                // Если используем реальный Directus
                await axios.patch(
                  `${directusUrl}/${keywordObj.id}`,
                  {
                    trend_score: frequency,
                    last_checked: new Date().toISOString()
                  },
                  {
                    headers: createAuthHeaders(token)
                  }
                );
              } else {
                // Запрос через локальный API
                const updateUrl = `${protocol}://${host}/api/keywords/update`;
                await axios.post(updateUrl, {
                  id: keywordObj.id,
                  trend_score: frequency,
                  last_checked: new Date().toISOString()
                });
              }
              
              updatedCount++;
              updatedKeywords.push({
                id: keywordObj.id,
                keyword: keywordObj.keyword,
                frequency
              });
            }
          }
        } catch (keywordError) {
          console.error(`[XMLRiver] Ошибка при обновлении ключевого слова ${keywordObj.keyword}:`, keywordError);
          // Пропускаем ошибку и продолжаем с другими ключевыми словами
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Обновлено ${updatedCount} ключевых слов`,
        updatedCount,
        updatedKeywords
      });
    } catch (error) {
      console.error(`[XMLRiver] Ошибка при обновлении данных о трендах: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обновлении данных о трендах'
      });
    }
  });

  // Маршрут для обновления данных о конкуренции для существующих ключевых слов
  app.post('/api/xmlriver/update-keywords-competition', async (req: Request, res: Response) => {
    const { campaignId } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат данных',
        message: 'Необходимо указать ID кампании'
      });
    }
    
    try {
      // Предустановленные данные API для запроса
      const apiUrl = 'http://xmlriver.com/wordstat/json';
      const hardcodedKey = {"user":"16797","key":"f7947eff83104621deb713275fe3260bfde4f001"};
      
      // Получаем токен для доступа к Directus
      const authHeader = req.headers.authorization;
      let token = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        console.log('[XMLRiver] Токен авторизации не предоставлен, используем базовый запрос к Directus');
      }
      
      // Получаем список существующих ключевых слов для кампании
      const protocol = req.protocol;
      const host = req.get('host');
      const keywordsUrl = `${protocol}://${host}/api/keywords/${campaignId}`;
      
      // Добавляем специальный заголовок для внутренних запросов, чтобы получить доступ к API без токена
      const keywordsResponse = await axios.get(keywordsUrl, {
        headers: {
          ...createAuthHeaders(token),
          'x-internal-request': 'xmlriver-service'
        }
      });
      
      if (!keywordsResponse.data) {
        return res.status(404).json({
          success: false,
          error: 'Ключевые слова не найдены',
          message: 'Не удалось получить список ключевых слов для кампании'
        });
      }
      
      const keywords = keywordsResponse.data;
      
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Ключевые слова не найдены',
          message: 'Список ключевых слов пуст'
        });
      }
      
      // Обрабатываем каждое ключевое слово
      let updatedCount = 0;
      const updatedKeywords = [];
      
      for (const keywordObj of keywords) {
        try {
          // Запрос к XMLRiver API для получения данных о ключевом слове
          console.log(`[XMLRiver] Обновление данных для ключевого слова: ${keywordObj.keyword}`);
          
          const response = await axios.get(apiUrl, {
            params: {
              user: hardcodedKey.user,
              key: hardcodedKey.key,
              query: keywordObj.keyword
            }
          });
          
          // Проверяем структуру ответа
          if (response.data?.content?.includingPhrases?.items) {
            const items = response.data.content.includingPhrases.items;
            
            // Ищем наше ключевое слово в результатах
            const keywordData = items.find((item: any) => 
              item.phrase.toLowerCase() === keywordObj.keyword.toLowerCase()
            );
            
            if (keywordData) {
              const frequency = parseInt(keywordData.number.replace(/\s/g, '')) || 3500;
              
              // Вычисляем максимальную частоту для нормализации конкуренции
              const maxFrequency = Math.max(...items.map((item: any) => 
                parseInt(item.number.replace(/\s/g, '')) || 0
              ));
              
              // Рассчитываем конкуренцию
              let competition = 75; // Значение по умолчанию
              if (frequency > 0 && maxFrequency > 0) {
                const normalizedFreq = frequency / maxFrequency;
                competition = Math.max(1, Math.round(Math.pow(normalizedFreq, 0.4) * 100));
              }
              
              // Обновляем данные в Directus, если они изменились
              if (keywordObj.trend_score !== frequency || keywordObj.mentions_count !== competition) {
                // Здесь используем либо прямой запрос к Directus, либо специальный API-маршрут
                if (token) {
                  const directusUrl = 'https://directus.nplanner.ru/items/campaign_keywords';
                  await axios.patch(
                    `${directusUrl}/${keywordObj.id}`,
                    {
                      trend_score: frequency,
                      mentions_count: competition,
                      last_checked: new Date().toISOString()
                    },
                    {
                      headers: createAuthHeaders(token)
                    }
                  );
                } else {
                  // Запрос через локальный API
                  const updateUrl = `${protocol}://${host}/api/keywords/update`;
                  await axios.post(updateUrl, {
                    id: keywordObj.id,
                    trend_score: frequency,
                    mentions_count: competition,
                    last_checked: new Date().toISOString()
                  });
                }
                
                updatedCount++;
                updatedKeywords.push({
                  id: keywordObj.id,
                  keyword: keywordObj.keyword,
                  frequency,
                  competition
                });
              }
            }
          }
        } catch (keywordError) {
          console.error(`[XMLRiver] Ошибка при обновлении ключевого слова ${keywordObj.keyword}:`, keywordError);
          // Пропускаем ошибку и продолжаем с другими ключевыми словами
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Обновлено ${updatedCount} ключевых слов`,
        updatedCount,
        updatedKeywords
      });
    } catch (error) {
      console.error(`[XMLRiver] Ошибка при обновлении данных о конкуренции: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обновлении данных о конкуренции'
      });
    }
  });

  // Маршрут для обогащения ключевых слов данными о конкуренции
  app.post('/api/xmlriver/enrich-keywords', async (req: Request, res: Response) => {
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат данных',
        message: 'Необходимо предоставить массив ключевых слов'
      });
    }
    
    try {
      const enrichedKeywords = [];
      
      // Обрабатываем каждое ключевое слово
      for (const keyword of keywords) {
        // Запрос к XMLRiver API для получения данных о ключевом слове
        console.log(`[XMLRiver] Обогащение данных для ключевого слова: ${keyword}`);
        
        // Использование предустановленных данных API для запроса
        const apiUrl = 'http://xmlriver.com/wordstat/json';
        const hardcodedKey = {"user":"16797","key":"f7947eff83104621deb713275fe3260bfde4f001"};
        
        const response = await axios.get(apiUrl, {
          params: {
            user: hardcodedKey.user,
            key: hardcodedKey.key,
            query: keyword
          }
        });
        
        // Проверяем структуру ответа
        if (response.data?.content?.includingPhrases?.items) {
          const items = response.data.content.includingPhrases.items;
          
          // Ищем наше ключевое слово в результатах (обычно это первый элемент)
          const keywordData = items.find((item: any) => 
            item.phrase.toLowerCase() === keyword.toLowerCase()
          );
          
          if (keywordData) {
            const frequency = parseInt(keywordData.number.replace(/\s/g, '')) || 3500;
            
            // Вычисляем максимальную частоту для нормализации конкуренции
            const maxFrequency = Math.max(...items.map((item: any) => 
              parseInt(item.number.replace(/\s/g, '')) || 0
            ));
            
            // Рассчитываем конкуренцию по той же формуле, что и для поиска
            let competition = 75; // Значение по умолчанию
            if (frequency > 0 && maxFrequency > 0) {
              const normalizedFreq = frequency / maxFrequency;
              competition = Math.max(1, Math.round(Math.pow(normalizedFreq, 0.4) * 100));
            }
            
            enrichedKeywords.push({
              keyword,
              frequency,
              competition
            });
          } else {
            // Если ключевое слово не найдено, используем значения по умолчанию
            enrichedKeywords.push({
              keyword,
              frequency: 3500,
              competition: 75
            });
          }
        } else {
          // Если структура ответа не соответствует ожиданиям, используем значения по умолчанию
          enrichedKeywords.push({
            keyword,
            frequency: 3500,
            competition: 75
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        data: enrichedKeywords
      });
    } catch (error) {
      console.error(`[XMLRiver] Ошибка при обогащении ключевых слов: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обработке запроса к XMLRiver API'
      });
    }
  });

  app.post('/api/xmlriver/save-key', authenticateXmlRiverRequest, async (req: Request, res: Response) => {
    try {
      const { apiKey, userId } = req.body;
      const userIdFromToken = (req as any).userId;
      const token = (req as any).token;
      
      if (userIdFromToken !== userId) {
        return res.status(403).json({
          error: 'Отказано в доступе',
          message: 'Вы можете сохранять API ключи только для своего аккаунта'
        });
      }
      
      if (!apiKey) {
        return res.status(400).json({
          error: 'Отсутствует API ключ',
          message: 'Необходимо указать API ключ'
        });
      }
      
      // Попытка форматировать API ключ, если он не является JSON
      let formattedApiKey = apiKey;
      
      try {
        // Проверяем, является ли ключ валидным JSON
        JSON.parse(apiKey);
      } catch (e) {
        // Если ключ не является JSON, преобразуем его в формат JSON
        // Например, если ключ передан в формате "user:123,key:abc"
        const parts = apiKey.split(',');
        const keyObj: Record<string, string> = {};
        
        for (const part of parts) {
          const segments = part.split(':');
          const key = segments[0]?.trim() || '';
          const value = segments[1]?.trim() || '';
          if (key && value) {
            keyObj[key] = value;
          }
        }
        
        if (Object.keys(keyObj).length > 0) {
          formattedApiKey = JSON.stringify(keyObj);
        }
      }
      
      try {
        // Сохраняем ключ в базе данных
        const result = await apiKeyService.saveApiKey(
          userId, 
          'xmlriver', 
          formattedApiKey, 
          token
        );
        
        if (!result.success) {
          return res.status(500).json({
            error: 'Ошибка сохранения ключа',
            message: result.error || 'Не удалось сохранить ключ'
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'API ключ успешно сохранен'
        });
      } catch (error) {
        console.error('Error saving API key:', error);
        return res.status(500).json({
          error: 'Ошибка сохранения ключа',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error in /api/xmlriver/save-key:', error);
      return res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обработке запроса'
      });
    }
  });

  app.get('/api/xmlriver/keywords/:query', async (req: Request, res: Response) => {
    try {
      const query = req.params.query;
      const requestId = Date.now();
      
      if (!query) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing query parameter' 
        });
      }
      
      try {
        const hardcodedKey = {"user":"16797","key":"f7947eff83104621deb713275fe3260bfde4f001"};
        
        console.log(`[xmlriver] [${requestId}] Поиск ключевых слов для UI: ${query}`);
        console.log(`[xmlriver] [${requestId}] Запрос ключевых слов к XMLRiver с фиксированными данными для: ${query}`);
        console.log(`[xmlriver] [${requestId}] Параметры запроса: user=${hardcodedKey.user}, key=${hardcodedKey.key.substring(0, 6)}..., query=${query}`);
        
        // Используем предоставленный ключ для запроса к API
        const apiUrl = 'http://xmlriver.com/wordstat/json';
        const response = await axios.get(apiUrl, {
          params: {
            user: hardcodedKey.user,
            key: hardcodedKey.key,
            query: query
          }
        });
        
        // Проверяем, что ответ содержит нужные данные
        if (!response.data?.content?.includingPhrases?.items) {
          return res.status(500).json({ 
            success: false,
            error: 'Invalid response from XMLRiver API' 
          });
        }
        
        // Преобразуем данные в нужный формат
        const items = response.data.content.includingPhrases.items;
        const keywords = items.map((item: any) => {
          // Извлекаем число запросов, убирая пробелы
          const frequency = parseInt(item.number.replace(/\s/g, '')) || 0;
          
          return {
            keyword: item.phrase,
            frequency
          };
        });
        
        console.log(`[xmlriver] [${requestId}] Получено ${keywords.length} ключевых слов от XMLRiver`);
        
        return res.status(200).json({ 
          success: true,
          data: keywords
        });
      } catch (error) {
        console.error(`[xmlriver] [${requestId}] Error fetching keywords from XMLRiver:`, error);
        
        return res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } catch (error) {
      console.error('Error in /api/xmlriver/keywords endpoint:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  });
}