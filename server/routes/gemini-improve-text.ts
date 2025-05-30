import express, { Request, Response } from 'express';
import * as geminiService from '../services/gemini-proxy';
import { logger } from '../utils/logger';

export const geminiImproveRouter = express.Router();

/**
 * Улучшает текст с сохранением HTML-форматирования
 * POST /api/gemini/improve-text
 */
geminiImproveRouter.post('/improve-text', async (req: Request, res: Response) => {
  try {
    const { text, prompt, model = 'gemini-1.5-flash' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Текст обязателен' });
    }
    
    logger.log(`[improve-text] Исходный текст: "${text}"`);
    
    // Проверяем наличие HTML
    const hasHtml = text.includes('<') && text.includes('>');
    logger.log(`[improve-text] Содержит HTML: ${hasHtml}`);
    
    // Создаем промпт для AI
    const aiPrompt = hasHtml 
      ? `Исправь только грамматические и стилистические ошибки в тексте. ОБЯЗАТЕЛЬНО сохрани все HTML теги в том же виде. Не добавляй markdown. Верни только исправленный текст: ${text}`
      : `Исправь грамматические ошибки в тексте. Не добавляй markdown или HTML. Верни только исправленный текст: ${text}`;
    
    logger.log(`[improve-text] Отправляем в AI`);
    
    // Получаем результат от AI
    const aiResult = await geminiService.generateText(aiPrompt, model);
    logger.log(`[improve-text] AI вернул: "${aiResult}"`);
    
    // Если исходный текст был с HTML, восстанавливаем структуру
    if (hasHtml) {
      logger.log(`[improve-text] ВОССТАНАВЛИВАЕМ HTML`);
      
      // Убираем возможные markdown символы
      let cleanText = aiResult
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#+\s+/gm, '')
        .trim();
      
      // Считаем параграфы в оригинале
      const originalPCount = (text.match(/<p[^>]*>/g) || []).length;
      logger.log(`[improve-text] Параграфов в оригинале: ${originalPCount}`);
      
      let resultHtml;
      if (originalPCount === 1) {
        // Один параграф
        resultHtml = `<p>${cleanText}</p>`;
      } else if (originalPCount > 1) {
        // Несколько параграфов - разбиваем по предложениям
        const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        const sentencesPerP = Math.max(1, Math.ceil(sentences.length / originalPCount));
        const paragraphs = [];
        
        for (let i = 0; i < sentences.length; i += sentencesPerP) {
          const pSentences = sentences.slice(i, i + sentencesPerP);
          paragraphs.push(`<p>${pSentences.join(' ').trim()}</p>`);
        }
        resultHtml = paragraphs.join('');
      } else {
        // Нет параграфов, создаем один
        resultHtml = `<p>${cleanText}</p>`;
      }
      
      logger.log(`[improve-text] Финальный HTML: "${resultHtml}"`);
      
      res.json({ 
        success: true, 
        text: resultHtml 
      });
    } else {
      // Без HTML - просто возвращаем очищенный текст
      const cleanText = aiResult
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#+\s+/gm, '')
        .trim();
      
      logger.log(`[improve-text] Возвращаем обычный текст: "${cleanText}"`);
      
      res.json({ 
        success: true, 
        text: cleanText 
      });
    }
    
  } catch (error) {
    logger.error('[improve-text] Ошибка:', error);
    res.status(500).json({ 
      error: 'Ошибка при улучшении текста',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});