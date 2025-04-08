import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

// Константы для Telegram
const MAX_CAPTION_LENGTH = 1024; // Максимальная длина подписи для изображений в Telegram
const MAX_MESSAGE_LENGTH = 4096; // Максимальная длина сообщения в Telegram
const SMALL_MESSAGE_THRESHOLD = 1000; // Порог для определения "маленьких" сообщений
const MAX_MEDIA_GROUP_SIZE = 10; // Максимальное количество изображений в медиагруппе

/**
 * Сервис для публикации контента в Telegram с поддержкой корректного HTML-форматирования
 * и обработкой длинных сообщений
 */
export class TelegramService extends BaseSocialService {
  // Храним username канала, полученный в процессе публикации
  private currentChatUsername?: string;
  
  // Настройки для отправки сообщений
  private settings?: {
    token: string;
    chatId: string;
  };
  
  /**
   * Инициализирует настройки для отправки сообщений в Telegram
   * @param token Токен бота Telegram
   * @param chatId ID чата Telegram
   */
  public initialize(token: string, chatId: string): void {
    this.settings = { token, chatId };
    log(`Инициализированы настройки Telegram: chatId=${chatId}`, 'telegram');
  }
  
  /**
   * Отправляет HTML-форматированный текст напрямую в Telegram без дополнительной обработки
   * @param text HTML-текст для отправки
   * @param chatId ID чата Telegram (опционально, если не задан, используется из настроек)
   * @param token Токен бота Telegram (опционально, если не задан, используется из настроек)
   * @returns Результат отправки сообщения
   */
  /**
   * Исправляет незакрытые HTML-теги в тексте
   * @param text HTML-текст, который может содержать незакрытые теги
   * @returns HTML-текст с исправленными (закрытыми) тегами
   */
  private fixUnclosedHtmlTags(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Массив поддерживаемых Telegram HTML-тегов
    const supportedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a'];
    
    // Стек для отслеживания открытых тегов
    const openTags: string[] = [];
    
    // Регулярное выражение для поиска HTML-тегов
    const tagRegex = /<\/?([a-z0-9]+)(?:\s+[^>]*)?>/gi;
    
    // Заменяем неправильные теги
    let processedText = text.replace(tagRegex, (match, tagName) => {
      // Приводим имя тега к нижнему регистру для сравнения
      const lowerTagName = tagName.toLowerCase();
      
      // Если это не поддерживаемый Telegram тег, просто удаляем его
      if (!supportedTags.includes(lowerTagName)) {
        return '';
      }
      
      // Проверяем, открывающий или закрывающий тег
      if (match.startsWith('</')) {
        // Если это закрывающий тег
        // Ищем соответствующий открывающий тег в стеке
        const index = openTags.lastIndexOf(lowerTagName);
        
        if (index !== -1) {
          // Удаляем из стека все теги до найденного
          openTags.splice(index);
          return match; // Возвращаем тег без изменений
        } else {
          // Если не нашли открывающий тег, удаляем лишний закрывающий
          return '';
        }
      } else {
        // Если это открывающий тег
        // Для тега <a> проверяем, что есть атрибут href
        if (lowerTagName === 'a' && !match.includes('href=')) {
          return ''; // Удаляем тег <a> без href
        }
        
        // Добавляем тег в стек открытых тегов
        openTags.push(lowerTagName);
        return match; // Возвращаем тег без изменений
      }
    });
    
    // Закрываем все оставшиеся открытые теги в обратном порядке
    let closingTags = '';
    for (let i = openTags.length - 1; i >= 0; i--) {
      // Не закрываем теги <a> автоматически, т.к. они требуют правильного атрибута href
      if (openTags[i] !== 'a') {
        closingTags += `</${openTags[i]}>`;
      }
    }
    
    return processedText + closingTags;
  }

