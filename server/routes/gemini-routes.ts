import express from 'express';
import { geminiService } from '../services/gemini';
import * as logger from '../utils/logger';

export const geminiRouter = express.Router();

/**
 * Тестирует доступность API Gemini
 * GET /api/gemini/test
 */
geminiRouter.get('/test', async (req, res) => {
  try {
    logger.log('[gemini-routes] Проверка работы Gemini API...');
    
    // Проверяем доступность API ключа
    const isKeyValid = await geminiService.testApiKey();
    
    if (isKeyValid) {
      logger.log('[gemini-routes] Проверка успешна. API ключ и соединение работают');
      return res.status(200).json({ 
        success: true, 
        message: 'Gemini API успешно подключен через SOCKS5 прокси' 
      });
    } else {
      logger.error('[gemini-routes] Проверка неудачна. API ключ недействителен');
      return res.status(400).json({ 
        success: false, 
        error: 'Недействительный API ключ Gemini или проблема соединения с сервисом' 
      });
    }
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при тестировании Gemini API:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Ошибка при тестировании Gemini API: ${(error as Error).message}` 
    });
  }
});

/**
 * Улучшает текст с помощью Gemini API
 * POST /api/gemini/improve-text
 * Body: { text: string, prompt?: string }
 */
geminiRouter.post('/improve-text', async (req, res) => {
  try {
    logger.log('[gemini-routes] Обработка запроса на улучшение текста...');
    
    const { text, prompt } = req.body;
    
    if (!text) {
      logger.log('[gemini-routes] Отсутствует текст в запросе');
      return res.status(400).json({ 
        success: false, 
        error: 'Текст отсутствует в запросе' 
      });
    }
    
    // Используем предоставленные инструкции или дефолтные, если не указаны
    const defaultInstructions = 'Улучши грамматику и стилистику этого текста, сохранив его ТОЧНО в том же формате. Исправь только ошибки, не меняй структуру и форматирование.';
    const instructions = prompt || defaultInstructions;
    
    logger.log(`[gemini-routes] Обработка текста: ${text.substring(0, 50)}...`);
    
    // Извлекаем структуру HTML и текст отдельно
    function extractHtmlStructure(htmlText: string) {
      const sections: Array<{type: 'tag' | 'text', content: string, tag?: string}> = [];
      let currentPos = 0;
      
      // Находим все HTML-теги
      const tagRegex = /<\/?[^>]+>/g;
      let match;
      
      while ((match = tagRegex.exec(htmlText)) !== null) {
        // Добавляем текст перед тегом
        if (match.index > currentPos) {
          const textContent = htmlText.slice(currentPos, match.index);
          if (textContent.trim()) {
            sections.push({type: 'text', content: textContent});
          }
        }
        
        // Добавляем тег
        sections.push({type: 'tag', content: match[0], tag: match[0]});
        currentPos = match.index + match[0].length;
      }
      
      // Добавляем оставшийся текст
      if (currentPos < htmlText.length) {
        const textContent = htmlText.slice(currentPos);
        if (textContent.trim()) {
          sections.push({type: 'text', content: textContent});
        }
      }
      
      return sections;
    }
    
    // Если это HTML-текст, обрабатываем структурированно
    if (text.includes('<') && text.includes('>')) {
      logger.log('[gemini-routes] Обнаружен HTML-текст, используем структурированный подход');
      
      const sections = extractHtmlStructure(text);
      let improvedSections: typeof sections = [];
      
      for (const section of sections) {
        if (section.type === 'text' && section.content.trim()) {
          // Улучшаем только текстовые части
          const simplePrompt = `Исправь только грамматические ошибки в тексте. НЕ добавляй markdown, НЕ меняй смысл: "${section.content}"`;
          try {
            const improvedText = await geminiService.generateText(simplePrompt, 'gemini-1.5-flash');
            improvedSections.push({...section, content: improvedText.replace(/[#*`_]/g, '').trim()});
          } catch (error) {
            // Если ошибка, оставляем оригинальный текст
            improvedSections.push(section);
          }
        } else {
          // HTML-теги оставляем без изменений
          improvedSections.push(section);
        }
      }
      
      // Собираем результат
      const result = improvedSections.map(s => s.content).join('');
      logger.log('[gemini-routes] HTML-структура сохранена, текст улучшен');
      
      return res.json({
        success: true,
        text: result
      });
    }
    
    // Для обычного текста используем стандартный подход
    const userPrompt = `Исправь только грамматические ошибки. НЕ добавляй markdown. НЕ меняй смысл: ${text}`;
    
    // Используем метод generateText для улучшения текста
    const result = await geminiService.generateText(userPrompt, 'gemini-1.5-flash');
    
    // Конвертируем Markdown обратно в HTML, если AI вернул Markdown
    let cleanedText = result;
    
    // Если текст содержит исходные HTML-теги, попробуем их восстановить
    if (text.includes('<') && !result.includes('<')) {
      // AI конвертировал HTML в Markdown, восстанавливаем HTML-структуру
      cleanedText = result
        // Конвертируем Markdown заголовки в HTML
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Конвертируем жирный текст
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Конвертируем курсив
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Разбиваем на параграфы
        .split('\n\n')
        .map(paragraph => {
          if (paragraph.trim() && !paragraph.includes('<h') && !paragraph.includes('<p>')) {
            return `<p>${paragraph.trim()}</p>`;
          }
          return paragraph;
        })
        .join('\n\n')
        .trim();
    } else {
      // Просто удаляем лишнюю Markdown-разметку
      cleanedText = result
        .replace(/^#+\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/^\s*>\s+/gm, '')
        .replace(/^[-=*]{3,}$/gm, '')
        .trim();
    }
    
    logger.log('[gemini-routes] Текст успешно улучшен и очищен от markdown');
    
    // Возвращаем результат
    return res.status(200).json({
      success: true,
      originalText: text,
      improvedText: cleanedText
    });
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при улучшении текста:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка при улучшении текста: ${(error as Error).message}`
    });
  }
});

/**
 * Генерирует текст с помощью Gemini API
 * POST /api/gemini/generate-text
 * Body: { prompt: string, model?: string }
 */
geminiRouter.post('/generate-text', async (req, res) => {
  try {
    const { prompt, model = 'gemini-1.5-flash' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует запрос для генерации текста'
      });
    }
    
    logger.log(`[gemini-routes] Генерация текста с моделью ${model}`);
    
    const generatedText = await geminiService.generateText(prompt, model);
    
    return res.status(200).json({
      success: true,
      generatedText,
      model
    });
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при генерации текста:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка при генерации текста: ${(error as Error).message}`
    });
  }
});
