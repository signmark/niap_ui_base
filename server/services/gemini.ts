import { geminiProxyService } from './gemini-proxy';
import * as logger from '../utils/logger';

/**
 * Сервис для работы с Google Gemini API
 * Этот файл является обёрткой для использования GeminiProxyService
 * и обеспечения обратной совместимости с существующим кодом
 */
export class GeminiService {
  private apiKey: string;
  
  /**
   * Конструктор сервиса Gemini
   * @param apiKey API ключ Gemini
   */
  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }
  
  /**
   * Проверяет валидность API ключа Gemini
   * @returns true если ключ валидный, false если нет
   */
  async testApiKey(): Promise<boolean> {
    try {
      logger.log('[gemini-service] Проверка API ключа через прокси-сервис');
      return await geminiProxyService.testApiKey();
    } catch (error) {
      logger.error('[gemini-service] Error testing API key:', error);
      return false;
    }
  }
  
  /**
   * Генерирует текст с помощью Gemini
   * @param prompt Запрос для генерации текста
   * @param modelName Название модели
   * @returns Сгенерированный текст
   */
  async generateText(prompt: string, modelName: string = 'gemini-1.5-flash'): Promise<string> {
    try {
      logger.log(`[gemini-service] Generating text with model: ${modelName}`);
      
      // Используем прокси сервис для генерации текста через SOCKS5
      logger.log(`[gemini-service] Используется SOCKS5 прокси для генерации текста`, 'gemini');
      
      return await geminiProxyService.generateText({ 
        prompt, 
        model: modelName 
      });
    } catch (error) {
      logger.error('[gemini-service] Error generating text:', error);
      throw new Error(`Ошибка при генерации текста с Gemini: ${(error as Error).message}`);
    }
  }
  
  /**
   * Улучшает текст с помощью Gemini
   * @param params Параметры улучшения текста
   * @returns Улучшенный текст
   */
  async improveText({ text, prompt, model = 'gemini-1.5-flash' }: {
    text: string;
    prompt: string;
    model?: string;
  }): Promise<string> {
    try {
      logger.log(`[gemini-service] Improving text with model: ${model}`, 'gemini');
      
      // Используем прокси сервис для улучшения текста
      return await geminiProxyService.improveText({
        text,
        prompt,
        model
      });
    } catch (error) {
      logger.error('[gemini-service] Error improving text:', error);
      throw new Error(`Ошибка при улучшении текста с Gemini: ${(error as Error).message}`);
    }
  }
  
  /**
   * Обновляет API ключ
   * @param apiKey Новый API ключ
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

// Экспортируем экземпляр сервиса по умолчанию
export const geminiService = new GeminiService({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDaYtWfHwI9vq3kTatny217HnbKauAvdxE' });
