import { Express, Request, Response } from "express";
import { deepseekService, DeepSeekService, DeepSeekMessage } from './services/deepseek';
import { apiKeyService } from './services/api-keys';

/**
 * Функция для регистрации тестовых роутов DeepSeek API
 * @param app Express приложение
 */
export function registerDeepSeekTestRoutes(app: Express) {
  
  // Тестовый эндпоинт для проверки API ключа DeepSeek
  app.get('/api/test-deepseek', async (req: Request, res: Response) => {
    try {
      console.log('Тестирование DeepSeek API');
      
      // Проверяем, что пользователь авторизован
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
      }
      
      // Получаем API ключ из параметров запроса или из БД
      let apiKey = req.query.apiKey as string | undefined;
      
      if (!apiKey) {
        // Пытаемся получить ключ из БД
        apiKey = await apiKeyService.getApiKey(req.user.id, 'deepseek');
        
        if (!apiKey) {
          return res.status(400).json({ 
            success: false, 
            error: 'API ключ DeepSeek не предоставлен и не найден в настройках пользователя' 
          });
        }
      }
      
      console.log(`Получен API ключ DeepSeek для тестирования (длина: ${apiKey.length})`);
      
      // Список форматов ключей для тестирования
      const keyFormats = [
        { description: 'Оригинальный', key: apiKey },
        { description: 'Без префикса Bearer', key: apiKey.replace(/^Bearer\s+/i, '') },
        { description: 'С префиксом Bearer', key: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}` },
      ];
      
      // Проверка каждого формата ключа
      const results = [];
      
      for (const format of keyFormats) {
        try {
          console.log(`Тестирование формата: ${format.description}`);
          
          // Настраиваем временный экземпляр DeepSeek с текущим форматом ключа
          const testService = new DeepSeekService({ apiKey: format.key });
          
          // Простой тестовый запрос
          const testPrompt = await testService.generateText(
            [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Say hello in one word." }
            ],
            { max_tokens: 10 }
          );
          
          results.push({
            format: format.description,
            success: true,
            result: testPrompt
          });
          
          console.log(`Формат ${format.description} успешно работает: ${testPrompt}`);
        } catch (error: any) {
          console.error(`Ошибка для формата ${format.description}:`, error);
          
          results.push({
            format: format.description,
            success: false,
            error: error.message || String(error)
          });
        }
      }
      
      // Проверяем, есть ли хотя бы один успешный формат
      const anySuccess = results.some(r => r.success);
      
      // Если есть успешный формат, предлагаем сохранить его в БД
      if (anySuccess) {
        const successFormat = results.find(r => r.success);
        const successIndex = keyFormats.findIndex((_, i) => results[i].success);
        
        if (successIndex > 0) {  // Если это не оригинальный формат
          const successKeyFormat = keyFormats[successIndex];
          
          // Предлагаем сохранение в результатах, но не сохраняем автоматически
          // Пользователь должен сам решить, сохранять или нет
          return res.json({
            success: true,
            results,
            recommendation: {
              message: `Рекомендуем сохранить работающий формат ключа (${successFormat?.format})`,
              apiKey: successKeyFormat.key
            }
          });
        }
      }
      
      // Возвращаем результаты проверки
      return res.json({
        success: anySuccess,
        results,
        message: anySuccess 
          ? 'Найден работающий формат ключа DeepSeek API' 
          : 'Все форматы ключа DeepSeek API не работают'
      });
      
    } catch (error: any) {
      console.error('Ошибка при тестировании DeepSeek API:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Непредвиденная ошибка при тестировании DeepSeek API'
      });
    }
  });
  
  // Сохранение рекомендованного API ключа в БД
  app.post('/api/save-deepseek-key', async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
      }
      
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'API ключ не предоставлен' });
      }
      
      // Сохраняем ключ в БД
      const saved = await apiKeyService.saveApiKey(req.user.id, 'deepseek', apiKey);
      
      if (saved) {
        return res.json({ success: true, message: 'API ключ DeepSeek успешно сохранен' });
      } else {
        return res.status(500).json({ success: false, error: 'Не удалось сохранить API ключ DeepSeek' });
      }
      
    } catch (error: any) {
      console.error('Ошибка при сохранении API ключа DeepSeek:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Непредвиденная ошибка при сохранении API ключа DeepSeek'
      });
    }
  });
}