import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as logger from './utils/logger';
import { GlobalApiKeysService } from './services/global-api-keys';

const router = Router();

/**
 * Сервис для работы с Qwen API
 */
class QwenService {
  private apiKey: string;
  private baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }

  async improveText({ text, prompt, model = 'qwen-max' }: { text: string; prompt: string; model?: string }): Promise<string> {
    try {
      // Используем международный совместимый с OpenAI API endpoint
      const compatibleURL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      const response = await axios.post(compatibleURL, {
        model: model,
        messages: [
          {
            role: 'user',
            content: `Задача: улучшить предоставленный текст в соответствии с инструкциями.\nИнструкции: ${prompt}\n\nИсходный текст:\n"""\n${text}\n"""\n\nУлучшенный текст:`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        top_p: 0.9,
        stop: null
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }

      throw new Error('Qwen API returned empty response');
    } catch (error: any) {
      console.log('Qwen API Full Error:', error);
      console.log('Qwen API Response status:', error.response?.status);
      console.log('Qwen API Response data:', error.response?.data);
      logger.error('Error calling Qwen API:', error);
      logger.error('Qwen API Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw new Error(`Ошибка при обращении к Qwen API: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

/**
 * Получает API ключ Qwen из глобального хранилища
 */
async function getQwenApiKey(req: Request): Promise<string | null> {
  try {
    logger.log('[qwen-routes] Getting Qwen API key from Global API Keys collection', 'qwen');
    
    const globalApiKeysService = new GlobalApiKeysService();
    const apiKey = await globalApiKeysService.getGlobalApiKey('qwen' as any);
    
    if (apiKey) {
      logger.log(`[qwen-routes] Successfully retrieved Qwen API key from Global API Keys (length: ${apiKey.length})`, 'qwen');
      logger.log(`[qwen-routes] Qwen API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`, 'qwen');
      return apiKey;
    } else {
      logger.log('[qwen-routes] Qwen API key not found in Global API Keys collection', 'qwen');
    }
    
    return apiKey;
  } catch (error) {
    logger.error('[qwen-routes] Error getting Qwen API key:', error);
    return null;
  }
}

/**
 * Создает экземпляр сервиса Qwen для пользователя
 */
async function getQwenService(req: Request): Promise<QwenService | null> {
  const apiKey = await getQwenApiKey(req);
  
  if (!apiKey) {
    return null;
  }
  
  return new QwenService({ apiKey });
}

/**
 * Маршрут для улучшения текста с помощью Qwen
 */
router.post('/api/qwen/improve-text', async (req: Request, res: Response) => {
  try {
    const { text, prompt, model } = req.body;
    const userId = req.userId;
    
    logger.log(`[qwen-routes] Received improve-text request from user ${userId}`, 'qwen');
    logger.log(`[qwen-routes] Request data: text length=${text?.length}, prompt length=${prompt?.length}, model=${model}`, 'qwen');
    
    if (!text || !prompt) {
      logger.error('[qwen-routes] Missing text or prompt in improve-text request', 'qwen');
      return res.status(400).json({
        success: false,
        error: 'Текст и инструкции обязательны'
      });
    }
    
    logger.log(`[qwen-routes] Getting Qwen service for user ${userId}`, 'qwen');
    const qwenService = await getQwenService(req);
    
    if (!qwenService) {
      logger.error(`[qwen-routes] Qwen API key not configured for user ${userId}`, 'qwen');
      return res.status(400).json({
        success: false,
        error: 'API ключ Qwen не настроен',
        needApiKey: true
      });
    }
    
    logger.log(`[qwen-routes] Qwen service initialized successfully`, 'qwen');
    logger.log(`[qwen-routes] Calling improveText with model ${model || 'default'}`, 'qwen');
    
    const improvedText = await qwenService.improveText({ text, prompt, model });
    
    logger.log(`[qwen-routes] Qwen response: ${improvedText.substring(0, 100)}...`, 'qwen');
    
    // Очищаем текст от лишних переносов строк и markdown
    let finalText = improvedText
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
      .replace(/\n\s*\n+/g, '\n')
      .trim();
    
    logger.log('[qwen-routes] Text improved successfully, returning response', 'qwen');
    return res.json({
      success: true,
      text: finalText
    });
  } catch (error) {
    logger.error('[qwen-routes] Error improving text with Qwen:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при улучшении текста'
    });
  }
});

/**
 * Регистрация маршрутов Qwen в Express приложении
 */
export function registerQwenRoutes(app: any) {
  app.use('/', router);
  console.log('Qwen routes registered');
}

export default router;