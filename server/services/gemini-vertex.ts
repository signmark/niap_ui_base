import { log } from '../utils/logger.js';

/**
 * Сервис для работы с моделями Gemini 2.5
 * Использует доступные модели через Generative Language API
 */
export class GeminiVertexService {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || null;
  }

  /**
   * Получает API ключ Google
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }
    
    try {
      const { GlobalApiKeyManager } = await import('./global-api-key-manager.js');
      const globalManager = new GlobalApiKeyManager();
      const globalKey = await globalManager.getApiKey('gemini');
      
      if (globalKey) {
        this.apiKey = globalKey;
        return globalKey;
      }
    } catch (error) {
      log(`[gemini-vertex] Ошибка получения API ключа: ${error}`, 'error');
    }
    
    throw new Error('Google API ключ не настроен');
  }

  /**
   * Проверяет, является ли модель Gemini 2.5
   */
  private isGemini25Model(model: string): boolean {
    return model.includes('2.5') || model.includes('2-5');
  }

  /**
   * Улучшает текст с помощью Gemini
   */
  async improveText(params: { text: string; prompt: string; model?: string }): Promise<string> {
    try {
      const { text, prompt, model = 'gemini-2.5-flash-preview-0520' } = params;
      
      // Получаем API ключ
      const apiKey = await this.getApiKey();
      
      // Мапим модель на доступную
      const availableModel = this.mapToAvailableModel(model);
      
      log(`[gemini-vertex] Улучшение текста: ${model} -> ${availableModel}`, 'info');
      
      // Формируем URL для Generative Language API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${availableModel}:generateContent?key=${apiKey}`;
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\nТекст для улучшения:\n${text}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192
        }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      
      if (responseData.candidates && responseData.candidates.length > 0 && 
          responseData.candidates[0].content && 
          responseData.candidates[0].content.parts && 
          responseData.candidates[0].content.parts.length > 0) {
        
        let resultText = responseData.candidates[0].content.parts[0].text || '';
        
        // Очищаем текст от артефактов
        resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
        resultText = resultText.replace(/```[\s\S]*?```/g, '');
        resultText = resultText.trim();
        
        log(`[gemini-vertex] Текст успешно улучшен`, 'info');
        return resultText;
      } else {
        throw new Error('Некорректный формат ответа от API');
      }
      
    } catch (error) {
      log(`[gemini-vertex] Ошибка при улучшении текста: ${(error as Error).message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Генерирует текст с помощью Gemini
   */
  async generateText(params: { prompt: string; model?: string }): Promise<string> {
    try {
      const { prompt, model = 'gemini-2.5-flash-preview-0520' } = params;
      
      // Получаем API ключ
      const apiKey = await this.getApiKey();
      
      // Мапим модель на доступную
      const availableModel = this.mapToAvailableModel(model);
      
      log(`[gemini-vertex] Генерация текста: ${model} -> ${availableModel}`, 'info');
      
      // Формируем URL для Generative Language API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${availableModel}:generateContent?key=${apiKey}`;
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192
        }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      
      if (responseData.candidates && responseData.candidates.length > 0 && 
          responseData.candidates[0].content && 
          responseData.candidates[0].content.parts && 
          responseData.candidates[0].content.parts.length > 0) {
        
        let resultText = responseData.candidates[0].content.parts[0].text || '';
        resultText = resultText.trim();
        
        log(`[gemini-vertex] Текст успешно сгенерирован`, 'info');
        return resultText;
      } else {
        throw new Error('Некорректный формат ответа от API');
      }
      
    } catch (error) {
      log(`[gemini-vertex] Ошибка при генерации текста: ${(error as Error).message}`, 'error');
      throw error;
    }
  }
}

export const geminiVertexService = new GeminiVertexService();