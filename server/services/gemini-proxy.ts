import { HttpsProxyAgent } from 'https-proxy-agent';
import { URL } from 'url';
import fetch from 'node-fetch';
import * as logger from '../utils/logger';

/**
 * Сервис для проксирования запросов к Gemini API через VPN
 */
export class GeminiProxyService {
  private proxyUrl: string;
  private agent: HttpsProxyAgent<URL>;
  
  /**
   * Конструктор сервиса прокси
   * @param proxyUrl URL прокси-сервера (например, socks5://127.0.0.1:1080)
   */
  constructor(proxyUrl: string = 'socks5://127.0.0.1:1080') {
    this.proxyUrl = proxyUrl;
    this.agent = new HttpsProxyAgent(proxyUrl);
    logger.log(`[gemini-proxy] Инициализирован с прокси: ${proxyUrl}`);
  }
  
  /**
   * Выполняет запрос к Gemini API через прокси
   * @param url URL запроса к Gemini API
   * @param options Опции запроса
   * @returns Результат запроса
   */
  async fetch(url: string, options: any = {}): Promise<any> {
    try {
      logger.log(`[gemini-proxy] Отправка запроса к: ${url}`);
      
      // Добавляем прокси-агент к опциям запроса
      const proxyOptions = {
        ...options,
        agent: this.agent
      };
      
      // Выполняем запрос через прокси
      const response = await fetch(url, proxyOptions);
      
      logger.log(`[gemini-proxy] Получен ответ со статусом: ${response.status}`);
      return response;
    } catch (error) {
      logger.error(`[gemini-proxy] Ошибка в прокси-запросе: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Изменяет URL прокси
   * @param proxyUrl Новый URL прокси-сервера
   */
  updateProxyUrl(proxyUrl: string): void {
    this.proxyUrl = proxyUrl;
    this.agent = new HttpsProxyAgent(proxyUrl);
    logger.log(`[gemini-proxy] Обновлен прокси на: ${proxyUrl}`);
  }
}

// Экспортируем экземпляр прокси по умолчанию
export const geminiProxy = new GeminiProxyService();
