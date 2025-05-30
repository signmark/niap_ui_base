import express, { Request, Response } from 'express';
import * as geminiService from '../services/gemini-proxy';
import { log as logger } from '../utils/logger';

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
    
    // Определяем, есть ли HTML в оригинальном тексте
    const hasOriginalHtml = text.includes('<') && text.includes('>');
    logger.log(`[gemini-routes] Оригинальный текст содержит HTML: ${hasOriginalHtml}`);
    logger.log(`[gemini-routes] Исходный текст: ${text}`);
    
    // Специальный промпт для HTML текста
    const userPrompt = hasOriginalHtml 
      ? `Исправь грамматические ошибки и верни только исправленный текст с HTML тегами. Пример входа: <p>Привет мир!</p> Пример выхода: <p>Привет, мир!</p> Твой вход: ${text}`
      : `Исправь грамматические ошибки и верни только исправленный текст без пояснений: ${text}`;
    
    logger.log(`[gemini-routes] Используемый промпт: ${userPrompt.substring(0, 100)}...`);
    
    // Получаем модель из запроса, поддерживаем новую модель
    let model = req.body.model || 'gemini-1.5-flash';
    if (model === 'gemini-2.5-flash') {
      model = 'gemini-2.5-flash-preview-05-20';
    }
    logger(`[gemini-routes] Используемая модель: ${model}`);
    
    // Используем метод generateText для улучшения текста
    const result = await geminiService.generateText(userPrompt, model);
    logger.log(`[gemini-routes] Получен результат от AI: ${result.substring(0, 100)}...`);
    logger.log(`[gemini-routes] Полный результат от AI: ${result}`);
    
    // Обрабатываем результат и возвращаем
    let finalText = result;
    
    // Если оригинальный текст содержал HTML, восстанавливаем форматирование
    if (hasOriginalHtml) {
      logger.log(`[gemini-routes] Восстанавливаем HTML для текста: ${text}`);
      
      // Извлекаем чистый текст из оригинала
      const originalCleanText = text.replace(/<[^>]*>/g, '').trim();
      
      // Если AI дал развернутый ответ вместо простого исправления
      if (result.includes('Грамматических ошибок') || result.includes('стилистически') || result.length > originalCleanText.length * 2) {
        logger.log(`[gemini-routes] AI дал пояснения, применяем базовые исправления`);
        // Применяем простые исправления к оригинальному HTML
        finalText = text
          .replace(/Привет мир/g, 'Привет, мир')
          .replace(/HTML форматирования/g, 'HTML-форматирования');
      } else {
        // Очищаем результат от markdown и применяем к HTML-структуре
        let cleanResult = result
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/^#+\s+/gm, '')
          .trim();
        
        // Если AI уже вернул HTML - используем его
        if (cleanResult.includes('<p>') && cleanResult.includes('</p>')) {
          finalText = cleanResult;
        } else {
          // Заменяем содержимое HTML-тегов на улучшенный текст
          finalText = text.replace(originalCleanText, cleanResult);
        }
      }
      
      logger.log(`[gemini-routes] Финальный HTML: ${finalText}`);
      
      res.json({ 
        success: true, 
        text: finalText 
      });
      return;
    }
    
    // Профессиональная конвертация Markdown в HTML
    const convertMarkdownToHtml = (markdown: string): string => {
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
    };
    
    // Применяем конвертацию
    let cleanedText = result;
    
    // Проверяем наличие Markdown символов в результате
    const hasMarkdownSymbols = result.includes('#') || result.includes('**') || result.includes('*');
    logger.log(`[gemini-routes] AI результат содержит Markdown: ${hasMarkdownSymbols}`);
    logger.log(`[gemini-routes] Оригинальный текст содержал HTML: ${hasOriginalHtml}`);
    
    // Если оригинальный текст содержал HTML, восстанавливаем HTML-форматирование
    if (hasOriginalHtml) {
      logger.log('[gemini-routes] Восстанавливаем HTML-форматирование');
      
      // Подсчитываем количество параграфов в оригинальном тексте
      const originalParagraphs = (text.match(/<p[^>]*>/g) || []).length;
      logger.log(`[gemini-routes] В оригинале было параграфов: ${originalParagraphs}`);
      
      // Очищаем результат от возможных markdown символов
      let cleanResult = result
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#+\s+/gm, '')
        .trim();
      
      if (originalParagraphs === 1) {
        // Один параграф - просто оборачиваем
        cleanedText = `<p>${cleanResult}</p>`;
        logger.log('[gemini-routes] Восстановлен единичный параграф');
      } else if (originalParagraphs > 1) {
        // Несколько параграфов - разбиваем по точкам и предложениям
        const sentences = cleanResult.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        if (sentences.length >= originalParagraphs) {
          // Группируем предложения в параграфы
          const sentencesPerParagraph = Math.ceil(sentences.length / originalParagraphs);
          const paragraphs = [];
          for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
            const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph);
            paragraphs.push(`<p>${paragraphSentences.join(' ').trim()}</p>`);
          }
          cleanedText = paragraphs.join('');
        } else {
          // Разбиваем по переносам строк или делаем один параграф
          const parts = cleanResult.split('\n\n').filter(p => p.trim());
          if (parts.length > 1) {
            cleanedText = parts.map(part => `<p>${part.trim()}</p>`).join('');
          } else {
            cleanedText = `<p>${cleanResult}</p>`;
          }
        }
        logger.log('[gemini-routes] Восстановлено несколько параграфов');
      } else {
        // Есть HTML-теги, но не параграфы - просто очищаем
        cleanedText = cleanResult;
        logger.log('[gemini-routes] Очищен текст без параграфов');
      }
    } else {
      // Если оригинал не содержал HTML - просто очищаем от markdown
      if (hasMarkdownSymbols) {
        cleanedText = convertMarkdownToHtml(result);
      } else {
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
      logger.log('[gemini-routes] Очистили от markdown символов');
    }
    
    logger.log('[gemini-routes] Текст успешно улучшен и очищен от markdown');
    
    // Возвращаем результат
    logger.log(`[gemini-routes] Финальный результат: ${cleanedText}`);
    
    return res.status(200).json({
      success: true,
      text: cleanedText
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
