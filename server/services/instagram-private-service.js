/**
 * Instagram Private Service
 * Сервис для работы с Instagram через instagram-private-api
 * Включает SOCKS5 proxy поддержку для публикации постов и Stories
 */

const { IgApiClient } = require('instagram-private-api');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class InstagramPrivateService {
  constructor() {
    this.clients = new Map(); // Кеш клиентов Instagram
    this.sessions = new Map(); // Кеш сессий
    
    // SOCKS5 proxy конфигурация
    this.proxyConfig = {
      host: 'mobpool.proxy.market',
      port: 10000, // Порты 10000-10999
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
    const proxyUrl = `socks5://${this.proxyConfig.username}:${this.proxyConfig.password}@${this.proxyConfig.host}:${this.proxyConfig.port}`;
    return new SocksProxyAgent(proxyUrl);
  }

  /**
   * Получает или создает Instagram клиента с proxy
   */
  async getInstagramClient(username, password) {
    const sessionKey = crypto.createHash('md5').update(`${username}:${password}`).digest('hex');
    
    if (this.clients.has(sessionKey)) {
      console.log(`[Instagram Service] Используем кешированного клиента для ${username}`);
      return this.clients.get(sessionKey);
    }

    console.log(`[Instagram Service] Создаем нового клиента для ${username} с SOCKS5 proxy`);
    
    const ig = new IgApiClient();
    
    // Настраиваем proxy для всех HTTP запросов
    const proxyAgent = this.createProxyAgent();
    ig.request.defaults.agent = proxyAgent;
    
    // Настраиваем устройство и состояние
    ig.state.generateDevice(username);
    ig.state.proxyUrl = `socks5://${this.proxyConfig.username}:${this.proxyConfig.password}@${this.proxyConfig.host}:${this.proxyConfig.port}`;
    
    try {
      // Попытка авторизации
      console.log(`[Instagram Service] Попытка авторизации ${username} через proxy`);
      
      await ig.account.login(username, password);
      
      console.log(`[Instagram Service] Авторизация ${username} успешна`);
      
      // Кешируем клиента
      this.clients.set(sessionKey, ig);
      this.sessions.set(sessionKey, {
        ig: ig,
        username: username,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 дней
      });
      
      return ig;
    } catch (error) {
      console.error(`[Instagram Service] Ошибка авторизации ${username}:`, error.message);
      throw error;
    }
  }

  /**
   * Публикует фото в Instagram
   */
  async publishPhoto(username, password, imageBuffer, caption = '') {
    try {
      console.log(`[Instagram Service] Публикация фото для ${username}`);
      
      const ig = await this.getInstagramClient(username, password);
      
      const publishResult = await ig.publish.photo({
        file: imageBuffer,
        caption: caption
      });
      
      console.log(`[Instagram Service] Фото опубликовано успешно: ${publishResult.media.id}`);
      
      return {
        success: true,
        postId: publishResult.media.code,
        postUrl: `https://instagram.com/p/${publishResult.media.code}`,
        mediaId: publishResult.media.id,
        message: 'Пост опубликован успешно'
      };
      
    } catch (error) {
      console.error(`[Instagram Service] Ошибка публикации фото:`, error.message);
      throw error;
    }
  }

  /**
   * Публикует Stories в Instagram
   */
  async publishStory(username, password, imageBuffer, options = {}) {
    try {
      console.log(`[Instagram Service] Публикация Stories для ${username}`);
      
      const ig = await this.getInstagramClient(username, password);
      
      const publishResult = await ig.publish.story({
        file: imageBuffer,
        ...options
      });
      
      console.log(`[Instagram Service] Stories опубликована успешно: ${publishResult.media.id}`);
      
      return {
        success: true,
        storyId: publishResult.media.id,
        storyUrl: `https://instagram.com/stories/${username}/${publishResult.media.id}`,
        message: 'Stories опубликована успешно'
      };
      
    } catch (error) {
      console.error(`[Instagram Service] Ошибка публикации Stories:`, error.message);
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
      console.log(`[Instagram Service] Очищено ${expired.length} истекших сессий`);
    }
  }
}

// Экспортируем singleton
const instagramService = new InstagramPrivateService();
module.exports = instagramService;
      
      // Кешируем клиента на 1 час
      this.clients.set(sessionKey, {
        client: ig,
        username: username,
        timestamp: Date.now(),
        authenticated: true
      });
      
      return this.clients.get(sessionKey);
      
    } catch (error) {
      console.error(`[Instagram Service] Ошибка авторизации ${username}:`, error.message);
      
      // Если challenge требуется, логируем это
      if (error.message.includes('challenge_required')) {
        console.log(`[Instagram Service] Требуется challenge для ${username}`);
      }
      
      throw new Error(`Не удалось авторизоваться в Instagram: ${error.message}`);
    }
  }

  /**
   * Проверяет статус авторизации аккаунта
   */
  async checkStatus(username, password) {
    try {
      console.log(`[Instagram Service] Проверка статуса аккаунта ${username}`);
      
      const clientData = await this.getInstagramClient(username, password);
      
      if (clientData && clientData.authenticated) {
        const user = await clientData.client.user.info(clientData.client.state.cookieUserId);
        
        return {
          success: true,
          username: user.username,
          userId: user.pk,
          fullName: user.full_name,
          isPrivate: user.is_private,
          followerCount: user.follower_count,
          followingCount: user.following_count
        };
      } else {
        throw new Error('Аккаунт не авторизован');
      }
      
    } catch (error) {
      console.error(`[Instagram Service] Ошибка проверки статуса ${username}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Публикует обычный пост (фото + подпись)
   */
  async publishPhoto(username, password, imageData, caption = '') {
    try {
      console.log(`[Instagram Service] Публикация фото для ${username}`);
      
      const clientData = await this.getInstagramClient(username, password);
      
      if (!clientData || !clientData.authenticated) {
        throw new Error('Клиент не авторизован');
      }

      // Конвертируем base64 в buffer
      let imageBuffer;
      if (imageData.startsWith('data:image/')) {
        // Убираем data URL prefix
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageData.startsWith('/')) {
        // Локальный файл
        imageBuffer = fs.readFileSync(imageData);
      } else {
        // Предполагаем, что это уже base64
        imageBuffer = Buffer.from(imageData, 'base64');
      }

      console.log(`[Instagram Service] Размер изображения: ${imageBuffer.length} байт`);

      // Публикуем пост через Instagram API
      const publishResult = await clientData.client.publish.photo({
        file: imageBuffer,
        caption: caption || ''
      });

      console.log(`[Instagram Service] Пост успешно опубликован:`, publishResult.media.pk);

      // Формируем URL поста
      const postUrl = `https://www.instagram.com/p/${publishResult.media.code}/`;

      return {
        success: true,
        status: 'published',
        postUrl: postUrl,
        postId: publishResult.media.pk,
        mediaCode: publishResult.media.code,
        platform: 'instagram',
        publishedAt: new Date().toISOString(),
        message: 'Пост успешно опубликован в Instagram'
      };

    } catch (error) {
      console.error(`[Instagram Service] Ошибка публикации фото:`, error.message);
      
      return {
        success: false,
        status: 'failed',
        error: error.message,
        platform: 'instagram',
        publishedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Публикует Instagram Stories с интерактивными элементами
   */
  async publishStory(username, password, imageData, interactive = null) {
    try {
      console.log(`[Instagram Service] Публикация Stories для ${username}`);
      
      const clientData = await this.getInstagramClient(username, password);
      
      if (!clientData || !clientData.authenticated) {
        throw new Error('Клиент не авторизован');
      }

      // Конвертируем изображение
      let imageBuffer;
      if (imageData.startsWith('data:image/')) {
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageData.startsWith('/')) {
        imageBuffer = fs.readFileSync(imageData);
      } else {
        imageBuffer = Buffer.from(imageData, 'base64');
      }

      console.log(`[Instagram Service] Размер Stories изображения: ${imageBuffer.length} байт`);

      // Базовые параметры Stories
      const storyOptions = {
        file: imageBuffer
      };

      // Добавляем интерактивные элементы, если есть
      if (interactive) {
        console.log(`[Instagram Service] Добавляем интерактивные элементы:`, Object.keys(interactive));
        
        // Добавляем poll (опрос)
        if (interactive.poll) {
          storyOptions.poll = {
            question: interactive.poll.question || 'Ваше мнение?',
            leftChoice: interactive.poll.option1 || 'Да',
            rightChoice: interactive.poll.option2 || 'Нет'
          };
        }

        // Добавляем slider (слайдер)
        if (interactive.slider) {
          storyOptions.slider = {
            question: interactive.slider.question || 'Оцените от 0 до 100',
            emoji: interactive.slider.emoji || '❤️'
          };
        }

        // Добавляем question sticker (вопрос)
        if (interactive.question) {
          storyOptions.question = {
            question: interactive.question.text || 'Задайте вопрос'
          };
        }
      }

      // Публикуем Stories
      const publishResult = await clientData.client.publish.story(storyOptions);

      console.log(`[Instagram Service] Stories успешно опубликована:`, publishResult.media.pk);

      // Формируем URL Stories (приблизительный, так как Stories временные)
      const storyUrl = `https://www.instagram.com/stories/${clientData.username}/${publishResult.media.pk}/`;

      return {
        success: true,
        status: 'published',
        storyUrl: storyUrl,
        storyId: publishResult.media.pk,
        platform: 'instagram_stories',
        publishedAt: new Date().toISOString(),
        interactive: interactive ? Object.keys(interactive) : [],
        message: 'Stories успешно опубликована в Instagram'
      };

    } catch (error) {
      console.error(`[Instagram Service] Ошибка публикации Stories:`, error.message);
      
      return {
        success: false,
        status: 'failed',
        error: error.message,
        platform: 'instagram_stories',
        publishedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Очищает кеш сессий
   */
  clearCache() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    let cleanedCount = 0;
    
    // Очищаем старые клиенты (старше 1 часа)
    for (const [key, clientData] of this.clients.entries()) {
      if (now - clientData.timestamp > oneHour) {
        this.clients.delete(key);
        cleanedCount++;
      }
    }
    
    // Очищаем старые сессии
    for (const [key, sessionData] of this.sessions.entries()) {
      if (now - sessionData.timestamp > oneHour) {
        this.sessions.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Instagram Service] Очищен кеш: удалено ${cleanedCount} записей`);
    }
  }

  /**
   * Ручная очистка всего кеша
   */
  clearAllCache() {
    const totalClients = this.clients.size;
    const totalSessions = this.sessions.size;
    
    this.clients.clear();
    this.sessions.clear();
    
    console.log(`[Instagram Service] Полная очистка кеша: ${totalClients} клиентов, ${totalSessions} сессий`);
  }

  /**
   * Получает статистику кеша
   */
  getCacheStats() {
    return {
      activeClients: this.clients.size,
      activeSessions: this.sessions.size,
      proxyConfig: {
        host: this.proxyConfig.host,
        port: this.proxyConfig.port,
        type: 'SOCKS5'
      }
    };
  }
}

// Экспортируем единственный экземпляр сервиса
const instagramService = new InstagramPrivateService();

module.exports = instagramService;