import axios from 'axios';
import { apiKeyService } from './api-keys';

// Интерфейс для запроса к Claude API
interface ClaudeRequest {
  model: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

/**
 * Сервис для работы с Claude AI API
 */
export class ClaudeService {
  private readonly CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  private readonly DEFAULT_MODEL = 'claude-3-sonnet-20240229';
  
  /**
   * Улучшает текст с помощью Claude AI
   * 
   * @param text - Текст для улучшения
   * @param prompt - Инструкции для улучшения
   * @returns Улучшенный текст
   */
  async improveText(text: string, prompt: string, userId?: string): Promise<string> {
    // Получаем API ключ для Claude
    const apiKey = userId 
      ? await apiKeyService.getApiKey(userId, 'claude')
      : null;
    
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY not found');
    }
    
    const systemPrompt = `Ты - профессиональный редактор текста для социальных сетей. 
Твоя задача - улучшить предоставленный текст, сохраняя его основную суть и стиль. 
Не добавляй новой информации, не меняй смысловые акценты.
Сохраняй все HTML-теги, которые могут быть в тексте.
Работай только с текстом, который предоставил пользователь.`;
    
    const userPrompt = `${prompt}\n\nВот текст, который нужно улучшить:\n\n${text}\n\nПожалуйста, верни только улучшенный текст, без объяснений, вступлений или дополнительных комментариев.`;
    
    const request: ClaudeRequest = {
      model: this.DEFAULT_MODEL,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt
    };
    
    try {
      const response = await axios.post(this.CLAUDE_API_URL, request, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      
      // Извлекаем улучшенный текст из ответа
      return response.data.content[0].text;
    } catch (error: any) {
      console.error('Error improving text with Claude:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в других модулях
export const claudeService = new ClaudeService();