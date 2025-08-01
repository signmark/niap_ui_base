import { Express, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';

/**
 * Регистрация маршрутов для работы с ключевыми словами
 */
export function registerKeywordRoutes(app: Express) {
  console.log('[Keywords] Регистрация маршрутов для ключевых слов...');

  // Получение ключевых слов кампании
  app.get("/api/keywords/:campaignId", authenticateUser, async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      
      if (!campaignId) {
        return res.status(400).json({ 
          error: "Отсутствует ID кампании" 
        });
      }
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          error: "Отсутствует токен авторизации" 
        });
      }
      
      console.log(`[Keywords] Загрузка ключевых слов для кампании: ${campaignId}`);
      
      // Запрос к Directus для получения ключевых слов кампании
      const response = await fetch(`${process.env.DIRECTUS_URL}/items/campaign_keywords?filter[campaign_id][_eq]=${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`[Keywords] Ошибка при загрузке ключевых слов: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ 
          error: `Ошибка при загрузке ключевых слов: ${response.status}` 
        });
      }
      
      const data = await response.json();
      console.log(`[Keywords] Загружено ${data.data?.length || 0} ключевых слов для кампании ${campaignId}`);
      
      return res.json(data.data || []);
      
    } catch (error: any) {
      console.error("[Keywords] Ошибка при загрузке ключевых слов кампании:", error);
      return res.status(500).json({ 
        error: "Внутренняя ошибка сервера", 
        details: error.message 
      });
    }
  });

  // Поиск ключевых слов с помощью AI
  app.post("/api/keywords/search", authenticateUser, async (req: Request, res: Response) => {
    try {
      const { keyword } = req.body;
      
      if (!keyword || keyword.trim() === '') {
        return res.status(400).json({ 
          error: "Отсутствует ключевое слово для поиска" 
        });
      }
      
      console.log(`[Keywords] Поиск ключевых слов для: ${keyword}`);
      
      // Получаем Gemini ключ из переменных окружения
      const geminiApiKey = process.env.GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        return res.status(400).json({
          key_missing: true,
          service: "Gemini",
          error: "Gemini API ключ не найден в переменных окружения."
        });
      }
      
      // Импортируем GeminiService динамически
      const { GeminiService } = await import('../services/gemini');
      
      // Формируем промт для генерации связанных ключевых слов
      const prompt = `Сгенерируй список из 10-15 связанных ключевых слов и фраз для основного ключевого слова "${keyword}". 

Включи:
- Синонимы и похожие термины
- Длинные фразы (long-tail keywords)
- Связанные темы и понятия
- Популярные поисковые запросы

Каждое ключевое слово должно быть релевантным для маркетинга и SEO.

Верни результат в формате JSON массива объектов:
[
  {"keyword": "ключевое слово", "frequency": 85000, "competition": 60},
  {"keyword": "другое ключевое слово", "frequency": 75000, "competition": 45}
]

Где frequency (число) - примерная частота поиска в месяц, competition (1-100) - уровень конкуренции.`;

      // Используем Gemini для генерации ключевых слов
      const geminiService = new GeminiService({ apiKey: geminiApiKey });
      const geminiResponse = await geminiService.generateText(prompt, 'gemini-2.5-flash');

      if (!geminiResponse) {
        // Fallback ключевые слова
        const fallbackKeywords = [
          { keyword: keyword, frequency: 80000, competition: 65 },
          { keyword: `${keyword} купить`, frequency: 85000, competition: 70 },
          { keyword: `${keyword} цена`, frequency: 82000, competition: 75 },
          { keyword: `${keyword} отзывы`, frequency: 78000, competition: 60 },
          { keyword: `${keyword} магазин`, frequency: 75000, competition: 68 }
        ];
        
        return res.json({
          data: {
            keywords: fallbackKeywords
          },
          source: "fallback",
          message: "Использованы fallback ключевые слова"
        });
      }

      try {
        // Парсим ответ от Gemini
        const cleanResponse = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let keywords = JSON.parse(cleanResponse);
        
        // Валидация структуры
        if (!Array.isArray(keywords)) {
          throw new Error('Ответ не является массивом');
        }
        
        // Фильтруем и нормализуем ключевые слова
        keywords = keywords
          .filter((k: any) => k.keyword && typeof k.frequency === 'number' && typeof k.competition === 'number')
          .slice(0, 15);
        
        if (keywords.length === 0) {
          throw new Error('Нет валидных ключевых слов в ответе');
        }
        
        return res.json({
          data: {
            keywords: keywords
          },
          source: "gemini_2.5_flash",
          message: "Ключевые слова сгенерированы через Gemini 2.5 Flash"
        });
        
      } catch (parseError) {
        console.log('[Keywords] Ошибка парсинга ответа Gemini:', parseError);
        
        // Fallback ключевые слова
        const fallbackKeywords = [
          { keyword: keyword, frequency: 80000, competition: 65 },
          { keyword: `${keyword} купить`, frequency: 85000, competition: 70 },
          { keyword: `${keyword} цена`, frequency: 82000, competition: 75 },
          { keyword: `${keyword} отзывы`, frequency: 78000, competition: 60 },
          { keyword: `${keyword} магазин`, frequency: 75000, competition: 68 },
          { keyword: `${keyword} доставка`, frequency: 72000, competition: 55 },
          { keyword: `${keyword} качество`, frequency: 70000, competition: 50 },
          { keyword: `лучший ${keyword}`, frequency: 76000, competition: 62 },
          { keyword: `${keyword} недорого`, frequency: 74000, competition: 58 },
          { keyword: `${keyword} онлайн`, frequency: 73000, competition: 52 }
        ];
        
        return res.json({
          data: {
            keywords: fallbackKeywords
          },
          source: "fallback",
          message: "Использованы fallback ключевые слова из-за ошибки парсинга"
        });
      }
      
    } catch (error: any) {
      console.error("[Keywords] Ошибка при поиске ключевых слов:", error);
      
      // Fallback в случае полной ошибки
      const { keyword } = req.body;
      const fallbackKeywords = [
        { keyword: keyword, frequency: 80000, competition: 65 },
        { keyword: `${keyword} маркетинг`, frequency: 75000, competition: 55 },
        { keyword: `${keyword} SEO`, frequency: 70000, competition: 60 },
        { keyword: `${keyword} оптимизация`, frequency: 68000, competition: 50 },
        { keyword: `${keyword} продвижение`, frequency: 72000, competition: 58 }
      ];
      
      return res.json({
        data: {
          keywords: fallbackKeywords
        },
        fallback: true,
        error_message: "Использованы базовые ключевые слова из-за проблем с API"
      });
    }
  });

  console.log('[Keywords] Маршруты для ключевых слов зарегистрированы');
}