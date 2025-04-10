/**
 * Утилиты для форматирования URL в Telegram
 * Обрабатывает различные форматы chat_id и создает корректные URL для сообщений
 */

import { log } from './logger';

/**
 * Очищает префиксы из ID чата Telegram
 * Удаляет префиксы -100, -1001, -1002 для приватных чатов
 * 
 * @param chatId Исходный ID чата
 * @returns Очищенный ID чата
 */
export function cleanTelegramChatId(chatId: string): string {
  if (!chatId) return '';
  
  // Не обрабатываем ID, которые уже содержат номер сообщения (формат ID/message)
  if (chatId.includes('/')) {
    return chatId;
  }
  
  let cleanChatId = chatId;
  
  // Обрабатываем различные форматы префиксов
  if (chatId.startsWith('-1001')) {
    cleanChatId = chatId.substring(5); // Удаляем префикс -1001
    // Исправляем для случая -1001234567890 -> нам нужно 1234567890, а не 234567890
    cleanChatId = '1' + cleanChatId;
    log(`Обработка ID чата с префиксом -1001: ${chatId} -> ${cleanChatId}`, 'telegram-formatter');
  } else if (chatId.startsWith('-1002')) {
    cleanChatId = chatId.substring(5); // Удаляем префикс -1002
    log(`Обработка ID чата с префиксом -1002: ${chatId} -> ${cleanChatId}`, 'telegram-formatter');
  } else if (chatId.startsWith('-100')) {
    cleanChatId = chatId.substring(4); // Удаляем префикс -100
    log(`Обработка ID чата с префиксом -100: ${chatId} -> ${cleanChatId}`, 'telegram-formatter');
  }
  
  return cleanChatId;
}

/**
 * Форматирует URL для сообщения в Telegram
 * 
 * @param chatId ID чата Telegram (с префиксом или без)
 * @param messageId ID сообщения
 * @param username Username чата (опционально)
 * @returns Форматированный URL
 */
export function formatTelegramUrl(chatId: string, messageId?: string | number, username?: string): string {
  if (!chatId) return 'https://t.me';
  
  // Логируем параметры для отладки
  log(`Форматирование URL для Telegram: chatId=${chatId}, messageId=${messageId || 'не указан'}, username=${username || 'не указан'}`, 'telegram-formatter');
  
  // Если ID сообщения не указан, формируем URL только для канала/чата
  if (!messageId) {
    // Случай с username
    if (username) {
      return `https://t.me/${username}`;
    }
    
    // Случай с username, заданным через @
    if (chatId.startsWith('@')) {
      return `https://t.me/${chatId.substring(1)}`;
    }
    
    // Для публичных каналов возвращаем базовый URL
    return 'https://t.me';
  }
  
  // Если известен username, используем его для формирования URL
  if (username) {
    return `https://t.me/${username}/${messageId}`;
  }
  
  // Случай с username, заданным через @
  if (chatId.startsWith('@')) {
    const channelName = chatId.substring(1);
    return `https://t.me/${channelName}/${messageId}`;
  }
  
  // Обрабатываем приватные каналы/чаты
  if (chatId.startsWith('-100') || chatId.startsWith('-1001') || chatId.startsWith('-1002')) {
    // Очищаем ID от префикса
    const cleanChatId = cleanTelegramChatId(chatId);
    return `https://t.me/c/${cleanChatId}/${messageId}`;
  }
  
  // Для всех остальных случаев (числовые ID)
  return `https://t.me/c/${chatId}/${messageId}`;
}

/**
 * Проверяет и корректирует URL поста в Telegram
 * @param url Исходный URL
 * @param platform Платформа
 * @param messageId ID сообщения или поста
 * @returns Корректный URL
 */
export function ensureValidTelegramUrl(url: string | undefined, platform: string, messageId: string | undefined): string {
  // Если URL не определен, возвращаем пустую строку
  if (!url) return '';
  
  // Логируем параметры для отладки
  log(`Проверка URL: ${url}, платформа: ${platform}, messageId: ${messageId}`, 'telegram-formatter');
  
  // Обрабатываем URL только для Telegram
  if (platform === 'telegram') {
    // Проверяем наличие messageId в URL
    const hasMessageIdInUrl = !!url.match(/\/\d+$/); // URL заканчивается на /NUMBER
    
    if (!hasMessageIdInUrl && messageId) {
      // URL не содержит ID сообщения - нужно добавить messageId
      
      // Случай 1: URL для публичного канала без ID сообщения (t.me/channelname)
      if (url.match(/^https?:\/\/t\.me\/[^\/]+$/)) {
        const fixedUrl = `${url}/${messageId}`;
        log(`Исправление URL для публичного канала Telegram: ${url} -> ${fixedUrl}`, 'telegram-formatter');
        return fixedUrl;
      }
      
      // Случай 2: URL для приватного канала без ID сообщения (t.me/c/123456789)
      // Поддерживаем как числовые ID, так и ID с префиксами (-100...)
      if (url.match(/^https?:\/\/t\.me\/c\/[\d-]+$/) || url.includes('/c/') && !url.includes('/c/c/')) {
        const fixedUrl = `${url}/${messageId}`;
        log(`Исправление URL для приватного канала Telegram: ${url} -> ${fixedUrl}`, 'telegram-formatter');
        return fixedUrl;
      }
      
      // Общий случай: удаляем завершающий слеш (если есть) и добавляем messageId
      const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const fixedUrl = `${trimmedUrl}/${messageId}`;
      log(`Исправление URL для Telegram: ${url} -> ${fixedUrl}`, 'telegram-formatter');
      return fixedUrl;
    }
    
    // Специальная обработка случая, когда URL имеет неправильный формат из-за ошибки [object Object]
    if (url.includes('[object Object]')) {
      log(`Найден некорректный URL с [object Object]: ${url}`, 'telegram-formatter');
      
      // Возвращаем базовый URL Telegram, так как мы не можем определить ID канала
      return 'https://t.me';
    }
    
    // Если URL содержит слово "undefined", тоже считаем его некорректным
    if (url.includes('undefined')) {
      log(`Найден некорректный URL с undefined: ${url}`, 'telegram-formatter');
      
      // Возвращаем базовый URL Telegram
      return 'https://t.me';
    }
  }
  
  // Для других платформ или если URL уже корректный, возвращаем без изменений
  return url;
}