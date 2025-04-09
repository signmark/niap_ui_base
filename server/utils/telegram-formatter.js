/**
 * telegram-formatter.js
 * 
 * Модуль для форматирования контента для отправки в Telegram.
 * Telegram поддерживает ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">
 */

/**
 * Преобразует HTML в формат, совместимый с Telegram API
 * @param {string} html Исходный HTML-текст
 * @returns {string} Отформатированный HTML-текст, готовый для Telegram
 */
export function formatHtmlForTelegram(html) {
  if (!html) return '';
  
  // 1. Предварительная обработка блочных элементов и списков
  let result = preprocessHtml(html);
  
  // 2. Упрощение HTML до поддерживаемых тегов
  result = processHtmlTags(result);
  
  // 3. Проверка ограничений по размеру и разделение сообщения при необходимости
  return result;
}

/**
 * Предварительная обработка HTML для замены блочных элементов
 * @param {string} html Исходный HTML
 * @returns {string} HTML с обработанными блочными элементами
 */
function preprocessHtml(html) {
  return html
    // Удаление комментариев и специальных тегов
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?([\s\S]*?)\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '')
    
    // Обработка блочных элементов
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Обработка списков
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
}

/**
 * Проверяет, является ли тег поддерживаемым в Telegram
 * @param {string} tag Имя тега
 * @returns {boolean} true, если тег поддерживается
 */
function isSupportedTag(tag) {
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  return supportedTags.includes(tag.toLowerCase());
}

/**
 * Преобразует имя тега в стандартизированный эквивалент для Telegram
 * @param {string} tag Имя тега
 * @returns {string} Стандартизированное имя тега
 */
function normalizeTagName(tag) {
  const tagMap = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u', 
    'strike': 's',
    'del': 's'
  };
  
  return tagMap[tag.toLowerCase()] || tag.toLowerCase();
}

/**
 * Преобразует HTML-текст в простой плоский текст (без тегов)
 * @param {string} html HTML-текст
 * @returns {string} Простой текст без тегов
 */
export function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Токенизирует HTML на части (теги и текст)
 * @param {string} html Исходный HTML
 * @returns {Array} Массив токенов
 */
function tokenizeHtml(html) {
  const tokens = [];
  let currentText = '';
  let inTag = false;
  let currentTag = '';
  
  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    
    if (char === '<') {
      // Начало тега
      if (currentText) {
        tokens.push({ type: 'text', content: currentText });
        currentText = '';
      }
      inTag = true;
      currentTag = '<';
    } else if (char === '>' && inTag) {
      // Конец тега
      currentTag += '>';
      
      // Анализ тега
      const tagMatch = currentTag.match(/<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/i);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        const isClosing = currentTag.startsWith('</');
        
        // Добавляем только поддерживаемые теги
        if (isSupportedTag(tagName)) {
          tokens.push({
            type: 'tag',
            content: currentTag,
            tagName,
            isClosing
          });
        }
      }
      
      inTag = false;
      currentTag = '';
    } else if (inTag) {
      // Внутри тега
      currentTag += char;
    } else {
      // Обычный текст
      currentText += char;
    }
  }
  
  // Добавляем оставшийся текст
  if (currentText) {
    tokens.push({ type: 'text', content: currentText });
  }
  
  return tokens;
}

/**
 * Обрабатывает HTML-теги, сохраняя только поддерживаемые Telegram
 * @param {string} html Исходный HTML
 * @returns {string} Обработанный HTML
 */
function processHtmlTags(html) {
  // 1. Заменяем HTML-эквиваленты обычными символами
  html = html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  
  // 2. Нормализуем стандартные теги
  html = html
    .replace(/<strong\b([^>]*)>([\s\S]*?)<\/strong>/gi, '<b$1>$2</b>')
    .replace(/<em\b([^>]*)>([\s\S]*?)<\/em>/gi, '<i$1>$2</i>')
    .replace(/<u\b([^>]*)>([\s\S]*?)<\/u>/gi, '<u$1>$2</u>')
    .replace(/<ins\b([^>]*)>([\s\S]*?)<\/ins>/gi, '<u$1>$2</u>')
    .replace(/<s\b([^>]*)>([\s\S]*?)<\/s>/gi, '<s$1>$2</s>')
    .replace(/<strike\b([^>]*)>([\s\S]*?)<\/strike>/gi, '<s$1>$2</s>')
    .replace(/<del\b([^>]*)>([\s\S]*?)<\/del>/gi, '<s$1>$2</s>');
  
  // 3. Токенизируем HTML
  const tokens = tokenizeHtml(html);
  
  // 4. Собираем результат с правильной структурой тегов
  return rebuildHtmlFromTokens(tokens);
}

/**
 * Восстанавливает HTML из токенов с правильной структурой
 * @param {Array} tokens Массив токенов
 * @returns {string} Собранный HTML
 */
