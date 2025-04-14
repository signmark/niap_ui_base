import axios from 'axios';
import { log } from '../../utils/logger';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { CampaignContent, SocialMediaSettings, SocialPublication } from '@shared/schema';
import { storage } from '../../storage';
import { DirectusAuthManager } from '../../directus-auth';
import { fixUnclosedTags } from '../../utils/telegram-tag-fixer';

/**
 * Сервис для публикации контента в Telegram с поддержкой изображений, видео и HTML-форматирования
 */
export class TelegramService {
  // Сохраняем username последнего чата для использования в формировании URL
  private currentChatUsername: string | null = null;
  
  constructor(private directusAuthManager: DirectusAuthManager) {}

  /**
   * Получает системный токен для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      const adminSession = await this.directusAuthManager.getAdminSession();
      return adminSession?.access_token || null;
    } catch (error) {
      log(`Ошибка при получении системного токена: ${error}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Получает настройки социальных сетей для кампании из хранилища
   * @param content Контент для публикации
   * @returns Настройки социальных сетей или null в случае ошибки
   */
  private async getCampaignSettings(content: CampaignContent): Promise<SocialMediaSettings | null> {
    try {
      const campaign = await storage.getCampaignById(content.campaignId);
      return campaign?.socialMediaSettings || null;
    } catch (error) {
      log(`Ошибка при получении настроек социальных сетей: ${error}`, 'social-publishing');
      return null;
    }
  }
  
  /**
   * Исправляет HTML-разметку для совместимости с Telegram
   * Telegram поддерживает ограниченный набор HTML-тегов:
   * <b>, <i>, <u>, <s>, <a>, <code>, <pre>
   * 
   * @param text Исходный текст с HTML-разметкой
   * @returns Исправленный текст
   */
  private fixHtmlForTelegram(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    log(`Исправление HTML для Telegram, исходный текст: ${text.substring(0, 100)}...`, 'social-publishing');
    
    try {
      // Шаг 1: Сохраняем поддерживаемые теги и их содержимое
      let result = text
        // Заменяем все недопустимые теги на пробелы или удаляем
        .replace(/<(?!\/?(b|strong|i|em|u|ins|s|strike|del|a|code|pre)(\s|>))[^>]+>/gi, ' ')
        // Преобразуем семантические теги в базовые HTML
        .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, match => match.replace(/strong/gi, 'b'))
        .replace(/<\/?(em|i)(\s[^>]*)?>/gi, match => match.replace(/em/gi, 'i'))
        .replace(/<\/?(ins|u)(\s[^>]*)?>/gi, match => match.replace(/ins/gi, 'u'))
        .replace(/<\/?(del|strike|s)(\s[^>]*)?>/gi, match => match.replace(/del|strike/gi, 's'))
        // Удаляем атрибуты из поддерживаемых тегов, кроме href для <a>
        .replace(/<(b|i|u|s|code|pre)(\s[^>]*)>/gi, '<$1>')
        // Для тега <a> сохраняем только атрибут href
        .replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>/gi, '<a href="$1">');
      
      // Шаг 2: Исправляем незакрытые теги при помощи специального исправителя
      result = fixUnclosedTags(result);
      
      log(`HTML после исправления: ${result.substring(0, 100)}...`, 'social-publishing');
      
