import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from '../utils/logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';


interface GeminiProxyOptions {
  apiKey: string;
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
}

/**
 * Реализация сервиса Gemini с поддержкой SOCKS5 прокси
 */
export class GeminiProxyService {
  private apiKey: string;
  private agent: SocksProxyAgent | null;
  private proxyUrl: string | null;
  private maxRetries: number = 3;
  
  /**
   * Создает новый экземпляр GeminiProxyService
   * @param options Опции для инициализации сервиса
   */
  constructor(options: GeminiProxyOptions) {
    this.apiKey = options.apiKey;
    
    // Настройки прокси по умолчанию (канадский прокси)
    const proxyHost = options.proxyHost || '138.219.123.68';
    const proxyPort = options.proxyPort || 9710;
    const proxyUsername = options.proxyUsername || 'PGjuJV';
    const proxyPassword = options.proxyPassword || 'cwZmJ3';
    
    // Формируем URL прокси с учетными данными
    this.proxyUrl = `socks5://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
    
    // Создаем прокси-агент
    try {
      // Проверяем, доступен ли SocksProxyAgent
      if (SocksProxyAgent) {
        this.agent = new SocksProxyAgent(this.proxyUrl);
        
        // Скрываем пароль из лога (для безопасности)
        const safeProxyUrl = this.proxyUrl.replace(/:[^:@]*@/, ':***@');
        logger.log(`[gemini-proxy] Инициализирован SOCKS5 прокси: ${safeProxyUrl}`, 'gemini');
      } else {
        logger.warn('[gemini-proxy] SOCKS5 прокси не используется, т.к. модуль socks-proxy-agent не установлен', 'gemini');
        this.agent = null;
      }
    } catch (error) {
      logger.error(`[gemini-proxy] Ошибка инициализации SOCKS5 прокси: ${(error as Error).message}`, 'gemini');
      this.agent = null;
      this.proxyUrl = null;
    }
  }
  
  /**
   * Отправляет запрос к Gemini API через SOCKS5 прокси
   * @param url URL для запроса
   * @param body Тело запроса
   * @returns Ответ от API в виде JSON
   */
  async sendRequest(url: string, body: any): Promise<any> {
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries < this.maxRetries) {
      try {
        // Маскируем API ключ в URL для логов
        const safeUrl = url.replace(/key=[^&]+/, 'key=****');
        logger.log(`[gemini-proxy] Отправка запроса к: ${safeUrl}`, 'gemini');
        
        const fetchOptions: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        };
        
        // Добавляем прокси-агент, если он доступен
        if (this.agent) {
          // @ts-ignore - Тип agent не совпадает с ожидаемым типом в RequestInit, но это работает
          fetchOptions.agent = this.agent;
        } else {
          logger.warn(`[gemini-proxy] SOCKS5 прокси не настроен, используется прямое соединение`, 'gemini');
        }
        
        // Выполняем запрос
        const response = await fetch(url, fetchOptions);
        const status = response.status;
        
        logger.log(`[gemini-proxy] Получен ответ со статусом: ${status}`, 'gemini');
        
        if (status === 200) {
          // Успешный ответ
          const data = await response.json();
          return data;
        } else {
          // Обрабатываем ошибку
          const errorText = await response.text();
          throw new Error(`HTTP error ${status}: ${errorText}`);
        }
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries < this.maxRetries) {
          const backoffTime = Math.pow(2, retries) * 500; // Экспоненциальная задержка
          logger.warn(`[gemini-proxy] Попытка ${retries} из ${this.maxRetries} не удалась. Повтор через ${backoffTime}ms. Ошибка: ${lastError.message}`, 'gemini');
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // Если все попытки неудачны
    throw new Error(`[gemini-proxy] Максимальное количество попыток исчерпано. Последняя ошибка: ${lastError?.message || 'Неизвестная ошибка'}`);
  }
  
  /**
   * Тестирует доступность API Gemini и валидность API ключа
   * @returns true если API ключ действителен и доступен, иначе false
   */
  async testApiKey(): Promise<boolean> {
    try {
      // URL для запроса к API Gemini
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      // Тестовый промпт
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: "Hello, this is a test message."
              }
            ]
          }
        ]
      };
      
      // Отправляем запрос
      await this.sendRequest(url, requestData);
      
      return true;
    } catch (error) {
      logger.error(`[gemini-proxy] Ошибка при тестировании API ключа: ${(error as Error).message}`, 'gemini');
      return false;
    }
  }
  
  /**
   * Улучшает текст с помощью Gemini API
   * @param params Параметры для улучшения текста
   * @returns Улучшенный текст
   */
  async improveText(params: { text: string; prompt: string; model?: string }): Promise<string> {
    try {
      const { text, prompt, model = 'gemini-1.5-flash' } = params;
      
      logger.log(`[gemini-proxy] Improving text with model: ${model}`, 'gemini');
      
      // URL для запроса к Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      
      // Формируем запрос
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
      
      // Отправляем запрос
      const response = await this.sendRequest(url, requestData);
      
      // Обрабатываем ответ
      if (response.candidates && response.candidates.length > 0 && 
          response.candidates[0].content && 
          response.candidates[0].content.parts && 
          response.candidates[0].content.parts.length > 0) {
        // Получаем текст из ответа
        let resultText = response.candidates[0].content.parts[0].text || '';
        
        // Очищаем текст от HTML-тегов и других артефактов
        resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
        resultText = resultText.replace(/<[^>]*>/g, '');
        resultText = resultText.replace(/```html/g, ''); // Удаляем маркеры начала HTML-кода
        resultText = resultText.replace(/```/g, ''); // Удаляем оставшиеся маркеры кода
        
        return resultText;
      }
      
      throw new Error('Неожиданный формат ответа от Gemini API');
    } catch (error) {
      logger.error(`[gemini-proxy] Ошибка при улучшении текста: ${(error as Error).message}`, 'gemini');
      throw error;
    }
  }
  
  /**
   * Генерирует текст с помощью Gemini API
   * @param params Параметры для генерации текста
   * @returns Сгенерированный текст
   */
  async generateText(params: { prompt: string; model?: string }): Promise<string> {
    try {
      const { prompt, model = 'gemini-1.5-flash' } = params;
      
      logger.log(`[gemini-proxy] Generating text with model: ${model}`, 'gemini');
      
      // URL для запроса к Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      
      // Формируем запрос
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
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192
        }
      };
      
      // Отправляем запрос
      const response = await this.sendRequest(url, requestData);
      
      // Обрабатываем ответ
      if (response.candidates && response.candidates.length > 0 && 
          response.candidates[0].content && 
          response.candidates[0].content.parts && 
          response.candidates[0].content.parts.length > 0) {
        // Получаем текст из ответа
        let resultText = response.candidates[0].content.parts[0].text || '';
        
        // Очищаем текст от HTML-тегов и других артефактов
        resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
        resultText = resultText.replace(/<[^>]*>/g, '');
        resultText = resultText.replace(/```html/g, ''); // Удаляем маркеры начала HTML-кода
        resultText = resultText.replace(/```/g, ''); // Удаляем оставшиеся маркеры кода
        
        return resultText;
      }
      
      throw new Error('Неожиданный формат ответа от Gemini API');
    } catch (error) {
      logger.error(`[gemini-proxy] Ошибка при генерации текста: ${(error as Error).message}`, 'gemini');
      throw error;
    }
  }
}

// Создаем глобальный экземпляр сервиса с использованием API ключа из переменных окружения
export const geminiProxyService = new GeminiProxyService({ 
  apiKey: process.env.GEMINI_API_KEY || ''
});
