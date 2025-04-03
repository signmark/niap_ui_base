/**
 * Патч для метода publishToTelegram в классе SocialPublishingService
 * Решает проблему с авторизацией при скачивании изображений из Directus
 * и отправке в Telegram
 */

// Импортируем TelegramPublisher и другие необходимые модули
import { log } from '../logger';
import { TelegramPublisherType } from '../types/telegram-publisher';

// Обрабатываем ошибку с CommonJS и ESM модулями
let TelegramPublisher: TelegramPublisherType;
try {
  // Пытаемся импортировать как ESM модуль
  const importPath = '../../telegram-publisher.mjs';
  TelegramPublisher = require(importPath).TelegramPublisher;
} catch (error) {
  // Если это не удается, пробуем импортировать как CommonJS
  try {
    TelegramPublisher = require('../../standalone-telegram-publisher');
  } catch (innerError) {
    log(`❌ Ошибка при импорте TelegramPublisher: ${innerError.message}`, 'telegram-patch');
    throw new Error('Не удалось импортировать TelegramPublisher');
  }
}

/**
 * Патч для метода publishToTelegram класса SocialPublishingService
 * Использует отдельный класс TelegramPublisher с авторизацией Directus
 * 
 * @param {any} originalThis ссылка на экземпляр SocialPublishingService (this)
 * @param {any} content контент для публикации
 * @param {any} telegramSettings настройки Telegram
 * @returns {Promise<any>} результат публикации
 */
export async function patchedPublishToTelegram(originalThis: any, content: any, telegramSettings: any): Promise<any> {
  log(`📱 Публикация в Telegram: ${content.id}`, 'social-publishing');
  
  // Проверка входных данных
  if (!telegramSettings) {
    log(`❌ Отсутствуют настройки Telegram для ${content.id}`, 'social-publishing');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки Telegram',
      userId: null
    };
  }
  
  if (!telegramSettings.token) {
    log(`❌ Отсутствует токен бота Telegram для ${content.id}`, 'social-publishing');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствует токен бота Telegram',
      userId: null
    };
  }
  
  if (!telegramSettings.chatId) {
    log(`❌ Отсутствует ID чата Telegram для ${content.id}`, 'social-publishing');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствует ID чата Telegram',
      userId: null
    };
  }
  
  // Получаем настройки
  const token = telegramSettings.token;
  const chatId = telegramSettings.chatId;
  
  try {
    log(`🔄 Подготовка контента для публикации в Telegram: ${content.id}`, 'social-publishing');
    
    // Обрабатываем текст с помощью оригинального метода
    const processedContent = await originalThis.processContentForPublishing(content, 'telegram');
    
    // Форматируем текст для Telegram (с сохранением форматирования и эмодзи)
    const formattedText = await originalThis.formatTextForTelegram(processedContent.text);
    
    log(`📝 Подготовлен текст для Telegram (${formattedText.length} символов)`, 'social-publishing');
    
    // Получаем URL изображения
    const processedImageUrl = processedContent.imageUrl;
    
    if (!processedImageUrl) {
      log(`⚠️ Отсутствует изображение для публикации в Telegram`, 'social-publishing');
      
      // Отправляем только текст, если нет изображения
      try {
        const textOnlyResponse = await originalThis.sendTelegramTextMessage(
          chatId,
          formattedText,
          token
        );
        
        log(`✅ Успешно опубликован текст в Telegram, message_id: ${textOnlyResponse.result.message_id}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date().toISOString(),
          postId: textOnlyResponse.result.message_id.toString(),
          postUrl: null,
          error: null,
          userId: chatId
        };
      } catch (textError: any) {
        log(`❌ Ошибка при публикации текста в Telegram: ${textError.message}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка при публикации текста: ${textError.message}`,
          userId: chatId
        };
      }
    }
    
    // Создаем экземпляр TelegramPublisher
    const telegramPublisher = new TelegramPublisher();
    
    // Отправляем изображение через отдельный класс вместо метода uploadTelegramImageFromUrl
    log(`🚀 Отправка изображения в Telegram через TelegramPublisher: ${processedImageUrl.substring(0, 70)}...`, 'social-publishing');
    
    const response = await telegramPublisher.sendDirectusImageToTelegram(
      processedImageUrl,
      chatId,
      formattedText,
      token
    );
    
    if (response && response.ok) {
      log(`✅ Успешно опубликован пост с изображением в Telegram, message_id: ${response.result.message_id}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'published',
        publishedAt: new Date().toISOString(),
        postId: response.result.message_id.toString(),
        postUrl: null,
        error: null,
        userId: chatId
      };
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response)}`);
    }
    
  } catch (error: any) {
    log(`❌ Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации: ${error.message}`,
      userId: chatId
    };
  }
}

/**
 * Инструкция по применению:
 * 
 * Импортируйте патч в файле social-publishing.ts:
 * import { patchedPublishToTelegram } from './patches/telegram-publisher-patch';
 * 
 * И замените вызов метода на:
 * async publishToTelegram(content: CampaignContent, telegramSettings: SocialMediaSettings): Promise<SocialPublication> {
 *   return patchedPublishToTelegram(this, content, telegramSettings);
 * }
 */