import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import * as logger from '../utils/logger';

// Настройки коммерческого прокси
const PROXY_HOST = '45.200.176.107';
const PROXY_PORT = 64673;
const PROXY_USERNAME = 'ttNkVLRS';
const PROXY_PASSWORD = '63cYXNdr';

// Формируем URL прокси с учетными данными
// Пробуем использовать HTTP вместо SOCKS5
const PROXY_URL = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;

/**
 * Сервис для проксирования запросов к Gemini API через коммерческий прокси
 */
export class GeminiProxyService {
  private proxyUrl: string;
  private agent: HttpsProxyAgent<string>;
  
  /**
   * Конструктор сервиса прокси
   * @param proxyUrl URL прокси-сервера с учетными данными
   */
  constructor(proxyUrl: string = PROXY_URL) {
    this.proxyUrl = proxyUrl;
    this.agent = new HttpsProxyAgent(proxyUrl);
    // Скрываем пароль из лога (для безопасности)
    const safeProxyUrl = this.proxyUrl.replace(/:[^:@]*@/, ':***@');
    logger.log(`[gemini-proxy] Инициализирован с прокси: ${safeProxyUrl}`);
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
