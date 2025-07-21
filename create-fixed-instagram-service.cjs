const fs = require('fs');

// Создаем исправленную версию instagram-private-service.js с правильными ES module импортами/экспортами

const fixedCode = `/**
 * Instagram Private Service
 * Сервис для работы с Instagram через instagram-private-api
 * Включает SOCKS5 proxy поддержку для публикации постов и Stories
 */

import { IgApiClient } from 'instagram-private-api';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

class InstagramPrivateService {
  constructor() {
    this.clients = new Map(); // Кеш клиентов Instagram
    this.sessions = new Map(); // Кеш сессий
    
    // SOCKS5 proxy конфигурация
    this.proxyConfig = {
      host: 'mobpool.proxy.market',
      port: 10001, // Порты 10000-10999
      username: 'WeBZDZ7p9lh5',
      password: 'iOPNYl8D',
      type: 5 // SOCKS5
    };
    
    console.log('[Instagram Service] Инициализация с SOCKS5 proxy:', {
      host: this.proxyConfig.host,
      port: this.proxyConfig.port,
      username: this.proxyConfig.username.substring(0, 4) + '***'
    });
    
    // Автоочистка кеша каждые 30 минут
    setInterval(() => {
      this.cleanupCache();
    }, 30 * 60 * 1000);
  }

  /**
   * Создает SOCKS5 proxy agent для Instagram клиента
   */
  createProxyAgent() {
    const proxyUrl = \`socks5://\${this.proxyConfig.username}:\${this.proxyConfig.password}@\${this.proxyConfig.host}:\${this.proxyConfig.port}\`;
    return new SocksProxyAgent(proxyUrl);
  }

  /**
   * Создает и настраивает Instagram клиента с proxy
   */
  async createInstagramClient(username, password) {
    const sessionKey = \`\${username}:\${crypto.createHash('md5').update(password).digest('hex')}\`;
    
    // Проверяем кеш
    if (this.clients.has(sessionKey)) {
      const cached = this.clients.get(sessionKey);
      console.log(\`[Instagram Service] Используем кешированную сессию для \${username}\`);
      return cached;
    }

    try {
      const ig = new IgApiClient();
      
      // Настраиваем SOCKS5 proxy для всех запросов
      const proxyAgent = this.createProxyAgent();
      
      // Устанавливаем proxy agent для всех HTTP запросов Instagram API
      ig.request.defaults.httpsAgent = proxyAgent;
      ig.request.defaults.agent = proxyAgent;

      // Настраиваем user agent и device
      ig.state.generateDevice(username);
      ig.state.proxyUrl = \`socks5://\${this.proxyConfig.username}:\${this.proxyConfig.password}@\${this.proxyConfig.host}:\${this.proxyConfig.port}\`;

      console.log(\`[Instagram Service] Авторизация пользователя \${username} через SOCKS5\`);
      
      // Авторизация
      const auth = await ig.account.login(username, password);
      console.log(\`[Instagram Service] ✅ Успешная авторизация: \${username}, User ID: \${auth.pk}\`);
      
      // Кешируем клиента на 1 час
      this.clients.set(sessionKey, {
        client: ig,
        username: username,
        timestamp: Date.now(),
        authenticated: true
      });
      
      return this.clients.get(sessionKey);
      
    } catch (error) {
      console.error(\`[Instagram Service] Ошибка авторизации \${username}:\`, error.message);
      
      // Если challenge требуется, логируем это
      if (error.message.includes('challenge_required')) {
        console.log(\`[Instagram Service] Требуется challenge для \${username}\`);
      }
      
      throw new Error(\`Не удалось авторизоваться в Instagram: \${error.message}\`);
    }
  }

  /**
   * Проверяет статус авторизации аккаунта
   */
  async checkStatus(username, password) {
    try {
      const clientData = await this.createInstagramClient(username, password);
      return {
        authenticated: true,
        username: clientData.username,
        hasProxy: true
      };
    } catch (error) {
      return {
        authenticated: false,
        error: error.message,
        hasProxy: true
      };
    }
  }

  /**
   * Публикует Stories с интерактивными элементами
   */
  async publishStory(username, password, storyData) {
    console.log(\`[Instagram Service] Публикация Stories для \${username}\`);
    
    try {
      const clientData = await this.createInstagramClient(username, password);
      const ig = clientData.client;

      // Если это массив слайдов Stories
      if (Array.isArray(storyData.slides)) {
        const results = [];
        
        for (let i = 0; i < storyData.slides.length; i++) {
          const slide = storyData.slides[i];
          console.log(\`[Instagram Service] Публикация слайда \${i + 1}/\${storyData.slides.length}\`);
          
          try {
            const result = await this.publishSingleStorySlide(ig, slide);
            results.push(result);
            
            // Пауза между слайдами для избежания rate limiting
            if (i < storyData.slides.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error(\`[Instagram Service] Ошибка публикации слайда \${i + 1}:\`, error.message);
            results.push({ success: false, error: error.message });
          }
        }
        
        return {
          success: true,
          slidesPublished: results.filter(r => r.success).length,
          totalSlides: storyData.slides.length,
          results: results
        };
      } else {
        // Одиночный Stories
        return await this.publishSingleStorySlide(ig, storyData);
      }
      
    } catch (error) {
      console.error(\`[Instagram Service] Критическая ошибка публикации Stories:\`, error);
      throw error;
    }
  }

  /**
   * Публикует один слайд Stories
   */
  async publishSingleStorySlide(ig, slideData) {
    try {
      // Определяем тип медиа
      let mediaBuffer;
      
      if (slideData.imageUrl) {
        // Загружаем изображение
        const response = await fetch(slideData.imageUrl);
        mediaBuffer = Buffer.from(await response.arrayBuffer());
      } else if (slideData.videoUrl) {
        // Загружаем видео
        const response = await fetch(slideData.videoUrl);
        mediaBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        throw new Error('Не указан imageUrl или videoUrl для Stories');
      }

      // Подготавливаем опции для Stories
      const storyOptions = {};
      
      // Добавляем интерактивные элементы, если есть
      if (slideData.interactiveElements && slideData.interactiveElements.length > 0) {
        storyOptions.stickers = [];
        
        for (const element of slideData.interactiveElements) {
          if (element.type === 'poll') {
            storyOptions.stickers.push({
              type: 'poll',
              poll: {
                question: element.question || 'Ваше мнение?',
                leftChoice: element.leftChoice || 'Да',
                rightChoice: element.rightChoice || 'Нет'
              }
            });
          } else if (element.type === 'question') {
            storyOptions.stickers.push({
              type: 'question',
              question: {
                question: element.question || 'Задайте вопрос'
              }
            });
          } else if (element.type === 'slider') {
            storyOptions.stickers.push({
              type: 'slider',
              slider: {
                question: element.question || 'Оцените',
                emoji: element.emoji || '🔥'
              }
            });
          }
        }
      }

      let result;
      
      if (slideData.videoUrl) {
        // Публикуем видео Stories
        result = await ig.publish.story({
          video: mediaBuffer,
          ...storyOptions
        });
      } else {
        // Публикуем фото Stories
        result = await ig.publish.story({
          file: mediaBuffer,
          ...storyOptions
        });
      }
      
      console.log(\`[Instagram Service] ✅ Stories опубликован: \${result.media?.id || 'ID неизвестен'}\`);
      
      return {
        success: true,
        storyId: result.media?.id,
        storyUrl: \`https://instagram.com/stories/\${slideData.username || 'unknown'}/\${result.media?.id || ''}\`
      };
      
    } catch (error) {
      console.error(\`[Instagram Service] Ошибка публикации слайда Stories:\`, error);
      throw error;
    }
  }

  /**
   * Очистка кеша
   */
  cleanupCache() {
    const now = Date.now();
    const expired = [];
    
    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => {
      this.sessions.delete(key);
      this.clients.delete(key);
    });
    
    if (expired.length > 0) {
      console.log(\`[Instagram Service] Очищено \${expired.length} истекших сессий\`);
    }
  }
}

// Экспортируем singleton
const instagramService = new InstagramPrivateService();
export default instagramService;
`;

// Записываем исправленный файл
fs.writeFileSync('server/services/instagram-private-service.js', fixedCode);

console.log('✅ Создан исправленный instagram-private-service.js с ES modules');