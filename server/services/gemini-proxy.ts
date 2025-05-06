import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';
import * as logger from '../utils/logger';

// Настройки коммерческого прокси
const PROXY_HOST = '131.108.17.21';
const PROXY_PORT = 9271;
const PROXY_USERNAME = 'vf8Fe7';
const PROXY_PASSWORD = 'yk5xt2';

// Формируем URL прокси с учетными данными
const PROXY_URL = `socks5://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;

/**
 * Сервис для проксирования запросов к Gemini API через коммерческий прокси
 */
export class GeminiProxyService {
  private proxyUrl: string;
  private agent: any; // Используем any для обхода проблем с типами
  
  /**
   * Конструктор сервиса прокси
   * @param proxyUrl URL прокси-сервера с учетными данными
   */
  constructor(proxyUrl: string = PROXY_URL) {
    this.proxyUrl = proxyUrl;
    this.agent = new SocksProxyAgent(proxyUrl);
    // Скрываем пароль из лога (для безопасности)
    const safeProxyUrl = this.proxyUrl.replace(/:[^:@]*@/, ':***@');
    logger.log(`[gemini-proxy] Инициализирован с SOCKS5 прокси: ${safeProxyUrl}`);
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
    this.agent = new SocksProxyAgent(proxyUrl);
    // Скрываем пароль из лога (для безопасности)
    const safeProxyUrl = proxyUrl.replace(/:[^:@]*@/, ':***@');
    logger.log(`[gemini-proxy] Обновлен прокси на: ${safeProxyUrl}`);
  }
}

// Экспортируем экземпляр прокси по умолчанию
export const geminiProxy = new GeminiProxyService();
