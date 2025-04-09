/**
 * Новый процессор контента для Telegram
 * Оптимизированный для правильного форматирования HTML и работы с изображениями
 */

import { log } from './logger.js';

/**
 * Преобразует HTML-контент в формат, совместимый с Telegram
 * @param {string} html Исходный HTML-контент
 * @returns {string} Контент, отформатированный для Telegram
 */
export function formatHtmlForTelegram(html) {
  if (!html) return '';
  
  try {
    // Сохраняем исходный HTML для логирования
    const originalHtml = html;
    
    // Преобразуем специальные символы
    let result = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
      
    // Обрабатываем абзацы (p) - заменяем на перенос строки
    result = result.replace(/<\/p>\s*<p[^>]*>/gi, '\n')
                   .replace(/<\/?p[^>]*>/gi, '');
    
    // Обрабатываем списки
    // Нумерованные списки
    result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
      let listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (!listItems) return content;
      
      let formattedList = '';
      listItems.forEach((item, index) => {
        const itemContent = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1');
        formattedList += `${index + 1}. ${itemContent}\n`;
      });
      
      return formattedList;
    });
    
    // Ненумерованные списки
    result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
      let listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (!listItems) return content;
      
      let formattedList = '';
      listItems.forEach(item => {
        const itemContent = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1');
        formattedList += `• ${itemContent}\n`;
      });
      
      return formattedList;
    });
    
    // Удаляем оставшиеся li теги
    result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n');
    
    // Обрабатываем форматирование для Telegram
    result = result
      // Форматирование текста: жирный, курсив, подчеркнутый, зачеркнутый
      .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '<b>$2</b>')
      .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '<i>$2</i>')
      .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$2</u>')
      .replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, '<s>$2</s>')
      
      // Обрабатываем ссылки, сохраняя только href
      .replace(/<a[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1">$2</a>')
      
      // Обрабатываем блоки кода
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>')
      
      // Заменяем заголовки на жирный текст
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
      
      // Заменяем <br> и переносы строк
      .replace(/<br\s*\/?>/gi, '\n')
      
      // Удаляем div и сохраняем их содержимое
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1');
      
    // Удаляем все остальные HTML-теги, которые не поддерживаются Telegram
    // Но сохраняем теги Telegram: b, i, u, s, code, pre, a
    const telegramTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    result = result.replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tagName) => {
      const lowerTagName = tagName.toLowerCase();
      if (telegramTags.includes(lowerTagName)) {
        if (match.startsWith('</')) {
          return `</${lowerTagName}>`;
        } else if (lowerTagName === 'a' && match.includes('href')) {
          // Обрабатываем ссылки отдельно, так как они могут иметь атрибуты
          const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
          if (hrefMatch) {
            return `<a href="${hrefMatch[1]}">`;
          }
        }
        return `<${lowerTagName}>`;
      }
      return '';
    });
    
    // Исправляем незакрытые теги
    result = fixUnclosedTags(result);
    
    // Исправляем избыточные переносы строк
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    
    log(`Форматирование HTML для Telegram: длина оригинала ${originalHtml.length}, длина результата ${result.length}`, 'telegram');
    return result;
  } catch (error) {
    log(`Ошибка при форматировании HTML для Telegram: ${error.message}`, 'telegram');
    return html; // В случае ошибки возвращаем исходный текст
  }
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
export function fixUnclosedTags(html) {
  const stack = [];
  const telegramTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  
  // Анализируем теги и ищем незакрытые
  const regex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let match;
  let result = html;
  let lastIndex = 0;
  
  while ((match = regex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Проверяем, поддерживается ли тег в Telegram
    if (!telegramTags.includes(tagName)) continue;
    
    // Если закрывающий тег
    if (fullTag.startsWith('</')) {
      if (stack.length > 0 && stack[stack.length - 1] === tagName) {
        // Правильно закрытый тег
        stack.pop();
      } else {
        // Закрывающий тег без открывающего - удаляем его
        result = result.substring(0, match.index) + result.substring(match.index + fullTag.length);
        regex.lastIndex -= fullTag.length;
      }
    } else if (!fullTag.endsWith('/>')) {
      // Открывающий тег - добавляем в стек
      stack.push(tagName);
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // Закрываем все незакрытые теги
  if (stack.length > 0) {
    log(`Обнаружены незакрытые теги: ${stack.join(', ')}`, 'telegram');
    
    // Добавляем закрывающие теги в обратном порядке
    for (let i = stack.length - 1; i >= 0; i--) {
      result += `</${stack[i]}>`;
    }
  }
  
  return result;
}

/**
 * Обрабатывает контент для отправки в Telegram
 * Выполняет форматирование, проверку длины и обрезку контента при необходимости
 * @param {string} content Исходное содержимое
 * @param {number} maxLength Максимальная длина текста (по умолчанию 4093 символа для Telegram)
 * @returns {string} Отформатированный и обрезанный текст
 */
export function processContentForTelegram(content, maxLength = 4093) {
  if (!content) return '';
  
  // Форматируем HTML для Telegram
  let processedContent = formatHtmlForTelegram(content);
  
  // Проверяем длину и обрезаем при необходимости
  if (processedContent.length > maxLength) {
    log(`Контент превышает максимальную длину ${maxLength}. Исходная длина: ${processedContent.length}, будет обрезан`, 'telegram');
    
    // Обрезаем с запасом для добавления многоточия
    let truncatedContent = processedContent.substring(0, maxLength - 3);
    
    // Ищем последний полный абзац или предложение для корректной обрезки
    const lastBreakIndex = Math.max(
      truncatedContent.lastIndexOf('. '),
      truncatedContent.lastIndexOf('! '),
      truncatedContent.lastIndexOf('? '),
      truncatedContent.lastIndexOf('.\n'),
      truncatedContent.lastIndexOf('!\n'),
      truncatedContent.lastIndexOf('?\n'),
      truncatedContent.lastIndexOf('\n\n')
    );
    
    // Если нашли подходящее место для разрыва, обрезаем там
    if (lastBreakIndex > maxLength * 0.8) {
      truncatedContent = truncatedContent.substring(0, lastBreakIndex + 1);
    }
    
    // Исправляем незакрытые теги в обрезанном контенте
    truncatedContent = fixUnclosedTags(truncatedContent);
    
    // Добавляем многоточие
    processedContent = truncatedContent + '...';
    
    log(`Контент обрезан до ${processedContent.length} символов`, 'telegram');
  }
  
  return processedContent;
}

/**
 * Определяет, нужно ли отправлять изображения отдельно от текста
 * @param {string} content Содержимое сообщения
 * @param {number} threshold Порог длины текста (по умолчанию 1024 символа)
 * @returns {boolean} true, если изображения нужно отправлять отдельно
 */
export function shouldSendImagesBeforeText(content, threshold = 1024) {
  const formattedContent = formatHtmlForTelegram(content);
  return formattedContent.length > threshold;
}

/**
 * Проверяет наличие и обрабатывает массив дополнительных изображений
 * @param {Array|string|null} additionalImages Массив URL дополнительных изображений или строка JSON
 * @returns {Array<string>} Массив корректных URL изображений
 */
export function processAdditionalImages(additionalImages) {
  if (!additionalImages) return [];
  
  let imagesArray = [];
  
  // Если это строка, пытаемся распарсить как JSON
  if (typeof additionalImages === 'string') {
    try {
      const trimmedStr = additionalImages.trim();
      if (trimmedStr.startsWith('[') || trimmedStr.startsWith('{')) {
        const parsedImages = JSON.parse(additionalImages);
        imagesArray = Array.isArray(parsedImages) ? parsedImages : [parsedImages];
      } else {
        // Это не JSON, а просто строка URL
        imagesArray = [additionalImages];
      }
    } catch (e) {
      // Не удалось распарсить как JSON
      log(`Не удалось распарсить additionalImages как JSON: ${e.message}`, 'telegram');
      if (additionalImages.trim() !== '') {
        imagesArray = [additionalImages];
      }
    }
  } else if (Array.isArray(additionalImages)) {
    // Это уже массив
    imagesArray = additionalImages;
  }
  
  // Фильтруем невалидные URL
  const validImages = imagesArray.filter(url => url && typeof url === 'string' && url.trim() !== '');
  
  log(`Обработано дополнительных изображений: ${validImages.length}`, 'telegram');
  return validImages;
}

/**
 * Форматирует ID чата Telegram в правильный формат
 * @param {string} chatId ID чата или канала Telegram
 * @returns {string} Форматированный ID чата
 */
export function formatChatId(chatId) {
  if (!chatId) return '';
  
  let formattedChatId = chatId;
  
  // Обрабатываем различные форматы ID чатов
  if (chatId.startsWith('@')) {
    // Имя канала начинается с @, оставляем как есть
    formattedChatId = chatId;
  } else if (chatId.startsWith('-100')) {
    // ID суперчата/канала с префиксом -100, оставляем как есть
    formattedChatId = chatId;
  } else if (chatId.startsWith('-')) {
    // ID группы с префиксом -, конвертируем в формат суперчата
    formattedChatId = `-100${chatId.replace(/^-/, '')}`;
  } else if (!isNaN(Number(chatId))) {
    // Числовой ID, добавляем префикс -100
    formattedChatId = `-100${chatId}`;
  }
  
  log(`Форматирование chat ID: исходный "${chatId}" -> форматированный "${formattedChatId}"`, 'telegram');
  return formattedChatId;
}

export default {
  formatHtmlForTelegram,
  fixUnclosedTags,
  processContentForTelegram,
  shouldSendImagesBeforeText,
  processAdditionalImages,
  formatChatId
};