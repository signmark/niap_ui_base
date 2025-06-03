import { vertexAIAuth } from './vertex-ai-auth.js';
import { log } from '../utils/logger.js';

/**
 * Сервис для работы с Gemini 2.5 через Vertex AI
 */
export class GeminiVertexService {
  /**
   * Улучшает текст с помощью Gemini 2.5 через Vertex AI
   */
  async improveText(params: { text: string; prompt: string; model?: string }): Promise<string> {
    try {
      const { text, prompt, model = 'gemini-2.5-flash' } = params;
      
      log(`[gemini-vertex] Improving text with Vertex AI model: ${model}`, 'gemini');
      
      // Получаем Access Token для Vertex AI
      const accessToken = await vertexAIAuth.getAccessToken();
      if (!accessToken) {
        throw new Error('Не удалось получить Access Token для Vertex AI');
      }
      
      // Формируем URL для Vertex AI
      const url = vertexAIAuth.getVertexAIUrl(model);
      log(`[gemini-vertex] Vertex AI URL: ${url}`, 'gemini');
      
      // Формируем запрос для Vertex AI
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\n${text}`
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
      
      // Отправляем запрос к Vertex AI
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      log(`[gemini-vertex] Получен ответ со статусом: ${response.status}`, 'gemini');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      
      // Обрабатываем ответ
      if (responseData.candidates && responseData.candidates.length > 0 && 
          responseData.candidates[0].content && 
          responseData.candidates[0].content.parts && 
          responseData.candidates[0].content.parts.length > 0) {
        
        let resultText = responseData.candidates[0].content.parts[0].text || '';
        
        // Очищаем текст от артефактов
        resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
        resultText = resultText.replace(/```[\s\S]*?```/g, '');
        resultText = resultText.trim();
        
        log(`[gemini-vertex] Текст успешно улучшен через Vertex AI`, 'gemini');
        return resultText;
      } else {
        throw new Error('Некорректный формат ответа от Vertex AI');
      }
      
    } catch (error) {
      log(`[gemini-vertex] Ошибка при улучшении текста через Vertex AI: ${(error as Error).message}`, 'gemini');
      throw error;
    }
  }
  
  /**
   * Генерирует текст с помощью Gemini 2.5 через Vertex AI
   */
  async generateText(params: { prompt: string; model?: string }): Promise<string> {
    try {
      const { prompt, model = 'gemini-2.5-flash' } = params;
      
      log(`[gemini-vertex] Generating text with Vertex AI model: ${model}`, 'gemini');
      
      // Получаем Access Token для Vertex AI
      const accessToken = await vertexAIAuth.getAccessToken();
      if (!accessToken) {
        throw new Error('Не удалось получить Access Token для Vertex AI');
      }
      
      // Формируем URL для Vertex AI
      const url = vertexAIAuth.getVertexAIUrl(model);
      
      // Формируем запрос для Vertex AI
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
      
      // Отправляем запрос к Vertex AI
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      
      // Обрабатываем ответ
      if (responseData.candidates && responseData.candidates.length > 0 && 
          responseData.candidates[0].content && 
          responseData.candidates[0].content.parts && 
          responseData.candidates[0].content.parts.length > 0) {
        
        let resultText = responseData.candidates[0].content.parts[0].text || '';
        resultText = resultText.trim();
        
        log(`[gemini-vertex] Текст успешно сгенерирован через Vertex AI`, 'gemini');
        return resultText;
      } else {
        throw new Error('Некорректный формат ответа от Vertex AI');
      }
      
    } catch (error) {
      log(`[gemini-vertex] Ошибка при генерации текста через Vertex AI: ${(error as Error).message}`, 'gemini');
      throw error;
    }
  }
}

export const geminiVertexService = new GeminiVertexService();