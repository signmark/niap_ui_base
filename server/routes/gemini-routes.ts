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
    
    // Профессиональная конвертация Markdown в HTML
    function convertMarkdownToHtml(markdown: string): string {
      let html = markdown;
      
      // Сначала обрабатываем блочные элементы
      // Заголовки (должны быть в начале строки)
      html = html.replace(/^### (.+)$/gm, '<h3><strong>$1</strong></h3>');
      html = html.replace(/^## (.+)$/gm, '<h2><strong>$1</strong></h2>');
      html = html.replace(/^# (.+)$/gm, '<h1><strong>$1</strong></h1>');
      
      // Затем обрабатываем инлайн-элементы
      // Жирный текст (сохраняем как <strong>)
      html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
      
      // Курсив (сохраняем как <em>)
      html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
      html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
      
      // Удаляем остатки кода
      html = html.replace(/```[\s\S]*?```/g, '');
      html = html.replace(/`([^`]+)`/g, '$1');
      
      // Убираем ссылки markdown, оставляем только текст
      html = html.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      
      // Обрабатываем списки - убираем маркеры
      html = html.replace(/^\s*[-*+]\s+/gm, '');
      html = html.replace(/^\s*\d+\.\s+/gm, '');
      
      // Убираем цитаты
      html = html.replace(/^\s*>\s+/gm, '');
      
      // Убираем горизонтальные линии
      html = html.replace(/^[-=*]{3,}$/gm, '');
      
      // Разбиваем на параграфы
      const paragraphs = html.split(/\n\s*\n/);
      const processedParagraphs = paragraphs.map(para => {
        const trimmed = para.trim();
        if (!trimmed) return '';
        
        // Если уже есть HTML-теги, не оборачиваем в <p>
        if (trimmed.match(/^<(h[1-6]|div|blockquote|ul|ol|li)/)) {
          return trimmed;
        }
        
        // Оборачиваем в параграф
        return `<p>${trimmed}</p>`;
      });
      
      return processedParagraphs.filter(p => p.trim()).join('');
    }
    
    // Применяем конвертацию
    let cleanedText = result;
    
    // Если исходный текст был HTML, а результат содержит Markdown
    if (text.includes('<') && (result.includes('#') || result.includes('**') || result.includes('*'))) {
      logger.log('[gemini-routes] Конвертируем Markdown обратно в HTML');
      cleanedText = convertMarkdownToHtml(result);
    } else {
      // Просто очищаем от markdown символов
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