  public async sendRawHtmlToTelegram(text: string): Promise<any>;
  public async sendRawHtmlToTelegram(text: string, chatId: string): Promise<any>;
  public async sendRawHtmlToTelegram(text: string, chatId: string, token: string): Promise<any>;
  public async sendRawHtmlToTelegram(text: string, chatId?: string, token?: string): Promise<any> {
    // Используем настройки класса, если не заданы явно
    const actualChatId = chatId || this.settings?.chatId;
    const actualToken = token || this.settings?.token;
    
    // Проверяем наличие настроек
    if (!actualChatId || !actualToken) {
      log('Отсутствуют настройки для отправки сообщения в Telegram (chatId или token)', 'telegram');
      return { success: false, error: 'Missing settings (chatId or token)' };
    }
    try {
      if (!text || text.trim() === '') {
        log(`Пустой текст для отправки в Telegram`, 'telegram');
        return { success: false, error: 'Empty text' };
      }
      
      // Используем более агрессивное исправление незакрытых HTML-тегов
      const fixedText = this.aggressiveTagFixer(text);
      
      log(`Отправка необработанного HTML-текста в Telegram (${fixedText.length} символов)`, 'telegram');
      log(`Первые 100 символов: ${fixedText.substring(0, Math.min(100, fixedText.length))}...`, 'telegram');
      
      // Форматируем chatId, если нужно
      let formattedChatId = actualChatId;
      if (!actualChatId.startsWith('-100') && !isNaN(Number(actualChatId)) && !actualChatId.startsWith('@')) {
        formattedChatId = `-100${actualChatId}`;
      }
      
      // Отправляем запрос напрямую к API Telegram
      const url = `https://api.telegram.org/bot${actualToken}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: formattedChatId,
        text: fixedText,
        parse_mode: 'HTML'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
      });
      
      // Расширенное логирование ответа
      log(`Ответ от Telegram API: код ${response.status}, body: ${JSON.stringify(response.data)}`, 'telegram');
      
      if (response.status === 200 && response.data && response.data.ok) {
        const messageId = response.data.result.message_id;
        const messageUrl = this.formatTelegramUrl(actualChatId, formattedChatId, messageId);
        
        log(`Сообщение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        log(`URL сообщения: ${messageUrl}`, 'telegram');
        
        return {
          success: true,
          messageId,
          messageUrl,
          result: response.data.result
        };
      } else {
        const errorMessage = response.data?.description || 'Unknown error';
        log(`Ошибка при отправке HTML-текста в Telegram: ${errorMessage}`, 'telegram');
        
        return {
          success: false,
          error: errorMessage,
          status: response.status,
          data: response.data
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      log(`Исключение при отправке HTML-текста в Telegram: ${errorMessage}`, 'telegram');
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  /**
   * Форматирует текст для публикации в Telegram с учетом поддерживаемых HTML-тегов
   * @param content Исходный текст контента
   * @returns Отформатированный текст для Telegram с поддержкой HTML
   */
  public formatTextForTelegram(content: string): string {
    // Логируем начало обработки
    log(`Начало форматирования текста для Telegram, размер: ${content?.length || 0} символов`, 'social-publishing');
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Сохраняем исходный текст для логирования
    const originalLength = content.length;
    
    try {
      // Используем улучшенный обработчик HTML для Telegram из shared/telegram-html-processor.js
      // Импортируем модуль и используем функцию processHtmlForTelegram, которая обеспечивает:
      // - Правильную обработку вложенных списков
      // - Конвертацию заголовков в жирный текст
      // - Сохранение отступов и структуры списков
      // - Обработку сложных случаев с вложенными разнотипными списками
      const { processHtmlForTelegram } = require('../../../shared/telegram-html-processor');
      
      log(`Форматирование текста для Telegram с использованием улучшенного процессора, исходная длина: ${originalLength} символов`, 'social-publishing');
      
      // Используем улучшенную функцию обработки HTML
      let formattedText = processHtmlForTelegram(content, { debug: true });
      
      // Удаление невидимых символов (сохраняем для совместимости)
      formattedText = formattedText
        .replace(/\u200B/g, '') // Zero-width space
        .replace(/\u200C/g, '') // Zero-width non-joiner
        .replace(/\u200D/g, '') // Zero-width joiner
        .replace(/\uFEFF/g, ''); // Zero-width no-break space
      
      // Проверка на длинные слова
      const longWordsFound = formattedText.match(/[^\s]{100,}/g);
      if (longWordsFound && longWordsFound.length > 0) {
        log(`Предупреждение: найдены очень длинные слова (>100 символов), которые могут вызвать проблемы в Telegram: ${longWordsFound.length} шт.`, 'social-publishing');
      }
      
      // Обрезаем текст до 4096 символов (максимальное количество для Telegram)
      if (formattedText.length > 4096) {
        formattedText = formattedText.substring(0, 4093) + '...';
        log(`Предупреждение: текст для Telegram был обрезан до 4096 символов (исходный: ${originalLength})`, 'social-publishing');
      }
      
      // Отладочный вывод образцов отформатированного текста
      if (formattedText.length > 0) {
        log(`Отформатированный текст для Telegram (${formattedText.length} символов) начинается с: ${formattedText.substring(0, Math.min(100, formattedText.length))}...`, 'social-publishing');
      }
      
      return formattedText;
      
    } catch (error) {
      log(`Ошибка при форматировании текста для Telegram: ${error}`, 'social-publishing');
      // В случае ошибки пробуем использовать старый метод форматирования
      try {
        // Используем исходный контент HTML
        let cleanedContent = content;
        
        // Сразу начинаем обработку HTML
        let formattedText = cleanedContent;
          
        // Обработка многострочных блочных элементов
        formattedText = formattedText
          // Преобразуем разрывы строк
          .replace(/<br\s*\/?>/gi, '\n')
          // Двойной проход с использованием выражений для поддержки многострочных тегов
          .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
          .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
          .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
          
          // Преобразуем все остальные блочные элементы
          .replace(/<(?:article|section|aside|header|footer|nav|main)[^>]*>([\s\S]*?)<\/(?:article|section|aside|header|footer|nav|main)>/gi, '$1\n')
          
          // Обработка списков
          .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
          .replace(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi, '$1\n')
          
          // Обработка таблиц
          .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '$1\n')
          .replace(/<(?:table|thead|tbody|tfoot)[^>]*>([\s\S]*?)<\/(?:table|thead|tbody|tfoot)>/gi, '$1\n\n')
          
          // Приводим HTML-теги к поддерживаемым в Telegram форматам
          .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
          .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '<b>$1</b>')
          .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
          .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '<i>$1</i>')
          .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
          .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
          .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '<s>$1</s>')
          .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
          .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>')
          .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>')
          .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>')
          
          // Обрабатываем ссылки по формату Telegram
          .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1">$2</a>');
        
        // Убираем лишние переносы строк (более 2 подряд)
        formattedText = formattedText.replace(/\n{3,}/g, '\n\n');
        
        // Сохраняем поддерживаемые HTML-теги и удаляем только неподдерживаемые
        formattedText = formattedText.replace(/<(?!\/?(?:b|i|u|s|code|pre|a\b)[^>]*>)[^>]+>/gi, '');
        
        // Обрезаем текст до 4096 символов (максимальное количество для Telegram)
        if (formattedText.length > 4096) {
          formattedText = formattedText.substring(0, 4093) + '...';
        }
        
        return formattedText;
      } catch (fallbackError) {
        log(`Ошибка при резервном форматировании текста для Telegram: ${fallbackError}`, 'social-publishing');
        // В случае всех ошибок возвращаем обычный текст без форматирования
        if (content.length > 4096) {
          return content.substring(0, 4093) + '...';
        }
        return content;
      }
    }
  }
  
  /**
   * Проверяет, является ли HTML-код валидным для Telegram
   * @param text Текст с HTML-разметкой
   * @returns true, если HTML валиден для Telegram
   */
  public isValidHtmlForTelegram(text: string): boolean {
    // Если текст не содержит HTML, считаем его валидным
    if (!text.includes('<') || !text.includes('>')) {
      return true;
    }
    
    // Проверяем количество открывающих и закрывающих тегов
    const openTagRegex = /<(b|strong|i|em|u|ins|s|strike|del|code|pre|a)(?:\s+[^>]*)?>/gi;
    const closeTagRegex = /<\/(b|strong|i|em|u|ins|s|strike|del|code|pre|a)>/gi;
    
    const openMatches = text.match(openTagRegex) || [];
    const closeMatches = text.match(closeTagRegex) || [];
    
    // Если количество не совпадает, значит есть незакрытые теги
    if (openMatches.length !== closeMatches.length) {
      log(`HTML не валиден для Telegram: открывающих тегов ${openMatches.length}, закрывающих ${closeMatches.length}`, 'social-publishing');
      return false;
    }
    
    // Проверяем наличие неподдерживаемых тегов
    const unsupportedTagRegex = /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|code|pre|a))[a-z][^>]*>/gi;
    const unsupportedMatches = text.match(unsupportedTagRegex) || [];
    
    if (unsupportedMatches.length > 0) {
      log(`HTML содержит неподдерживаемые Telegram теги: ${unsupportedMatches.slice(0, 5).join(', ')}${unsupportedMatches.length > 5 ? '...' : ''}`, 'social-publishing');
      return false;
    }
    
    // Базовая проверка на корректное вложение тегов (в идеале нужен полноценный парсер)
    // Но для простых случаев это может быть достаточно
    return true;
  }
  
  /**
   * Исправляет незакрытые HTML-теги в тексте для Telegram
   * @param text Текст с HTML-разметкой
   * @returns Текст с исправленными незакрытыми тегами
   */
  public fixUnclosedTags(text: string): string {
    // Подробное логирование входных данных
    log(`[HTML DEBUG] Входной текст для fixUnclosedTags (${text.length} символов): ${text.substring(0, 100)}...`, 'telegram-html');
    
    if (!text || !text.includes('<') || !text.includes('>')) {
      log(`[HTML DEBUG] Текст не содержит HTML-тегов, возвращаем без изменений`, 'telegram-html');
      return text;
    }
    
    // Список поддерживаемых в Telegram тегов
    const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
    
    // Соответствие тегов (стандартизация)
    const tagMapping: { [key: string]: string } = {
      'strong': 'b',
      'em': 'i',
      'ins': 'u',
      'strike': 's',
      'del': 's'
    };
    
    // Проверка поддерживаемости тега
    const isSupportedTag = (tag: string): boolean => {
      return supportedTags.includes(tag.toLowerCase());
    };
    
    // Стандартизация имени тега
    const standardizeTagName = (tag: string): string => {
      const lowerTag = tag.toLowerCase();
      return tagMapping[lowerTag] || lowerTag;
    };
    
    // Регулярное выражение для поиска всех HTML-тегов
    const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
    
    // Стек для отслеживания открытых тегов
    const openTags: string[] = [];
    
    // Для отладки - подсчет тегов до обработки
    const openingTagsCount = (text.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi) || []).length;
    const closingTagsCount = (text.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
    log(`[HTML DEBUG] Исходное количество тегов: открывающие=${openingTagsCount}, закрывающие=${closingTagsCount}`, 'telegram-html');
    
    // Результирующий текст
    let result = '';
    let lastIndex = 0;
    let match;
    
    // Обрабатываем каждый тег
    while ((match = tagRegex.exec(text)) !== null) {
      // Добавляем текст до тега
      result += text.substring(lastIndex, match.index);
      lastIndex = match.index + match[0].length;
      
      // Получаем имя тега
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const isClosingTag = fullTag.startsWith('</');
      
      // Логируем для отладки
      log(`[HTML DEBUG] Найден тег: ${fullTag}, поддерживается: ${isSupportedTag(tagName)}`, 'telegram-html');
      
      // Если тег не поддерживается Telegram, его нужно удалить
      if (!isSupportedTag(tagName)) {
        log(`[HTML DEBUG] Пропускаем неподдерживаемый тег: ${fullTag}`, 'telegram-html');
        continue;
      }
      
      // Стандартизированное имя тега
      const standardTag = standardizeTagName(tagName);
      
      if (isClosingTag) {
        // Обработка закрывающего тега
        const matchingOpenTagIndex = openTags.lastIndexOf(standardTag);
        
        if (matchingOpenTagIndex !== -1) {
          // Если есть соответствующий открывающий тег, закрываем его
          // и все теги, открытые после него (для корректного вложения)
          for (let i = openTags.length - 1; i >= matchingOpenTagIndex; i--) {
            result += `</${openTags[i]}>`;
          }
          
          // Удаляем из стека все закрытые теги
          openTags.splice(matchingOpenTagIndex);
          
          // Восстанавливаем все незакрытые теги
          for (let i = matchingOpenTagIndex - 1; i >= 0; i--) {
            result += `<${openTags[i]}>`;
          }
        } else {
          // Если нет соответствующего открывающего тега, игнорируем этот закрывающий тег
          log(`[HTML DEBUG] Игнорируем закрывающий тег без соответствующего открывающего: ${fullTag}`, 'telegram-html');
        }
      } else {
        // Обработка открывающего тега
        if (tagName === 'a') {
          // Для тегов ссылок сохраняем href
          const hrefMatch = fullTag.match(/href=["']([^"']*)["']/i);
          const href = hrefMatch ? hrefMatch[1] : '';
          result += `<a href="${href}">`;
        } else {
          // Используем стандартную форму для других тегов
          result += `<${standardTag}>`;
        }
        
        // Добавляем тег в стек открытых
        openTags.unshift(standardTag);
      }
    }
    
    // Добавляем оставшийся текст
    result += text.substring(lastIndex);
    
    // Закрываем все оставшиеся открытые теги
    if (openTags.length > 0) {
      log(`[HTML DEBUG] Закрываем оставшиеся открытые теги: ${openTags.join(', ')}`, 'telegram-html');
      for (const tag of openTags) {
        result += `</${tag}>`;
      }
    }
    
    // Финальная проверка форматирования
    const finalOpeningTagsCount = (result.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi) || []).length;
    const finalClosingTagsCount = (result.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
    log(`[HTML DEBUG] Итоговое количество тегов: открывающие=${finalOpeningTagsCount}, закрывающие=${finalClosingTagsCount}`, 'telegram-html');
    
    // Проверка на изменения
    if (result !== text) {
      log(`[HTML DEBUG] Текст исправлен. Результат (${result.length} символов): ${result.substring(0, 100)}...`, 'telegram-html');
    } else {
      log(`[HTML DEBUG] Текст не изменен`, 'telegram-html');
    }
    
    return result;
  }

  /**
   * Делит длинный текст на части, соблюдая целостность форматирования 
   * и учитывая ограничения Telegram по максимальной длине сообщения
   * @param text Исходный текст (может содержать HTML-теги)
   * @param maxChunkSize Максимальный размер одной части (по умолчанию 4000 символов)
   * @returns Массив частей текста с корректно закрытыми HTML-тегами
   */
  private splitLongText(text: string, maxChunkSize: number = 4000): string[] {
    if (!text || text.length <= maxChunkSize) {
      return [text];
    }
    
    // Результирующий массив частей
    const chunks: string[] = [];
    // Оставшийся текст для обработки
    let remainingText = text;
    
    while (remainingText.length > 0) {
      // Если оставшийся текст короче максимального размера части, просто добавляем его
      if (remainingText.length <= maxChunkSize) {
        chunks.push(remainingText);
        break;
      }
      
      // Ищем хорошее место для разделения (конец предложения или абзаца)
      // Стараемся найти точку, за которой следует пробел или перенос строки
      let cutIndex = remainingText.substring(0, maxChunkSize).lastIndexOf('. ');
      if (cutIndex === -1 || cutIndex < maxChunkSize * 0.5) {
        // Если точка не найдена или она слишком близко к началу,
        // используем последний перенос строки
        cutIndex = remainingText.substring(0, maxChunkSize).lastIndexOf('\n');
      }
      
      if (cutIndex === -1 || cutIndex < maxChunkSize * 0.5) {
        // Если не нашли хорошее место, ищем последний пробел
        cutIndex = remainingText.substring(0, maxChunkSize).lastIndexOf(' ');
      }
      
      // Если не нашли подходящее место, просто разрезаем по максимальной длине
      if (cutIndex === -1 || cutIndex < maxChunkSize * 0.5) {
        cutIndex = maxChunkSize - 1;
      }
      
      // Получаем текущую часть текста
      let currentChunk = remainingText.substring(0, cutIndex + 1);
      
      // Проверяем наличие незакрытых тегов в текущей части
      const openTags: string[] = [];
      const openTagMatches = currentChunk.matchAll(/<([a-z][^>\s]*)[^>]*>/gi);
      const closedTagMatches = currentChunk.matchAll(/<\/([a-z][^>\s]*)[^>]*>/gi);
      
      // Собираем все открывающие теги
      for (const match of openTagMatches) {
        const tagName = match[1].toLowerCase();
        openTags.push(tagName);
      }
      
      // Удаляем закрытые теги
      for (const match of closedTagMatches) {
        const tagName = match[1].toLowerCase();
        const index = openTags.lastIndexOf(tagName);
        if (index !== -1) {
          openTags.splice(index, 1);
        }
      }
      
      // Если остались незакрытые теги, закрываем их в конце текущей части
      // и открываем в начале следующей части
      if (openTags.length > 0) {
        // Закрываем теги в обратном порядке
        for (let i = openTags.length - 1; i >= 0; i--) {
          currentChunk += `</${openTags[i]}>`;
        }
      }
      
      // Добавляем текущую часть в результат
      chunks.push(currentChunk);
      
      // Обновляем оставшийся текст
      remainingText = remainingText.substring(cutIndex + 1);
      
      // Если остались незакрытые теги, добавляем их в начало оставшегося текста
      if (openTags.length > 0) {
        // Открываем теги в прямом порядке
        for (let i = 0; i < openTags.length; i++) {
          remainingText = `<${openTags[i]}>` + remainingText;
        }
      }
    }
    
    return chunks;
  }

  /**
   * Подготавливает текст для отправки в Telegram: форматирует и обрезает при необходимости
   * @param content Исходный текст контента
   * @param maxLength Максимальная длина текста (по умолчанию 4000 для защиты от превышения лимита в 4096)
   * @returns Отформатированный и обрезанный текст для Telegram
   */
  private prepareTelegramText(content: string, maxLength: number = 4000): string {
    try {
      // Применяем HTML-форматирование для Telegram
      let formattedText = this.formatTextForTelegram(content);
      
      // Дополнительно применяем исправитель тегов для гарантированного закрытия всех тегов
      formattedText = this.fixUnclosedTags(formattedText);
      log(`Telegram текст после исправления тегов: ${formattedText.substring(0, Math.min(100, formattedText.length))}...`, 'telegram');
      
      // Подсчитываем открывающие/закрывающие теги для диагностики
      const openingTags = (formattedText.match(/<[a-z][^>]*>/gi) || []).length;
      const closingTags = (formattedText.match(/<\/[a-z][^>]*>/gi) || []).length;
      log(`Теги в тексте после обработки: открывающих ${openingTags}, закрывающих ${closingTags}`, 'telegram');
      
      if (openingTags !== closingTags) {
        log(`Внимание: количество открывающих (${openingTags}) и закрывающих (${closingTags}) HTML-тегов не совпадает. Исправляем...`, 'telegram');
        // Дополнительная коррекция - повторно применяем исправитель
        formattedText = this.fixUnclosedTags(formattedText);
      }
      
      // Проверка длины и обрезка
      if (formattedText.length > maxLength) {
        log(`Текст для Telegram превышает ${maxLength} символов, обрезаем...`, 'telegram');
        
        // Находим ближайший конец предложения для более аккуратной обрезки
        const sentenceEndPos = formattedText.substring(0, maxLength - 3).lastIndexOf('.');
        const paragraphEndPos = formattedText.substring(0, maxLength - 3).lastIndexOf('\n');
        
        const cutPosition = Math.max(
          sentenceEndPos > maxLength - 200 ? sentenceEndPos + 1 : 0, 
          paragraphEndPos > maxLength - 200 ? paragraphEndPos + 1 : 0,
          maxLength - 3
        );
        
        formattedText = formattedText.substring(0, cutPosition) + '...';
        log(`Текст обрезан до ${formattedText.length} символов`, 'telegram');
      }
      
      return formattedText;
    } catch (error) {
      log(`Ошибка при подготовке текста для Telegram: ${error}`, 'telegram');
      
      // В случае ошибки возвращаем простой обрезанный текст
      if (content && content.length > maxLength) {
        return content.substring(0, maxLength - 3) + '...';
      }
      return content || '';
    }
  }
  
  /**
   * Получает общий URL приложения из переменных окружения
   * @returns URL приложения или значение по умолчанию
   */
  private getAppBaseUrl(): string {
    const baseUrl = process.env.BASE_URL || process.env.VITE_APP_URL || 'https://workspace-dzhdanov1985.replit.app';
    return baseUrl;
  }
  
  /**
   * Получает информацию о чате Telegram
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @returns Информация о чате
   */
  private async getChatInfo(chatId: string, token: string): Promise<any> {
    try {
      const formattedChatId = chatId.startsWith('@') ? chatId : chatId;
      const url = `https://api.telegram.org/bot${token}/getChat`;
      const response = await axios.post(url, { chat_id: formattedChatId });
      
      if (response.data && response.data.ok && response.data.result) {
        log(`Получена информация о чате Telegram: ${JSON.stringify(response.data.result)}`, 'telegram');
        return response.data.result;
      } else {
        log(`Не удалось получить информацию о чате: ${JSON.stringify(response.data)}`, 'telegram');
        return null;
      }
    } catch (error: any) {
      log(`Ошибка при получении информации о чате: ${error.message}`, 'telegram');
      return null;
    }
  }
  
  /**
   * Генерирует URL для сообщения в Telegram
   * @param chatId ID чата (может быть ID или username с @)
   * @param numericChatId Числовой ID чата (для случаев без username)
   * @param messageId ID сообщения
   * @returns URL сообщения
   */
  private generatePostUrl(chatId: string, numericChatId: string, messageId: string | number): string {
    // Если у нас есть сохраненный username чата, используем его
    if (this.currentChatUsername) {
      return `https://t.me/${this.currentChatUsername}/${messageId}`;
    }
    
    // Если chatId начинается с @, это username
    if (chatId.startsWith('@')) {
      const username = chatId.substring(1); // Убираем @
      return `https://t.me/${username}/${messageId}`;
    }
    
    // В остальных случаях используем ссылку на приватный чат
    return `https://t.me/c/${numericChatId.replace(/^-100/, '')}/${messageId}`;
  }

  /**
   * Создает и отправляет текстовое сообщение в Telegram
   * @param text Текст для отправки
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @returns Результат отправки сообщения
   */
  private async sendTextMessageToTelegram(text: string, chatId: string, token: string): Promise<any> {
    try {
      // Дополнительно проверяем длину текста
      if (!text || text.trim() === '') {
        log(`Пустой текст для отправки в Telegram`, 'social-publishing');
        return { success: false, error: 'Empty text' };
      }
      
      // Сначала форматируем текст для Telegram включая обработку HTML тегов
      let formattedText = this.formatTextForTelegram(text);
      
      // Дополнительно применяем агрессивный исправитель тегов
      // для гарантированного закрытия всех тегов
      formattedText = this.aggressiveTagFixer(formattedText);
      log(`Текст после агрессивного исправления тегов перед отправкой: ${formattedText.substring(0, Math.min(100, formattedText.length))}...`, 'social-publishing');
      
      // Проверяем длину после форматирования
      const finalText = formattedText.length > 4096 ? formattedText.substring(0, 4093) + '...' : formattedText;
      
      // Преобразуем текст с HTML-тегами, если он есть
      if (finalText.includes('<') && finalText.includes('>')) {
        log(`Обнаружены HTML-теги в тексте для Telegram, длина: ${finalText.length}`, 'social-publishing');
      } else {
        // Для обычного текста без HTML-тегов дополнительные проверки не требуются
        log(`Обычный текст без HTML-тегов для Telegram, длина: ${finalText.length}`, 'social-publishing');
      }
      
      // Подготавливаем тело запроса для API Telegram
      const messageBody = {
        chat_id: chatId,
        text: finalText,
        parse_mode: 'HTML',
        protect_content: false, // Защита контента (можно настроить)
        disable_notification: false // Отключение уведомлений (можно настроить)
      };
      
      // Отправляем запрос в API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      const response = await axios.post(`${baseUrl}/sendMessage`, messageBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000, // Увеличенный таймаут
        validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
      });
      
      // Обрабатываем ответ
      if (response.status === 200 && response.data && response.data.ok) {
        log(`Сообщение успешно отправлено в Telegram, message_id: ${response.data?.result?.message_id}`, 'social-publishing');
        return { success: true, result: response.data?.result };
      } else {
        log(`Ошибка при отправке сообщения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        
        // Если ошибка связана с HTML-тегами, пробуем исправить их и отправить снова
        if (response.data?.description?.includes("can't parse entities") || 
            response.data?.description?.includes("can't find end tag") ||
            response.data?.description?.includes("Bad Request") && finalText.includes('<')) {
          
          log(`Ошибка при отправке HTML-форматированного текста: код ${response.status}, ${response.data?.description}`, 'social-publishing');
          
          // Пробуем агрессивно исправить HTML разметку
          const forceFixedHtml = this.aggressiveTagFixer(finalText);
          log(`Пробуем отправить с исправленным HTML-форматированием...`, 'social-publishing');
          
          const fixedMessageBody = {
            chat_id: chatId,
            text: forceFixedHtml,
            parse_mode: 'HTML',
            protect_content: false,
            disable_notification: false
          };
          
          try {
            const fixedResponse = await axios.post(`${baseUrl}/sendMessage`, fixedMessageBody, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000,
              validateStatus: () => true
            });
            
            if (fixedResponse.status === 200 && fixedResponse.data && fixedResponse.data.ok) {
              log(`Сообщение успешно отправлено после агрессивного исправления HTML, message_id: ${fixedResponse.data?.result?.message_id}`, 'social-publishing');
              return { success: true, result: fixedResponse.data?.result };
            } else {
              log(`Не удалось отправить сообщение даже после агрессивного исправления HTML: ${JSON.stringify(fixedResponse.data)}`, 'social-publishing');
            }
          } catch (fixError) {
            log(`Исключение при отправке исправленного HTML: ${fixError}`, 'social-publishing');
          }
        }
        
        // Если текст содержит HTML и произошла ошибка, пробуем отправить как обычный текст
        if (finalText.includes('<') && finalText.includes('>')) {
          log(`Пробуем отправить как обычный текст без HTML...`, 'social-publishing');
          
          // Удаляем все HTML-теги и создаем новое тело запроса
          const plainText = text.replace(/<[^>]*>/g, '');
          const plainMessageBody = {
            chat_id: chatId,
            text: plainText.length > 4096 ? plainText.substring(0, 4093) + '...' : plainText,
            protect_content: false,
            disable_notification: false
          , parse_mode: "HTML"};
          
          // Отправляем повторный запрос без HTML
          const plainResponse = await axios.post(`${baseUrl}/sendMessage`, plainMessageBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            validateStatus: () => true
          });
          
          if (plainResponse.status === 200 && plainResponse.data && plainResponse.data.ok) {
            log(`Сообщение успешно отправлено без HTML-форматирования, message_id: ${plainResponse.data?.result?.message_id}`, 'social-publishing');
            return { success: true, result: plainResponse.data?.result };
          } else {
            log(`Ошибка при отправке обычного текста: ${JSON.stringify(plainResponse.data)}`, 'social-publishing');
            return { success: false, error: plainResponse.data?.description || 'Failed to send plain text' };
          }
        }
        
        return { success: false, error: response.data?.description || 'Failed to send message' };
      }
    } catch (error) {
      log(`Исключение при отправке сообщения в Telegram: ${error}`, 'social-publishing');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Универсальный метод для отправки изображений в Telegram
   * @param chatId ID чата Telegram 
   * @param token Токен бота Telegram
   * @param images Массив URL изображений
   * @param baseUrl Базовый URL API Telegram
   * @param caption Текстовая подпись к изображениям (опционально)
   * @returns Результат отправки (успех/ошибка)
   */
  private async sendImagesToTelegram(
    chatId: string,
    token: string,
    images: string[],
    baseUrl: string,
    caption?: string
  ): Promise<{ success: boolean; error: string; messageId?: number; messageUrl?: string }> {
    try {
      if (!images || images.length === 0) {
        return { success: false, error: 'No images provided' };
      }
      
      let lastMessageId: number | undefined;
      
      // Если только одно изображение, отправляем его через sendPhoto
      if (images.length === 1) {
        log(`Отправка одного изображения через sendPhoto: ${images[0]}`, 'social-publishing');
        
        try {
          // Создаем объект запроса с дополнительными параметрами если есть подпись
          const requestBody: any = {
            chat_id: chatId,
            photo: images[0]
          , parse_mode: "HTML"};
          
          // Если есть текст подписи, добавляем его и форматируем
          if (caption && caption.trim() !== '') {
            // Форматируем подпись с помощью нашего метода для HTML-тегов
            let formattedCaption = this.formatTextForTelegram(caption);
            // Дополнительно применяем агрессивный исправитель тегов
            formattedCaption = this.aggressiveTagFixer(formattedCaption);
            log(`Подпись после агрессивного исправления тегов: ${formattedCaption.substring(0, Math.min(100, formattedCaption.length))}...`, 'social-publishing');
            requestBody.caption = formattedCaption;
            requestBody.parse_mode = 'HTML';
            log(`Добавляем форматированную текстовую подпись к изображению (${formattedCaption.length} символов)`, 'social-publishing');
          }
          
          const response = await axios.post(`${baseUrl}/sendPhoto`, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            validateStatus: () => true
          });
          
          if (response.status === 200 && response.data && response.data.ok) {
            lastMessageId = response.data.result.message_id;
            log(`Изображение успешно отправлено, message_id: ${lastMessageId}`, 'social-publishing');
            
            // Генерируем URL сообщения, учитывая username чата, если он известен
            const messageUrl = this.currentChatUsername 
              ? `https://t.me/${this.currentChatUsername}/${lastMessageId}`
              : `https://t.me/c/${chatId.replace('-100', '')}/${lastMessageId}`;
              
            return { 
              success: true, 
              error: '',  // Добавляем пустую строку для соответствия типу
              messageId: lastMessageId,
              messageUrl: messageUrl
            };
          } else {
            log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`, 'social-publishing');
            return { success: false, error: response.data?.description || 'Failed to send image' };
          }
        } catch (error) {
          log(`Исключение при отправке изображения: ${error}`, 'social-publishing');
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
      // Если несколько изображений, отправляем их через sendMediaGroup (до 10 штук)
      else {
        // Telegram ограничивает группы медиа до 10 элементов
        const chunks = [];
        for (let i = 0; i < images.length; i += 10) {
          chunks.push(images.slice(i, i + 10));
        }
        
        log(`Отправка ${images.length} изображений через sendMediaGroup (${chunks.length} групп)`, 'social-publishing');
        
        // Отправляем каждую группу изображений последовательно
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          try {
            // Создаем медиа-группу для API Telegram
            const media = chunk.map((img, index) => {
              // Проверяем, что изображение имеет URL
              const imageUrl = img && typeof img === 'string' ? img : '';
              if (!imageUrl) {
                log(`Предупреждение: пустой URL изображения в группе`, 'social-publishing');
              }
              
              // Добавляем подпись только к первому изображению в первой группе
              if (i === 0 && index === 0 && caption && caption.trim() !== '') {
                // Форматируем подпись с помощью нашего метода для HTML-тегов
                let formattedCaption = this.formatTextForTelegram(caption);
                // Дополнительно применяем агрессивный исправитель тегов
                formattedCaption = this.aggressiveTagFixer(formattedCaption);
                log(`Подпись к группе изображений после агрессивного исправления тегов: ${formattedCaption.substring(0, Math.min(100, formattedCaption.length))}...`, 'social-publishing');
                return {
                  type: 'photo',
                  media: imageUrl,
                  caption: formattedCaption,
                  parse_mode: 'HTML'
                };
              } else {
                return {
                  type: 'photo',
                  media: imageUrl
                };
              }
            });
            
            // Проверяем, что есть хотя бы одно корректное изображение
            if (media.length === 0 || !media.some(m => m.media)) {
              log(`Ошибка: нет корректных URL изображений для отправки в группе`, 'social-publishing');
              continue; // Пропускаем эту группу и переходим к следующей
            }
            
            const response = await axios.post(`${baseUrl}/sendMediaGroup`, {
              chat_id: chatId,
              media
            }, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000, // Увеличенный таймаут для группы
              validateStatus: () => true
            });
            
            if (response.status === 200 && response.data && response.data.ok) {
              // Сохраняем message_id последнего сообщения
              if (response.data.result && response.data.result.length > 0) {
                lastMessageId = response.data.result[0].message_id;
                log(`Группа изображений успешно отправлена, первый message_id: ${lastMessageId}`, 'social-publishing');
              }
            } else {
              log(`Ошибка при отправке группы изображений: ${JSON.stringify(response.data)}`, 'social-publishing');
              return { success: false, error: response.data?.description || 'Failed to send image group' };
            }
          } catch (error) {
            log(`Исключение при отправке группы изображений: ${error}`, 'social-publishing');
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          }
        }
        
        // Генерируем URL сообщения, учитывая username чата, если он известен
        const messageUrl = this.currentChatUsername 
          ? `https://t.me/${this.currentChatUsername}/${lastMessageId}`
          : `https://t.me/c/${chatId.replace('-100', '')}/${lastMessageId}`;
        
        // Если все группы успешно отправлены
        return { 
          success: true, 
          error: '',  // Добавляем пустую строку для соответствия типу
          messageId: lastMessageId,
          messageUrl: messageUrl
        };
      }
    } catch (error) {
      log(`Ошибка при отправке изображений в Telegram: ${error}`, 'social-publishing');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Получает информацию о чате в Telegram
   * @param chatId ID чата
   * @param token Токен бота
   * @returns Информация о чате или null в случае ошибки
   */
  private async getChatInfo(chatId: string, token: string): Promise<any | null> {
    try {
      log(`Запрос информации о чате: ${chatId}`, 'social-publishing');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Используем post чтобы быть совместимым с другими методами API и тестами
      const response = await axios.post(`${baseUrl}/getChat`, {
        chat_id: chatId
      }, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      // FIX: Улучшена обработка ответов API
      if (response.data && response.data.ok === true && response.data.result) {
        log(`Успешно получена информация о чате: ${JSON.stringify(response.data.result)}`, 'social-publishing');
        
        // Если в ответе есть username, сохраним его в свойстве экземпляра класса
        if (response.data.result.username) {
          this.currentChatUsername = response.data.result.username;
          log(`Сохранен username чата: ${this.currentChatUsername}`, 'social-publishing');
        }
        
        return response.data.result;
      } else {
        // Только в случае реальной ошибки выводим сообщение об ошибке
        log(`Ошибка API Telegram при получении информации о чате: ${JSON.stringify(response.data || 'Нет данных в ответе')}`, 'social-publishing');
        return null;
      }
    } catch (error) {
      log(`Исключение при запросе информации о чате: ${error instanceof Error ? error.message : String(error)}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Вспомогательный метод для генерации URL сообщения в этом контексте публикации
   * Использует chatUsername из текущего контекста
   * @param chatId Исходный chat ID (может быть @username или числовым ID)
   * @param formattedChatId Форматированный chat ID для API запросов
   * @param messageId ID сообщения
   * @returns URL сообщения
   */
  private generatePostUrl(chatId: string, formattedChatId: string, messageId?: number | string): string {
    return this.formatTelegramUrl(chatId, formattedChatId, messageId, this.currentChatUsername);
  }
  
  /**
   * Вспомогательная функция для форматирования URL Telegram с учетом разных форматов chat ID
   * @param chatId Исходный chat ID (может быть @username или числовым ID)
   * @param formattedChatId Форматированный chat ID для API запросов
   * @param messageId Опциональный ID сообщения для создания прямой ссылки
   * @param chatUsername Опциональный username чата (если известен)
   * @returns Корректно форматированный URL
   */
  /**
   * Агрессивный исправитель HTML-тегов для обработки всех возможных случаев
   * @param text Исходный HTML-текст
   * @returns Исправленный HTML-текст с правильными закрытыми тегами
   * @public
   */
  public aggressiveTagFixer(text: string): string {
    if (!text) return text;
    
    try {
      // Вспомогательная функция для удаления всех HTML-тегов из текста
      const stripAllTags = (htmlContent: string): string => {
        return htmlContent.replace(/<[^>]+>/g, '');
      };
      
      // Список поддерживаемых Telegram тегов и их стандартизированные эквиваленты
      const tagMap: Record<string, string> = {
        'b': 'b', 'strong': 'b',
        'i': 'i', 'em': 'i',
        'u': 'u', 'ins': 'u',
        's': 's', 'strike': 's', 'del': 's',
        'code': 'code', 'pre': 'pre'
      };
      
      // Шаг 1: Очищаем HTML от комментариев и опасных конструкций
      let cleanedHtml = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\?([\s\S]*?)\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/i, '')
        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '')
        .replace(/Подсознание наизнанку/g, ''); // Специфичное для проекта
      
      // Шаг 2: Заменяем блочные элементы на текст с переносами строк
      cleanedHtml = cleanedHtml
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
      
      // Шаг 3: Стандартизируем теги в поддерживаемые Telegram форматы
      cleanedHtml = cleanedHtml
        .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
        .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '<b>$1</b>')
        .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
        .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '<i>$1</i>')
        .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
        .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
        .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '<s>$1</s>')
        .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
        .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
      
      // Шаг 4: Специальная обработка ссылок - удаляем вложенные теги в тексте ссылки
      cleanedHtml = cleanedHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, 
        (match, url, text) => {
          const cleanText = stripAllTags(text);
          return `<a href="${url}">${cleanText}</a>`;
        }
      );
      
      // Шаг 5: Удаляем все теги, кроме поддерживаемых Telegram
      const supportedTagList = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
      const unsupportedTagPattern = new RegExp(`<\\/?(?!${supportedTagList.join('|')}\\b)[^>]+>`, 'gi');
      cleanedHtml = cleanedHtml.replace(unsupportedTagPattern, '');
      
      // Шаг 6: Нормализуем атрибуты тегов
      cleanedHtml = cleanedHtml
        .replace(/<(b|i|u|s|code|pre)\s+[^>]*>/gi, '<$1>')
        .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>/gi, '<a href="$1">');
      
      // Шаг 7: Правильное форматирование для Telegram - последовательная обработка тегов
      // Разбиваем на параграфы
      const paragraphs = cleanedHtml.split(/\n{2,}/);
      let formattedHtml = '';
      
      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;
        
        // Простой текст без форматирования
        if (!/<[^>]+>/.test(paragraph)) {
          formattedHtml += paragraph.trim() + '\n\n';
          continue;
        }
        
        // Текст с форматированием требует особой обработки
        // Для Telegram важно, чтобы теги не перекрывались неправильно
        
        // 1. Выделение жирным
        let boldText = paragraph.replace(/<b>([\s\S]*?)<\/b>/gi, (match, content) => {
          // Удаляем вложенные теги того же типа
          const cleanContent = content
            .replace(/<\/?b>/gi, '')
            .replace(/<\/?strong>/gi, '');
          return `<b>${cleanContent}</b>`;
        });
        
        // 2. Выделение курсивом
        let italicText = boldText.replace(/<i>([\s\S]*?)<\/i>/gi, (match, content) => {
          // Удаляем вложенные теги того же типа
          const cleanContent = content
            .replace(/<\/?i>/gi, '')
            .replace(/<\/?em>/gi, '');
          return `<i>${cleanContent}</i>`;
        });
        
        // 3. Подчеркивание
        let underlineText = italicText.replace(/<u>([\s\S]*?)<\/u>/gi, (match, content) => {
          // Удаляем вложенные теги того же типа
          const cleanContent = content
            .replace(/<\/?u>/gi, '')
            .replace(/<\/?ins>/gi, '');
          return `<u>${cleanContent}</u>`;
        });
        
        // 4. Зачеркивание
        let strikeText = underlineText.replace(/<s>([\s\S]*?)<\/s>/gi, (match, content) => {
          // Удаляем вложенные теги того же типа
          const cleanContent = content
            .replace(/<\/?s>/gi, '')
            .replace(/<\/?strike>/gi, '')
            .replace(/<\/?del>/gi, '');
          return `<s>${cleanContent}</s>`;
        });
        
        formattedHtml += strikeText.trim() + '\n\n';
      }
      
      // Шаг 8: Проверка и исправление оставшихся незакрытых тегов
      const tagStack: string[] = [];
      let tempHtml = '';
      let i = 0;
      
      while (i < formattedHtml.length) {
        if (formattedHtml[i] === '<') {
          if (formattedHtml[i + 1] === '/') {
            // Закрывающий тег
            const closeTagMatch = formattedHtml.substring(i).match(/<\/([a-z]+)>/i);
            if (closeTagMatch) {
              const closeTag = closeTagMatch[1].toLowerCase();
              
              if (tagStack.length > 0 && tagStack[tagStack.length - 1] === closeTag) {
                // Правильный закрывающий тег
                tagStack.pop();
                tempHtml += closeTagMatch[0];
                i += closeTagMatch[0].length;
              } else {
                // Неправильный закрывающий тег, пропускаем его
                i += closeTagMatch[0].length;
              }
            } else {
              // Некорректный закрывающий тег
              i++;
            }
          } else {
            // Открывающий тег
            const openTagMatch = formattedHtml.substring(i).match(/<([a-z]+)(\s+[^>]*)?>/i);
            if (openTagMatch) {
              const openTag = openTagMatch[1].toLowerCase();
              
              if (supportedTagList.includes(openTag)) {
                // Поддерживаемый тег
                tagStack.push(openTag);
                tempHtml += openTagMatch[0];
                i += openTagMatch[0].length;
              } else {
                // Неподдерживаемый тег, пропускаем
                i += openTagMatch[0].length;
              }
            } else {
              tempHtml += formattedHtml[i];
              i++;
            }
          }
        } else {
          tempHtml += formattedHtml[i];
          i++;
        }
      }
      
      // Закрываем все незакрытые теги
      const reversedStack = [...tagStack].reverse();
      for (const tag of reversedStack) {
        if (tag !== 'a') { // Специальная обработка для ссылок
          tempHtml += `</${tag}>`;
        }
      }
      
      // Финальная очистка от лишних переносов строк и пробелов
      let result = tempHtml
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .replace(/<\/b><b>/g, '')
        .replace(/<\/i><i>/g, '')
        .replace(/<\/u><u>/g, '')
        .replace(/<\/s><s>/g, '');
      
      // Финальная проверка на баланс тегов
      const openingCount = (result.match(/<[a-z][^>]*>/gi) || []).length;
      const closingCount = (result.match(/<\/[a-z][^>]*>/gi) || []).length;
      
      if (openingCount !== closingCount) {
        log(`Предупреждение: баланс тегов после исправления не идеален: открывающих ${openingCount}, закрывающих ${closingCount}`, 'social-publishing');
        
        // Возможно, стоит применить более радикальное решение, если разница слишком большая
        if (Math.abs(openingCount - closingCount) > 3) {
          log(`Критическая ошибка в балансе тегов после исправления. Удаляем все теги.`, 'social-publishing');
          return text.replace(/<[^>]*>/g, '');
        }
      }
      
      // Финальное обрезание до максимальной длины Telegram
      if (result.length > MAX_MESSAGE_LENGTH) {
        result = result.substring(0, MAX_MESSAGE_LENGTH - 3) + '...';
      }
      
      log(`Текст после улучшенного исправления HTML: ${result.substring(0, Math.min(100, result.length))}...`, 'social-publishing');
      
      return result;
    } catch (error) {
      log(`Ошибка в aggressiveTagFixer: ${error}`, 'social-publishing');
      // В случае любой ошибки возвращаем текст без HTML-разметки
      return text.replace(/<[^>]*>/g, '');
    }
  }
  
  formatTelegramUrl(chatId: string, formattedChatId: string, messageId?: number | string | undefined, chatUsername?: string): string {
    // Сохраняем username для использования в generatePostUrl
    if (chatUsername) {
      this.currentChatUsername = chatUsername;
    }
    log(`Форматирование Telegram URL: chatId=${chatId}, formattedChatId=${formattedChatId}, messageId=${messageId || 'не указан'}, username=${chatUsername || 'не указан'}`, 'social-publishing');
    
    // Если ID сообщения не указан, вернем дефолтный URL Telegram
    if (!messageId) {
      log(`messageId не указан, возвращаем базовый URL для Telegram`, 'social-publishing');
      
      // Если известен username, используем его
      if (chatUsername) {
        return `https://t.me/${chatUsername}`;
      }
      
      // Если это username (начинается с @), можем вернуть URL на канал
      if (chatId.startsWith('@')) {
        return `https://t.me/${chatId.substring(1)}`;
      }
      
      // Для всех остальных случаев без messageId возвращаем базовый URL
      return 'https://t.me';
    }
    
    // Если известен username чата, используем его для URL
    if (chatUsername) {
      const url = `https://t.me/${chatUsername}/${messageId}`;
      log(`Сформирован URL для канала с известным username: ${url}`, 'social-publishing');
      return url;
    }
    
    // Стандартные случаи форматирования URL
    
    // Обработка случая с username (@channel)
    if (chatId.startsWith('@')) {
      const username = chatId.substring(1);
      const url = `https://t.me/${username}/${messageId}`;
      log(`Сформирован URL для канала с username: ${url}`, 'social-publishing');
      return url;
    }
    
    // Обработка случая с супергруппой/каналом (-100...)
    if (chatId.startsWith('-100')) {
      // Для приватных каналов используем формат с /c/
      // Для публичных - формат без /c/
      const channelId = chatId.substring(4);
      
      // Для приватных каналов (без username)
      if (!chatUsername) {
        const url = `https://t.me/c/${channelId}/${messageId}`;
        log(`Сформирован URL для приватного канала: ${url}`, 'social-publishing');
        return url;
      }
      
      // Для публичных супергрупп/каналов удаляем префикс -100
      const url = `https://t.me/${channelId}/${messageId}`;
      log(`Сформирован URL для публичного канала: ${url}`, 'social-publishing');
      return url;
    }
    
    // Обработка обычных групп (начинаются с -)
    if (chatId.startsWith('-')) {
      // Для обычной группы без username форматируем URL по стандарту
      const groupId = chatId.substring(1); // Убираем только минус
      const url = `https://t.me/c/${groupId}/${messageId}`;
      log(`Сформирован URL для обычной группы: ${url}`, 'social-publishing');
      return url;
    }
    
    // Личные чаты или боты (числовой ID без минуса)
    const url = `https://t.me/c/${chatId}/${messageId}`;
    log(`Сформирован URL для личного чата/бота: ${url}`, 'social-publishing');
    return url;
  }

  /**
   * Публикует контент в Telegram с использованием Imgur для изображений
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  /**
   * Публикует контент в Telegram с сохранением HTML-форматирования.
   * ОПТИМИЗИРОВАНО: минимальная обработка HTML для максимальной совместимости
   * 
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API (токен и ID чата)
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: { token: string | null; chatId: string | null }
  ): Promise<SocialPublication> {
    // ID последнего сообщения для формирования ссылки
    let lastMessageId: number | string | undefined;
    // Храним username канала, если его удастся получить
    let chatUsername: string | undefined;
    
    log(`Начало публикации в Telegram: ${content.id}`, 'telegram');
    
    try {
      // Проверяем наличие необходимых параметров
      if (!telegramSettings.token || !telegramSettings.chatId) {
        log(`Ошибка публикации в Telegram: отсутствуют настройки. Token: ${telegramSettings.token ? 'задан' : 'отсутствует'}, ChatID: ${telegramSettings.chatId ? 'задан' : 'отсутствует'}`, 'telegram');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          postUrl: null,
          error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
        };
      }
      
      // Извлекаем параметры
      const token = telegramSettings.token;
      let chatId = telegramSettings.chatId;
      
      // Проверяем и форматируем ID чата для API Telegram
      if (!chatId.startsWith('-100') && !isNaN(Number(chatId))) {
        chatId = `-100${chatId}`;
        log(`Переформатирован ID чата для Telegram: ${chatId}`, 'telegram');
      } else if (chatId.startsWith('@')) {
        log(`Использован username чата для Telegram: ${chatId}`, 'telegram');
      }
      
      // Пытаемся получить информацию о чате для корректного формирования URL
      try {
        const chatInfo = await this.getChatInfo(chatId, token);
        if (chatInfo && chatInfo.username) {
          chatUsername = chatInfo.username;
          // Сохраняем username чата в свойстве класса для дальнейшего использования
          this.currentChatUsername = chatUsername;
          log(`Получен username чата: ${chatUsername}`, 'telegram');
        } else {
          log(`Не удалось получить username чата или у чата нет публичного username`, 'telegram');
        }
      } catch (error) {
        log(`Ошибка при запросе информации о чате: ${error instanceof Error ? error.message : String(error)}`, 'telegram');
      }
      
      // Обрабатываем контент
      const processedContent = this.processAdditionalImages(content, 'telegram');
      
      // Загружаем локальные изображения на Imgur, если необходимо
      const imgurContent = await this.uploadImagesToImgur(processedContent);
      
      // Подготавливаем текст для отправки
      let text = '';
      
      // Если есть заголовок, добавляем его в начало сообщения
      if (imgurContent.title) {
        text += `<b>${imgurContent.title}</b>\n\n`;
      }
      
      // Добавляем основной контент
      const originalContent = imgurContent.content || '';
      const contentText = this.prepareTelegramText(originalContent);
      
      // Логирование обработанного текста для отладки
      log(`Обработка HTML для Telegram: исходный текст ${originalContent.length} символов, обработанный ${contentText.length} символов`, 'social-publishing');
      log(`Первые 100 символов обработанного текста: ${contentText.substring(0, 100)}`, 'social-publishing');
      
      text += contentText;
      
      // Если есть хэштеги, добавляем их в конец сообщения
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        const hashtags = processedContent.hashtags
          .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
        
        if (hashtags.length > 0) {
          text += '\n\n' + hashtags.join(' ');
        }
      }
      
      // Создаем URL API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Проверяем наличие изображений
      const hasImages = processedContent.imageUrl || 
        (processedContent.additionalImages && processedContent.additionalImages.length > 0);
      
      // Проверяем необходимость принудительного разделения текста и изображений
      // Флаг устанавливается в методе publishToPlatform для всех Telegram публикаций
      const forceImageTextSeparation = processedContent.metadata && 
        (processedContent.metadata as any).forceImageTextSeparation === true;
      
      log(`Telegram: наличие изображений: ${hasImages}, принудительное разделение: ${forceImageTextSeparation}`, 'social-publishing');
      
      // Определяем стратегию публикации в зависимости от длины текста и наличия изображений
      
      // 1. Если есть изображения и включен флаг принудительного разделения,
      // отправляем сначала изображения без подписи, затем текст отдельным сообщением
      if (hasImages && forceImageTextSeparation) {
        log(`Telegram: публикация с изображением. Отправляем изображение и текст раздельно.`, 'social-publishing');
        
        // Подготавливаем краткую подпись для изображения (только заголовок)
        const imageCaption = processedContent.title ? 
          (processedContent.title.length > 200 ? 
            processedContent.title.substring(0, 197) + '...' : 
            processedContent.title) : 
          '';
        
        log(`Используем краткую подпись для изображения: "${imageCaption}"`, 'social-publishing');
        
        // Собираем все изображения для отправки через универсальный метод
        const images: string[] = [];
        
        // Добавляем основное изображение, если оно есть
        if (processedContent.imageUrl) {
          const isUrl = processedContent.imageUrl.startsWith('http://') || processedContent.imageUrl.startsWith('https://');
          log(`Основное изображение для Telegram - тип: ${isUrl ? 'URL' : 'локальный путь'}, значение: ${processedContent.imageUrl}`, 'social-publishing');
          images.push(processedContent.imageUrl);
        }
        
        // Добавляем дополнительные изображения в общий список
        if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
          log(`Добавляем ${processedContent.additionalImages.length} дополнительных изображений в общий список`, 'social-publishing');
          images.push(...processedContent.additionalImages);
        }
        
        // Отправляем все изображения через универсальный метод
        let imagesSentResult: {
          success: boolean;
          error: string;
          messageId?: number | string;
          messageUrl?: string;
        } = { 
          success: false, 
          error: 'Изображения не отправлены' 
        };
        
        if (images.length > 0) {
          log(`Отправка всех ${images.length} изображений через универсальный метод`, 'social-publishing');
          
          // Передаем текст как caption при отправке изображений
          imagesSentResult = await this.sendImagesToTelegram(
            formattedChatId,
            token,
            images,
            baseUrl,
            text // Передаем текст как caption
          );
          
          if (!imagesSentResult.success) {
            log(`Ошибка при отправке изображений в Telegram: ${imagesSentResult.error}`, 'social-publishing');
          } else {
            log(`Все изображения успешно отправлены в Telegram`, 'social-publishing');
            log(`URL сообщения с изображениями: ${imagesSentResult.messageUrl || 'не создан'}`, 'social-publishing');
          }
        }
        
        // Текст теперь отправляется вместе с изображениями как подпись, 
        // поэтому отдельная отправка текста не требуется
        
        // Используем результат предыдущей отправки изображений
        if (imagesSentResult && imagesSentResult.success) {
          // Если изображения успешно отправлены с текстом, возвращаем успешный результат
          log(`Публикация в Telegram завершена успешно (изображения с подписью)`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: imagesSentResult.messageUrl || this.generatePostUrl(chatId, formattedChatId, imagesSentResult.messageId || '')
          };
        } else {
          // Если возникла проблема с отправкой изображений, попробуем отправить только текст
          try {
            log(`Отправка изображений с подписью не удалась, пробуем отправить только текст: ${text.length} символов`, 'social-publishing');
              
            // Если текст превышает максимальную длину для Telegram (4096 символов),
            // он будет автоматически обрезан в методе sendTextMessageToTelegram
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            log(`Текст успешно отправлен в Telegram: ${JSON.stringify(textResponse)}`, 'social-publishing');
            
            // Обновляем lastMessageId если есть message_id
            if (textResponse.result && textResponse.result.message_id) {
              lastMessageId = textResponse.result.message_id;
            }
              
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
            };
          } catch (error: any) {
            log(`Ошибка при отправке текста в Telegram: ${error.message}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке текста в Telegram: ${error.message}`
            };
          }
        }
      }
      // 2. Если есть только одно основное изображение и текст умещается в лимит,
      // отправляем изображение с текстом в подписи
      else if (processedContent.imageUrl && (!processedContent.additionalImages || processedContent.additionalImages.length === 0) && text.length <= 1024) {
        log(`Telegram: отправка одного изображения с подписью. Длина текста: ${text.length} символов.`, 'social-publishing');
        
        try {
          // Проверяем валидность URL изображения и убеждаемся, что он действительно указывает на изображение
          let imageUrl = processedContent.imageUrl;
          if (!imageUrl.startsWith('http')) {
            const baseAppUrl = this.getAppBaseUrl();
            imageUrl = `${baseAppUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            log(`Исправлен URL для основного изображения: ${imageUrl}`, 'social-publishing');
          }
          
          log(`Отправка фото в Telegram: ${imageUrl}`, 'social-publishing');
          
          // Используем validateStatus чтобы получить полный ответ даже в случае ошибки
          const response = await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: formattedChatId,
            photo: imageUrl,
            caption: text,
            parse_mode: 'HTML',
            protect_content: false, // Дополнительный параметр, который может быть полезен
            disable_notification: false // Дополнительный параметр, который может быть полезен
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, // Увеличенный таймаут
            validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
          });
          
          // Расширенное логирование ответа
          log(`Ответ от Telegram API (sendPhoto): код ${response.status}, body: ${JSON.stringify(response.data)}`, 'social-publishing');
          
          if (response.status === 200 && response.data && response.data.ok) {
            log(`Изображение с текстом успешно отправлено в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, response.data?.result?.message_id)
            };
          } else {
            log(`Ошибка при отправке изображения с текстом в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            
            // Попробуем отправить как URL, если не получилось отправить как файл
            const errorDescription = response.data?.description || '';
            
            if (errorDescription.includes('Bad Request') || errorDescription.includes('URL') || errorDescription.includes('photo')) {
              log(`Пробуем альтернативный метод отправки изображения через медиагруппу...`, 'social-publishing');
              
              try {
                // Отправляем изображение и текст как медиагруппу
                const mediaResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
                  chat_id: formattedChatId,
                  media: [
                    {
                      type: 'photo',
                      media: imageUrl,
                      caption: text,
                      parse_mode: 'HTML'
                    }
                  ]
                }, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 30000,
                  validateStatus: () => true
                });
                
                if (mediaResponse.status === 200 && mediaResponse.data && mediaResponse.data.ok) {
                  log(`Успешно отправлена медиагруппа: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                  // Сохраняем ID сообщения для формирования корректной ссылки
                  if (mediaResponse.data?.result?.[0]?.message_id) {
                    lastMessageId = mediaResponse.data.result[0].message_id;
                  }
                  
                  return {
                    platform: 'telegram',
                    status: 'published',
                    publishedAt: new Date(),
                    postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
                  };
                } else {
                  // Если оба метода не работают, отправляем изображение и текст по отдельности
                  log(`Альтернативный метод тоже не сработал. Пробуем отправить изображение и текст отдельно...`, 'social-publishing');
                  
                  // Отправляем сначала изображение без подписи
                  const imageOnlyResponse = await axios.post(`${baseUrl}/sendPhoto`, {
                    chat_id: formattedChatId,
                    photo: imageUrl
                  , parse_mode: "HTML"}, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                    validateStatus: () => true
                  });
                  
                  // Затем отправляем текст отдельно
                  const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
                  
                  if (imageOnlyResponse.data?.ok || textResponse.success) {
                    log(`Удалось отправить изображение и текст по отдельности`, 'social-publishing');
                    // Сохраняем ID сообщения для формирования корректной ссылки
                    if (imageOnlyResponse.data?.result?.message_id) {
                      lastMessageId = imageOnlyResponse.data.result.message_id;
                    } else if (textResponse.success && textResponse.result?.message_id) {
                      lastMessageId = textResponse.result.message_id;
                    }
                    
                    return {
                      platform: 'telegram',
                      status: 'published',
                      publishedAt: new Date(),
                      postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
                    };
                  }
                }
              } catch (mediaError: any) {
                log(`Ошибка при альтернативной отправке: ${mediaError.message}`, 'social-publishing');
              }
            }
            
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке изображения с текстом: ${response.data?.description || JSON.stringify(response.data)}`
            };
          }
        } catch (error: any) {
          log(`Исключение при отправке изображения с текстом в Telegram: ${error.message}`, 'social-publishing');
          
          // Детальное логирование для диагностики
          if (error.response) {
            log(`Данные ответа API: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          
          // Попробуем отправить текст и изображение отдельно как запасной вариант
          try {
            log(`Пробуем отправить текст и изображение отдельно после сбоя...`, 'social-publishing');
            
            // Отправляем сначала изображение без подписи
            await axios.post(`${baseUrl}/sendPhoto`, {
              chat_id: formattedChatId,
              photo: processedContent.imageUrl
            , parse_mode: "HTML"}, {
              validateStatus: () => true,
              timeout: 30000
            });
            
            // Затем отправляем текст отдельно
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            
            if (textResponse.success) {
              log(`Резервный план сработал: изображение и текст отправлены отдельно`, 'social-publishing');
              // Сохраняем ID сообщения для формирования корректной ссылки
              if (textResponse.result?.message_id) {
                lastMessageId = textResponse.result.message_id;
              }
              
              return {
                platform: 'telegram',
                status: 'published',
                publishedAt: new Date(),
                postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
              };
            }
          } catch (backupError: any) {
            log(`Резервный план также не сработал: ${backupError.message}`, 'social-publishing');
          }
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при отправке изображения с текстом: ${error.message}`
          };
        }
      }
      // 3. В остальных случаях (нет изображений или несколько изображений)
      else {
        // Если есть изображения, отправляем их
        if (processedContent.imageUrl || (processedContent.additionalImages && processedContent.additionalImages.length > 0)) {
          // Подготавливаем подпись для изображения
          const imageCaption = text.length <= 1024 ? 
            text : 
            (processedContent.title ? 
              (processedContent.title.length > 200 ? 
                processedContent.title.substring(0, 197) + '...' : 
                processedContent.title) : 
              '');
              
          log(`Telegram: подготовлена подпись для изображения, длина: ${imageCaption.length} символов`, 'social-publishing');
          
          // Отправляем основное изображение
          if (processedContent.imageUrl) {
            try {
              log(`Отправка основного изображения: ${processedContent.imageUrl}`, 'social-publishing');
              
              // Формируем полный URL, если это локальный путь
              let imageUrl = processedContent.imageUrl;
              if (!imageUrl.startsWith('http')) {
                const baseAppUrl = this.getAppBaseUrl();
                imageUrl = `${baseAppUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                log(`Исправлен URL для основного изображения: ${imageUrl}`, 'social-publishing');
              }
              
              // Отправляем изображение с подписью
              const photoResponse = await axios.post(`${baseUrl}/sendPhoto`, {
                chat_id: formattedChatId,
                photo: imageUrl,
                caption: imageCaption,
                parse_mode: 'HTML'
              }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
                validateStatus: () => true
              });
              
              if (photoResponse.status === 200 && photoResponse.data && photoResponse.data.ok) {
                log(`Основное изображение успешно отправлено: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
                
                // Сохраняем ID сообщения
                if (photoResponse.data.result && photoResponse.data.result.message_id) {
                  lastMessageId = photoResponse.data.result.message_id;
                }
              } else {
                log(`Ошибка при отправке основного изображения: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
              }
            } catch (photoError: any) {
              log(`Исключение при отправке основного изображения: ${photoError.message}`, 'social-publishing');
            }
          }
          
          // Отправляем дополнительные изображения, если они есть
          if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
            try {
              // Ограничение в 10 изображений для Telegram API
              const mediaItems = processedContent.additionalImages.slice(0, 10).map(img => ({
                type: 'photo',
                media: img
              }));
              
              if (mediaItems.length > 0) {
                log(`Отправка ${mediaItems.length} дополнительных изображений через sendMediaGroup`, 'social-publishing');
                
                const mediaResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
                  chat_id: formattedChatId,
                  media: mediaItems
                , parse_mode: "HTML"}, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 60000, // Увеличенный таймаут для группы изображений
                  validateStatus: () => true
                });
                
                if (mediaResponse.status === 200 && mediaResponse.data && mediaResponse.data.ok) {
                  log(`Группа изображений успешно отправлена: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                  
                  // Обновляем lastMessageId при необходимости
                  if (mediaResponse.data.result && mediaResponse.data.result.length > 0) {
                    lastMessageId = mediaResponse.data.result[0].message_id;
                  }
                } else {
                  log(`Ошибка при отправке группы изображений: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                }
              }
            } catch (mediaError: any) {
              log(`Исключение при отправке группы изображений: ${mediaError.message}`, 'social-publishing');
            }
          }
          
          // Если у нас длинный текст, который не поместился в подпись изображения,
          // отправляем его отдельным сообщением
          if (text.length > 1024) {
            try {
              log(`Отправка длинного текста отдельным сообщением (${text.length} символов)`, 'social-publishing');
              
              const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
              
              if (textResponse.success) {
                log(`Текст успешно отправлен отдельно: ${JSON.stringify(textResponse.result)}`, 'social-publishing');
                
                // Если нет lastMessageId от изображений, используем ID сообщения с текстом
                if (!lastMessageId && textResponse.result && textResponse.result.message_id) {
                  lastMessageId = textResponse.result.message_id;
                }
              } else {
                log(`Ошибка при отправке текста отдельно: ${textResponse.error}`, 'social-publishing');
              }
            } catch (textError: any) {
              log(`Исключение при отправке текста отдельно: ${textError.message}`, 'social-publishing');
            }
          }
          
          // Если удалось отправить хотя бы что-то (есть lastMessageId), считаем публикацию успешной
          if (lastMessageId) {
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId)
            };
          } else {
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: 'Failed to send media content'
            };
          }
        }
        // Если нет изображений, просто отправляем текст
        else {
          try {
            log(`Отправка только текста, длина: ${text.length} символов`, 'social-publishing');
            
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            
            if (textResponse.success) {
              log(`Текст успешно отправлен: ${JSON.stringify(textResponse.result)}`, 'social-publishing');
              
              // Сохраняем ID сообщения для формирования ссылки
              if (textResponse.result && textResponse.result.message_id) {
                lastMessageId = textResponse.result.message_id;
              }
              
              return {
                platform: 'telegram',
                status: 'published',
                publishedAt: new Date(),
                postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
              };
            } else {
              log(`Ошибка при отправке текста: ${textResponse.error}`, 'social-publishing');
              return {
                platform: 'telegram',
                status: 'failed',
                publishedAt: null,
                error: `Failed to send text: ${textResponse.error}`
              };
            }
          } catch (textError: any) {
            log(`Исключение при отправке текста: ${textError.message}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Exception while sending text: ${textError.message}`
            };
          }
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Publication error: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public async publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication> {
    if (platform !== 'telegram') {
      return {
        platform: platform, 
        status: 'failed',
        publishedAt: null,
        error: 'Unsupported platform for TelegramService'
      };
    }

    // Проверяем наличие настроек и логируем их для дебага
    const telegramSettings = settings.telegram || { token: null, chatId: null };
    const hasToken = Boolean(telegramSettings.token);
    const hasChatId = Boolean(telegramSettings.chatId);
    
    log(`TelegramService.publishToPlatform: Настройки: hasToken=${hasToken}, hasChatId=${hasChatId}`, 'social-publishing');

    if (!hasToken || !hasChatId) {
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Проверяем, используем ли мы упрощенный режим отправки HTML
    const useDirectHtmlSending = true; // Включаем новый метод отправки
    
    // Проверяем наличие изображений
    const hasImages = content.imageUrl || 
      (content.additionalImages && content.additionalImages.length > 0);
      
    if (useDirectHtmlSending) {
      // Используем оптимизированный метод прямой отправки HTML
      log(`Используем оптимизированный метод прямой отправки HTML. Наличие изображений: ${hasImages}`, 'telegram');
      
      // Подготавливаем HTML-текст
      let htmlText = '';
      
      // Добавляем заголовок, если он есть
      if (content.title) {
        htmlText += `<b>${content.title}</b>\n\n`;
      }
      
      // Добавляем основной контент с обработкой HTML
      if (content.content) {
        // Импортируем процессор HTML для корректного форматирования в Telegram
        const { processHtmlForTelegram } = require('../../../shared/telegram-html-processor');
        const processedContent = processHtmlForTelegram(content.content, { debug: true });
        htmlText += processedContent;
      }
      
      // Добавляем хэштеги, если они есть
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        const hashtags = content.hashtags
          .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
        
        if (hashtags.length > 0) {
          htmlText += '\n\n' + hashtags.join(' ');
        }
      }
      
      try {
        let result;
        
        // Если есть изображения, используем логику с проверкой длины текста
        if (hasImages) {
          log(`Обнаружены изображения в контенте. Применяем стратегию с изображениями.`, 'telegram');
          
          // Обрабатываем контент для изображений
          const processedContent = this.processAdditionalImages(content, 'telegram');
          
          // Загружаем локальные изображения на Imgur, если необходимо
          const imgurContent = await this.uploadImagesToImgur(processedContent);
          
          // Длина текста для определения стратегии отправки
          const textLength = htmlText.length;
          const smallTextThreshold = 1000; // Порог для определения "маленького" текста
          
          log(`Длина текста: ${textLength} символов, порог: ${smallTextThreshold}`, 'telegram');
          
          // Собираем все изображения для отправки через универсальный метод
          const images: string[] = [];
          
          // Добавляем основное изображение, если оно есть
          if (imgurContent.imageUrl) {
            log(`Добавляем основное изображение: ${imgurContent.imageUrl}`, 'telegram');
            images.push(imgurContent.imageUrl);
          }
          
          // Добавляем дополнительные изображения в общий список
          if (imgurContent.additionalImages && imgurContent.additionalImages.length > 0) {
            log(`Добавляем ${imgurContent.additionalImages.length} дополнительных изображений`, 'telegram');
            images.push(...imgurContent.additionalImages);
          }
          
          // Если текст короткий, отправляем как подпись к изображению
          if (textLength <= smallTextThreshold) {
            log(`Текст короткий (${textLength} <= ${smallTextThreshold}), отправляем как подпись к изображению`, 'telegram');
            
            // Формируем chatId для API Telegram
            const chatIdValue = telegramSettings.chatId!;
            let formattedChatId = chatIdValue;
            if (!chatIdValue.startsWith('-100') && !isNaN(Number(chatIdValue)) && !chatIdValue.startsWith('@')) {
              formattedChatId = `-100${chatIdValue}`;
            }
            
            // Базовый URL для API Telegram
            const baseUrl = `https://api.telegram.org/bot${telegramSettings.token!}`;
            
            // Отправляем изображения с текстом как подпись
            result = await this.sendImagesToTelegram(formattedChatId, telegramSettings.token!, images, baseUrl, htmlText);
          } else {
            // Для длинного текста, сначала отправляем изображения, затем текст отдельно
            log(`Текст длинный (${textLength} > ${smallTextThreshold}), отправляем изображения и текст отдельно`, 'telegram');
            
            // Формируем chatId для API Telegram
            const chatIdValue = telegramSettings.chatId!;
            let formattedChatId = chatIdValue;
            if (!chatIdValue.startsWith('-100') && !isNaN(Number(chatIdValue)) && !chatIdValue.startsWith('@')) {
              formattedChatId = `-100${chatIdValue}`;
            }
            
            // Базовый URL для API Telegram
            const baseUrl = `https://api.telegram.org/bot${telegramSettings.token!}`;
            
            // Отправляем изображения без подписи
            const imagesResult = await this.sendImagesToTelegram(formattedChatId, telegramSettings.token!, images, baseUrl);
            
            // Затем отправляем текст отдельным сообщением
            const textResult = await this.sendRawHtmlToTelegram(htmlText, telegramSettings.chatId!, telegramSettings.token!);
            
            // Используем результат последней операции (отправки текста)
            result = textResult;
            
            // Но для URL используем результат отправки изображений, если он успешен
            if (imagesResult.success && imagesResult.messageUrl) {
              log(`Используем URL от сообщения с изображениями: ${imagesResult.messageUrl}`, 'telegram');
              result.messageUrl = imagesResult.messageUrl;
            }
          }
        } else {
          // Если изображений нет, просто отправляем HTML-текст
          log(`Изображения не обнаружены. Отправляем только HTML-текст.`, 'telegram');
          result = await this.sendRawHtmlToTelegram(htmlText, telegramSettings.chatId!, telegramSettings.token!);
        }
        
        if (result && result.success) {
          log(`Публикация успешно отправлена в Telegram, ID сообщения: ${result.messageId}`, 'telegram');
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: result.messageUrl
          };
        } else {
          const errorMessage = result ? result.error : 'Неизвестная ошибка';
          log(`Ошибка при отправке в Telegram: ${errorMessage}`, 'telegram');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            postUrl: null,
            error: `Ошибка при отправке в Telegram: ${errorMessage}`
          };
        }
      } catch (error: any) {
        log(`Исключение при публикации в Telegram: ${error.message}`, 'telegram');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          postUrl: null,
          error: `Исключение при публикации в Telegram: ${error.message}`
        };
      }
    }
    
    // Если не используем прямую отправку HTML, используем стандартный метод
    // Для Telegram НЕ добавляем флаг принудительного разделения,
    // чтобы короткий текст без форматирования отправлялся как подпись к изображениям
    const contentWithMetadata = {
      ...content,
      metadata: {
        ...(content.metadata || {})
        // Убираем forceImageTextSeparation: true, чтобы текст отправлялся как подпись
      }
    };

    return this.publishToTelegram(contentWithMetadata, telegramSettings);
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const telegramService = new TelegramService();