function rebuildHtmlFromTokens(tokens) {
  if (!tokens || tokens.length === 0) return '';
  
  let result = '';
  const openTags = [];
  
  for (const token of tokens) {
    if (token.type === 'text') {
      // Просто добавляем текст
      result += token.content;
    } else if (token.type === 'tag') {
      const normalizedTagName = normalizeTagName(token.tagName);
      
      if (token.isClosing) {
        // Закрывающий тег
        const lastOpenTagIndex = openTags.lastIndexOf(normalizedTagName);
        
        if (lastOpenTagIndex !== -1) {
          // Закрываем все открытые теги до найденного, а затем открываем их снова
          const tagsToClose = openTags.splice(lastOpenTagIndex);
          
          for (const tag of tagsToClose) {
            result += `</${tag}>`;
          }
        }
      } else {
        // Открывающий тег
        
        // Специальная обработка для ссылок
        if (normalizedTagName === 'a') {
          const hrefMatch = token.content.match(/href\s*=\s*['"]([^'"]+)['"]/i);
          if (hrefMatch) {
            result += `<a href="${hrefMatch[1]}">`;
            openTags.push(normalizedTagName);
          }
        } else {
          result += `<${normalizedTagName}>`;
          openTags.push(normalizedTagName);
        }
      }
    }
  }
  
  // Закрываем все оставшиеся открытые теги
  for (let i = openTags.length - 1; i >= 0; i--) {
    result += `</${openTags[i]}>`;
  }
  
  return result;
}

/**
 * Разбивает длинное сообщение на несколько частей с сохранением HTML структуры
 * @param {string} html HTML текст
 * @param {number} maxLength Максимальная длина части
 * @returns {Array<string>} Массив частей сообщения
 */
export function splitLongMessage(html, maxLength = 4000) {
  if (!html || html.length <= maxLength) {
    return [html];
  }
  
  // Токенизация HTML
  const tokens = tokenizeHtml(html);
  const parts = [];
  let currentPart = '';
  let currentOpenTags = [];
  
  for (const token of tokens) {
    if (token.type === 'text') {
      // Для текстовых токенов, нужно проверить, не превысим ли мы максимальную длину
      if (currentPart.length + token.content.length > maxLength) {
        // Сначала закрываем все открытые теги в текущей части
        for (let i = currentOpenTags.length - 1; i >= 0; i--) {
          currentPart += `</${currentOpenTags[i]}>`;
        }
        
        parts.push(currentPart);
        
        // Начинаем новую часть, открыв все теги, которые были открыты ранее
        currentPart = '';
        for (const tag of currentOpenTags) {
          currentPart += `<${tag}>`;
        }
        
        // Добавляем текст
        currentPart += token.content;
      } else {
        // Просто добавляем текст
        currentPart += token.content;
      }
    } else if (token.type === 'tag') {
      const normalizedTagName = normalizeTagName(token.tagName);
      
      if (token.isClosing) {
        // Для закрывающего тега, удаляем его из списка открытых
        const index = currentOpenTags.lastIndexOf(normalizedTagName);
        if (index !== -1) {
          currentOpenTags.splice(index, 1);
        }
        currentPart += `</${normalizedTagName}>`;
      } else {
        // Для открывающего тега, добавляем его в список открытых
        if (normalizedTagName === 'a') {
          const hrefMatch = token.content.match(/href\s*=\s*['"]([^'"]+)['"]/i);
          if (hrefMatch) {
            currentPart += `<a href="${hrefMatch[1]}">`;
            currentOpenTags.push(normalizedTagName);
          }
        } else {
          currentPart += `<${normalizedTagName}>`;
          currentOpenTags.push(normalizedTagName);
        }
      }
    }
    
    // Проверяем, не превысила ли текущая часть максимальную длину
    if (currentPart.length >= maxLength) {
      // Закрываем все открытые теги
      const tempTags = [...currentOpenTags];
      for (let i = tempTags.length - 1; i >= 0; i--) {
        currentPart += `</${tempTags[i]}>`;
      }
      
      parts.push(currentPart);
      
      // Начинаем новую часть
      currentPart = '';
      for (const tag of currentOpenTags) {
        currentPart += `<${tag}>`;
      }
    }
  }
  
  // Добавляем последнюю часть, если она не пустая
  if (currentPart) {
    // Закрываем все открытые теги
    for (let i = currentOpenTags.length - 1; i >= 0; i--) {
      currentPart += `</${currentOpenTags[i]}>`;
    }
    parts.push(currentPart);
  }
  
  return parts;
}

/**
 * Проверяет, является ли HTML корректным для отправки в Telegram
 * @param {string} html HTML текст
 * @returns {boolean} true, если HTML правильно структурирован
 */
export function isValidTelegramHtml(html) {
  // Проверка на закрытые теги
  const openingTags = html.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi) || [];
  const closingTags = html.match(/<\/[a-z][a-z0-9]*>/gi) || [];
  
  if (openingTags.length !== closingTags.length) {
    return false;
  }
  
  // Проверка на поддерживаемые теги
  const supportedTagsRegex = /<\/?(?!b|i|u|s|code|pre|a\b)[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi;
  const unsupportedTags = html.match(supportedTagsRegex);
  
  if (unsupportedTags && unsupportedTags.length > 0) {
    return false;
  }
  
  return true;
}