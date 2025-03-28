import { Express, Request, Response } from "express";
import { authenticateUser } from "../middleware/auth";
import { deepseekService, DeepSeekMessage } from '../services/deepseek';
import { qwenService, QwenMessage } from '../services/qwen';

/**
 * Настройка маршрутов для генерации контента
 */
export const setupContentGenerationRoutes = (app: Express): void => {
  /**
   * Маршрут для генерации текста с использованием DeepSeek AI
   */
  app.post('/api/content-generation/deepseek/text', authenticateUser, async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
      }
      
      const { prompt, trendsContext, tone = 'informative' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Не указан текст запроса (prompt)' });
      }
      
      // Инициализируем DeepSeek сервис с API ключом пользователя
      const initialized = await deepseekService.initialize(req.user.id);
      
      if (!initialized) {
        return res.status(400).json({ 
          success: false, 
          error: 'Не удалось инициализировать DeepSeek API. Проверьте настройки API ключа.' 
        });
      }
      
      // Формируем системный промт в зависимости от выбранного тона
      let systemInstructions = '';
      
      switch(tone) {
        case 'professional':
          systemInstructions = 'Используй профессиональный и формальный стиль. Предоставь экспертную информацию с использованием терминологии и четкой структуры.';
          break;
        case 'casual':
          systemInstructions = 'Используй повседневный, разговорный стиль. Будь дружелюбным и доступным, как при общении с другом.';
          break;
        case 'informative':
          systemInstructions = 'Предоставь фактическую информацию в четком, понятном формате. Сохрани баланс между детальностью и доступностью.';
          break;
        case 'funny':
          systemInstructions = 'Добавь юмор и легкость в текст. Используй игру слов, забавные примеры и доброжелательную интонацию.';
          break;
        default:
          systemInstructions = 'Предоставь полезную информацию в понятной форме.';
      }
      
      const systemPrompt = `Ты профессиональный копирайтер. Твоя задача - создать качественный контент для социальных сетей на основе предоставленного запроса и трендов.

${systemInstructions}

Учитывай контекст предоставленных трендовых тем, но концентрируйся в первую очередь на запросе пользователя.

ВАЖНЫЕ ПРАВИЛА:
- Создавай HTML-форматированный текст с тегами <p>, <strong>, <em> и <br> для структурирования
- Не используй заголовки <h1>, <h2> и т.д.
- Не включай цитат в формате блоков
- Не упоминай, что контент создан ИИ
- Не используй шаблонные фразы и клише
- Пиши естественным языком, избегая сложных конструкций
- Сохраняй оригинальный стиль, указанный в запросе`;
      
      // Подготавливаем контекст с трендами, если он есть
      let userPrompt = prompt;
      if (trendsContext && trendsContext.trim() !== '') {
        userPrompt = `Актуальные тренды: ${trendsContext}\n\nЗапрос: ${prompt}`;
      }
      
      // Формируем сообщения для запроса
      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      console.log(`Отправка запроса в DeepSeek API для генерации текста: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      
      // Отправляем запрос к API
      const generatedText = await deepseekService.generateText(
        messages,
        { 
          model: 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 1000
        }
      );
      
      console.log(`Успешно получен ответ от DeepSeek API длиной ${generatedText.length} символов`);
      
      // Важно: устанавливаем заголовок Content-Type явно, чтобы предотвратить автоматическое определение
      res.setHeader('Content-Type', 'application/json');
      
      // Возвращаем результат
      return res.json({
        success: true,
        content: generatedText
      });
      
    } catch (error: any) {
      console.error('Ошибка при генерации текста с DeepSeek API:', error);
      
      // Формируем подробное сообщение об ошибке для фронтенда
      let errorMessage = error.message || 'Непредвиденная ошибка при генерации текста';
      
      if (error.response?.data) {
        try {
          // Пытаемся корректно обработать разные форматы ответа
          let errorDetails = '';
          
          if (typeof error.response.data === 'string') {
            // Если данные - это строка, попробуем распарсить JSON, если он там есть
            if (error.response.data.includes('{') && error.response.data.includes('}')) {
              try {
                const jsonMatch = error.response.data.match(/\{.*\}/s);
                if (jsonMatch) {
                  const parsedJson = JSON.parse(jsonMatch[0]);
                  errorDetails = JSON.stringify(parsedJson);
                } else {
                  // Если не смогли найти JSON, используем часть текста
                  errorDetails = error.response.data.substring(0, 300);
                }
              } catch (e) {
                // Если не смогли распарсить, используем текст как есть
                errorDetails = error.response.data.substring(0, 300);
              }
            } else {
              // Простой текст
              errorDetails = error.response.data.substring(0, 300);
            }
          } else {
            // Объект, преобразуем в строку
            errorDetails = JSON.stringify(error.response.data).substring(0, 300);
          }
          
          errorMessage += ` (Статус: ${error.response.status}) Ответ API: ${errorDetails}`;
        } catch (e) {
          errorMessage += ` (Статус: ${error.response.status})`;
        }
      }
      
      // Важно: устанавливаем заголовок Content-Type явно, чтобы предотвратить автоматическое определение
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * Маршрут для генерации текста с использованием Qwen AI
   */
  app.post('/api/content-generation/qwen/text', authenticateUser, async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
      }
      
      const { prompt, trendsContext, tone = 'informative' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Не указан текст запроса (prompt)' });
      }
      
      // Инициализируем Qwen сервис с API ключом пользователя
      const initialized = await qwenService.initialize(req.user.id);
      
      if (!initialized) {
        return res.status(400).json({ 
          success: false, 
          error: 'Не удалось инициализировать Qwen API. Проверьте настройки API ключа.' 
        });
      }
      
      // Формируем системный промт в зависимости от выбранного тона
      let systemInstructions = '';
      
      switch(tone) {
        case 'professional':
          systemInstructions = 'Используй профессиональный и формальный стиль. Предоставь экспертную информацию с использованием терминологии и четкой структуры.';
          break;
        case 'casual':
          systemInstructions = 'Используй повседневный, разговорный стиль. Будь дружелюбным и доступным, как при общении с другом.';
          break;
        case 'informative':
          systemInstructions = 'Предоставь фактическую информацию в четком, понятном формате. Сохрани баланс между детальностью и доступностью.';
          break;
        case 'funny':
          systemInstructions = 'Добавь юмор и легкость в текст. Используй игру слов, забавные примеры и доброжелательную интонацию.';
          break;
        default:
          systemInstructions = 'Предоставь полезную информацию в понятной форме.';
      }
      
      const systemPrompt = `Ты профессиональный копирайтер. Твоя задача - создать качественный контент для социальных сетей на основе предоставленного запроса и трендов.

${systemInstructions}

Учитывай контекст предоставленных трендовых тем, но концентрируйся в первую очередь на запросе пользователя.

ВАЖНЫЕ ПРАВИЛА:
- Создавай HTML-форматированный текст с тегами <p>, <strong>, <em> и <br> для структурирования
- Не используй заголовки <h1>, <h2> и т.д.
- Не включай цитат в формате блоков
- Не упоминай, что контент создан ИИ
- Не используй шаблонные фразы и клише
- Пиши естественным языком, избегая сложных конструкций
- Сохраняй оригинальный стиль, указанный в запросе`;
      
      // Подготавливаем контекст с трендами, если он есть
      let userPrompt = prompt;
      if (trendsContext && trendsContext.trim() !== '') {
        userPrompt = `Актуальные тренды: ${trendsContext}\n\nЗапрос: ${prompt}`;
      }
      
      // Формируем сообщения для запроса
      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      console.log(`Отправка запроса в Qwen API для генерации текста: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      
      // Отправляем запрос к API
      const generatedText = await qwenService.generateText(
        messages,
        { 
          model: 'qwen-plus',
          temperature: 0.7,
          max_tokens: 1000
        }
      );
      
      console.log(`Успешно получен ответ от Qwen API длиной ${generatedText.length} символов`);
      
      // Важно: устанавливаем заголовок Content-Type явно, чтобы предотвратить автоматическое определение
      res.setHeader('Content-Type', 'application/json');
      
      // Возвращаем результат
      return res.json({
        success: true,
        content: generatedText
      });
      
    } catch (error: any) {
      console.error('Ошибка при генерации текста с Qwen API:', error);
      
      // Формируем подробное сообщение об ошибке для фронтенда
      let errorMessage = error.message || 'Непредвиденная ошибка при генерации текста';
      
      if (error.response?.data) {
        try {
          // Пытаемся корректно обработать разные форматы ответа
          let errorDetails = '';
          
          if (typeof error.response.data === 'string') {
            // Если данные - это строка, попробуем распарсить JSON, если он там есть
            if (error.response.data.includes('{') && error.response.data.includes('}')) {
              try {
                const jsonMatch = error.response.data.match(/\{.*\}/s);
                if (jsonMatch) {
                  const parsedJson = JSON.parse(jsonMatch[0]);
                  errorDetails = JSON.stringify(parsedJson);
                } else {
                  // Если не смогли найти JSON, используем часть текста
                  errorDetails = error.response.data.substring(0, 300);
                }
              } catch (e) {
                // Если не смогли распарсить, используем текст как есть
                errorDetails = error.response.data.substring(0, 300);
              }
            } else {
              // Простой текст
              errorDetails = error.response.data.substring(0, 300);
            }
          } else {
            // Объект, преобразуем в строку
            errorDetails = JSON.stringify(error.response.data).substring(0, 300);
          }
          
          errorMessage += ` (Статус: ${error.response.status}) Ответ API: ${errorDetails}`;
        } catch (e) {
          errorMessage += ` (Статус: ${error.response.status})`;
        }
      }
      
      // Важно: устанавливаем заголовок Content-Type явно, чтобы предотвратить автоматическое определение
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });
};