      return result;
    } catch (error) {
      log(`Ошибка при исправлении HTML: ${error}`, 'social-publishing');
      // В случае ошибки возвращаем текст без HTML-разметки
      return text.replace(/<[^>]*>/g, '');
    }
  }
  
  /**
   * Более агрессивный исправитель тегов для случаев, когда стандартный не справляется
   * @param text Текст с HTML-разметкой
   * @returns Исправленный текст
   */
  private aggressiveTagFixer(text: string): string {
    try {
      log(`Применение агрессивного исправителя HTML для Telegram`, 'social-publishing');
      
      // Шаг 1: Исправляем основные теги стандартным исправителем
      let result = this.fixHtmlForTelegram(text);
      
      // Шаг 2: Проверяем наличие оставшихся несбалансированных тегов
      const tagsRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
      const allTags = result.match(tagsRegex) || [];
      const tagCounts: Record<string, number> = {};
      
      // Подсчитываем открывающие и закрывающие теги
      for (const tag of allTags) {
        const isClosing = tag.startsWith('</');
        const tagName = tag.match(/<\/?([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase() || '';
        
        if (!tagName) continue;
        
        if (!tagCounts[tagName]) {
          tagCounts[tagName] = 0;
        }
        
        tagCounts[tagName] += isClosing ? -1 : 1;
      }
      
      // Если есть несбалансированные теги, переходим к агрессивному исправлению
      const hasUnbalancedTags = Object.values(tagCounts).some(count => count !== 0);
      
      if (hasUnbalancedTags) {
        log(`Обнаружены несбалансированные теги: ${JSON.stringify(tagCounts)}`, 'social-publishing');
        return text.replace(/<[^>]*>/g, '');
      }
      
      log(`Теги сбалансированы после стандартного исправления`, 'social-pu

  /**
   * Форматирует текст для публикации в Telegram с учетом ограничений и специфики платформы
   * @param text Исходный текст с HTML-разметкой
   * @returns Форматированный текст для Telegram
   */
  private formatTextForTelegram(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    log(`Форматирование текста для Telegram, исходная длина: ${text.length}`, 'social-publishing');
    
    // Исправляем HTML-разметку для Telegram
    let formattedText = this.fixHtmlForTelegram(text);
    
    // Если текст слишком длинный, обрезаем его (лимит Telegram - 4096 символов)
    if (formattedText.length > 4000) {
      formattedText = formattedText.substring(0, 3997) + '...';
      log(`Текст обрезан до 4000 символов для Telegram`, 'social-publishing');
    }
    
    return formattedText;
  }
  
  /**
   * Отправляет видео в Telegram
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @param videoUrl URL видео или путь к локальному файлу
   * @param caption Текстовая подпись к видео
   * @returns Результат отправки видео
   */
  private async sendVideoToTelegram(
    chatId: string,
    token: string,
    videoUrl: string,
    caption: string = ''
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      log(`Отправка видео в Telegram: ${videoUrl} в чат ${chatId}`, 'social-publishing');
      
      // Формируем URL запроса
      const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
      
      // Проверяем валидность chat_id
      let formattedChatId = chatId;
      if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
        formattedChatId = `-100${formattedChatId}`;
        log(`Преобразован chatId для канала: ${formattedChatId}`, 'social-publishing');
      }
      
      // Подготавливаем данные формы
      const formData = new FormData();
      formData.append('chat_id', formattedChatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      formData.append('disable_notification', 'false');
      
      // Определяем, локальный файл или URL
      const isLocalFile = videoUrl.startsWith('/') || videoUrl.startsWith('./');
      
      if (isLocalFile) {
        log(`Отправка локального файла: ${videoUrl}`, 'social-publishing');
        
        // Если это путь к локальному файлу, проверяем его существование
        // В пути может отсутствовать ведущий слеш, нужно обработать оба варианта
        const possiblePaths = [
          videoUrl,
          videoUrl.startsWith('/') ? `.${videoUrl}` : `/${videoUrl}`,
          videoUrl.startsWith('.') ? videoUrl : `./${videoUrl}`
        ];
        
        let fileFound = false;
        
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            // Если файл существует, читаем его и добавляем в форму
            const videoBuffer = fs.readFileSync(possiblePath);
            const fileName = path.basename(possiblePath);
            
            formData.append('video', videoBuffer, { filename: fileName });
            log(`Видео найдено и прочитано: ${possiblePath}, размер: ${videoBuffer.length} байт`, 'social-publishing');
            fileFound = true;
            break;
          }
        }
        
        if (!fileFound) {
          log(`Локальный файл не найден: проверены пути ${possiblePaths.join(', ')}`, 'social-publishing');
          return { success: false, error: 'Локальный файл не найден' };
        }
      } else {
        // Если это URL, добавляем его напрямую
        log(`Отправка видео по URL: ${videoUrl}`, 'social-publishing');
        formData.append('video', videoUrl);
      }
      
      // Отправляем запрос
      const response = await axios.post(apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      
      // Проверяем успешность отправки
      if (response.status === 200 && response.data && response.data.ok) {
        const messageId = response.data.result.message_id;
        log(`Видео успешно отправлено в Telegram, messageId: ${messageId}`, 'social-publishing');
        return { success: true, messageId };
      } else {
        log(`Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        return { success: false, error: JSON.stringify(response.data) };
      }
    } catch (error: any) {
      log(`Исключение при отправке видео в Telegram: ${error.message}`, 'social-publishing');
      
      if (error.response) {
        log(`Ответ сервера: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        return { success: false, error: JSON.stringify(error.response.data) };
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Создает URL для сообщения в Telegram с учетом типа чата (канал, группа, приватный чат)
   * @param chatId Исходный ID чата
   * @param formattedChatId Форматированный ID чата для API запросов
   * @param messageId ID сообщения
   * @returns URL сообщения в Telegram
   */
  formatTelegramUrl(chatId: string, formattedChatId: string, messageId: number | string, chatUsername?: string): string {
    // Сохраняем username для использования в generatePostUrl
    if (chatUsername) {
      this.currentChatUsername = chatUsername;
    }
    log(`Форматирование Telegram URL: chatId=${chatId}, formattedChatId=${formattedChatId}, messageId=${messageId}, username=${chatUsername || 'не указан'}`, 'social-publishing');
    
    // В соответствии с требованиями, messageId должен всегда присутствовать в URL
    if (!messageId) {
      log(`ОШИБКА: messageId не указан при формировании URL - это недопустимо`, 'social-publishing');
      throw new Error('MessageId is required for Telegram URL formation');
    }
    
    // Если известен username чата, используем его (для публичных каналов и групп)
    if (chatUsername || (chatId && chatId.startsWith('@'))) {
      const username = chatUsername || chatId.substring(1);
      return `https://t.me/${username}/${messageId}`;
    }
    
    // Для каналов и супергрупп с ID вида -100XXXXXX
    if (formattedChatId.startsWith('-100')) {
      // Удаляем префикс -100 для URL
      const channelId = formattedChatId.substring(4);
      return `https://t.me/c/${channelId}/${messageId}`;
    }
    
    // Для групп с ID вида -XXXXXX (не супергруппы)
    if (formattedChatId.startsWith('-')) {
      // Удаляем только минус для URL
      const groupId = formattedChatId.substring(1);
      return `https://t.me/c/${groupId}/${messageId}`;
    }
    
    // Для личных чатов - такой URL не будет работать как ссылка, но формально он правильный
    return `https://t.me/c/${formattedChatId}/${messageId}`;
  }
  
  /**
   * Отправляет текстовое сообщение в Telegram
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @param text Текст сообщения
   * @returns Результат отправки
   */
  private async sendMessageToTelegram(
    chatId: string,
    token: string,
    text: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      log(`Отправка текстового сообщения в Telegram, чат ${chatId}`, 'social-publishing');
      
      // Формируем URL запроса
      const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      
      // Проверяем валидность chat_id
      let formattedChatId = chatId;
      if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
        formattedChatId = `-100${formattedChatId}`;
        log(`Преобразован chatId для канала: ${formattedChatId}`, 'social-publishing');
      }
      
      // Подготавливаем данные запроса
      const data = {
        chat_id: formattedChatId,
        text: text,
        parse_mode: 'HTML',
        disable_notification: false
      };
      
      // Отправляем запрос
      const response = await axios.post(apiUrl, data);
      
      // Проверяем успешность отправки
      if (response.status === 200 && response.data && response.data.ok) {
        const messageId = response.data.result.message_id;
        log(`Сообщение успешно отправлено в Telegram, messageId: ${messageId}`, 'social-publishing');
        return { success: true, messageId };
      } else {
        log(`Ошибка при отправке сообщения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        return { success: false, error: JSON.stringify(response.data) };
      }
    } catch (error: any) {
      log(`Исключение при отправке сообщения в Telegram: ${error.message}`, 'social-publishing');
      
      if (error.response) {
        log(`Ответ сервера: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        return { success: false, error: JSON.stringify(error.response.data) };
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Публикует контент в Telegram с поддержкой изображений и видео
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: { token: string; chatId: string }
  ): Promise<SocialPublication> {
    try {
      log(`Публикация контента ${content.id} в Telegram`, 'social-publishing');
      
      // Проверяем наличие необходимых полей в настройках
      if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
        log(`Ошибка: отсутствуют обязательные поля в настройках Telegram`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствуют обязательные поля в настройках Telegram'
        };
      }
      
      // Получаем данные из настроек
      const { token, chatId } = telegramSettings;
      
      // Форматируем текст для Telegram
      const formattedText = this.formatTextForTelegram(content.content || '');
      
      // Проверяем наличие изображения
      const hasImage = Boolean(content.imageUrl && content.imageUrl.trim() !== '');
      
      // Проверяем наличие видео
      const hasVideo = Boolean(content.videoUrl && content.videoUrl.trim() !== '');
      
      log(`Контент для Telegram: hasVideo=${hasVideo}, hasImage=${hasImage}, textLength=${formattedText.length}`, 'social-publishing');
      
      let result;
      
      // Приоритет 1: Если есть видео, отправляем его с подписью
      if (hasVideo) {
        log(`Отправка видео в Telegram: ${content.videoUrl}`, 'social-publishing');
        result = await this.sendVideoToTelegram(
          chatId,
          token,
          content.videoUrl as string,
          formattedText
        );
      }
      // Приоритет 2: Если есть изображение, отправляем его с подписью
      else if (hasImage) {
        log(`Отправка изображения в Telegram пока не обрабатывается в этом патче`, 'social-publishing');
        // Временное решение для демонстрации: отправляем просто текст
        result = await this.sendMessageToTelegram(
          chatId,
          token,
          formattedText
        );
      }
      // Приоритет 3: Если нет ни видео, ни изображения, отправляем просто текст
      else {
        log(`Отправка текстового сообщения в Telegram`, 'social-publishing');
        result = await this.sendMessageToTelegram(
          chatId,
          token,
          formattedText
        );
      }
      
      // Проверяем результат отправки
      if (result && result.success && result.messageId) {
        // Формируем URL публикации
        let formattedChatId = chatId;
        if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
          formattedChatId = `-100${formattedChatId}`;
        }
        
        const postUrl = this.formatTelegramUrl(chatId, formattedChatId, result.messageId);
        
        log(`Контент успешно опубликован в Telegram: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postUrl,
          messageId: result.messageId.toString()
        };
      } else {
        log(`Ошибка при публикации в Telegram: ${result?.error || 'Неизвестная ошибка'}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: result?.error || 'Ошибка при публикации в Telegram'
        };
      }
    } catch (error: any) {
      log(`Исключение при публикации в Telegram: ${error.message}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка: ${error.message}`
      };
    }
  }
  
  /**
   * Обновляет статус публикации в Telegram в базе данных
   * @param contentId ID контента
   * @param publicationResult Результат публикации
   * @returns Обновленный контент
   */
  async updatePublicationStatus(
    contentId: string,
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    try {
      log(`Обновление статуса публикации в Telegram для контента ${contentId}`, 'social-publishing');
      
      // Получаем системный токен для доступа к API
      const token = await this.getSystemToken();
      if (!token) {
        log(`Ошибка: не удалось получить системный токен`, 'social-publishing');
        return null;
      }
      
      // Получаем текущий контент из хранилища
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        log(`Ошибка: контент с ID ${contentId} не найден`, 'social-publishing');
        return null;
      }
      
      // Обновляем статус публикации в поле socialPlatforms
      const updatedContent = {
        ...content,
        socialPlatforms: {
          ...(content.socialPlatforms || {}),
          telegram: publicationResult
        }
      };
      
      // Сохраняем обновленный контент
      const savedContent = await storage.updateCampaignContent(contentId, updatedContent);
      
      log(`Статус публикации в Telegram обновлен для контента ${contentId}`, 'social-publishing');
      
      return savedContent;
    } catch (error: any) {
      log(`Ошибка при обновлении статуса публикации в Telegram: ${error.message}`, 'social-publishing');
      return null;
    }
  }
}

// Экспортируем экземпляр сервиса
export const telegramServiceFix = new TelegramService(new DirectusAuthManager());