/**
 * Утилиты для форматирования HTML-текста для Telegram
 * Telegram поддерживает ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">
 */

import { log } from './logger.js';

/**
 * Разрешенные HTML-теги в Telegram
 * @type {string[]}
 */
const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];

/**
 * Специальные символы для экранирования
 * @type {Object}
 */
const SPECIAL_CHARS_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Форматирует HTML-текст для отправки в Telegram
 * @param {string} htmlContent HTML-текст для форматирования
 * @returns {string} Отформатированный HTML-текст
 */
export function formatHtmlForTelegram(htmlContent) {
  if (!htmlContent) return '';
  
  try {
    // Заменяем маркеры списков на символы
    const textWithBullets = replaceBulletPoints(htmlContent);
    
    // Очищаем от атрибутов, которые не поддерживаются в Telegram
    const cleanedHtml = cleanupHtmlAttributes(textWithBullets);
    
    // Исправляем незакрытые теги
    const fixedHtml = fixUnclosedTags(cleanedHtml);
    
    // Добавляем дополнительное форматирование
    const formattedHtml = enhanceFormatting(fixedHtml);
    
    // Логируем форматированный результат для отладки
    log(`Форматирование HTML для Telegram: ${formattedHtml.substring(0, 100)}...`, 'telegram-formatter');
    
    return formattedHtml;
  } catch (error) {
    log(`Ошибка форматирования HTML для Telegram: ${error.message}`, 'telegram-formatter');
    return htmlContent; // Возвращаем исходный текст в случае ошибки
  }
}

/**
 * Заменяет маркеры списков на символы
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст
 */
function replaceBulletPoints(html) {
  // Заменяем различные варианты маркеров списка
  let result = html
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');
  
  return result;
}

/**
 * Очищает HTML от атрибутов, кроме href для тега a
 * @param {string} html HTML-текст для очистки
 * @returns {string} Очищенный HTML-текст
 */
function cleanupHtmlAttributes(html) {
  // Сохраняем только разрешенные атрибуты
  return html.replace(/<([a-z][a-z0-9]*)(?:\s+([^>]*))?>/gi, (match, tagName, attributes) => {
    const lowerTagName = tagName.toLowerCase();
    
    // Если тег не в списке разрешенных, заменяем его на текст
    if (!ALLOWED_TAGS.includes(lowerTagName)) {
      if (lowerTagName === 'p') {
        return '\n\n'; // Параграфы заменяем на двойной перенос строки
      } else if (lowerTagName === 'br') {
        return '\n'; // Переносы строк сохраняем
      } else if (lowerTagName === 'div') {
        return '\n'; // Div заменяем на перенос строки
      } else {
        return ''; // Остальные неразрешенные теги просто удаляем
      }
    }
    
    // Для ссылок сохраняем только атрибут href
    if (lowerTagName === 'a' && attributes) {
      const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
      if (hrefMatch) {
        return `<a href="${hrefMatch[1]}">`;
      }
    }
    
    // Для остальных разрешенных тегов удаляем все атрибуты
    return `<${lowerTagName}>`;
  });
}

/**
 * Исправляет незакрытые HTML-теги
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
export function fixUnclosedTags(html) {
  const stack = [];
  let result = html;
  
  // Регулярное выражение для поиска открывающих и закрывающих тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  // Получаем все теги в порядке их появления
  const tags = [];
  let match;
  while ((match = tagRegex.exec(html))) {
    tags.push({
      tag: match[0],
      name: match[1].toLowerCase(),
      isClosing: match[0].startsWith('</'),
      index: match.index
    });
  }
  
  // Проходим по всем тегам и находим незакрытые
  for (const { tag, name, isClosing, index } of tags) {
    if (isClosing) {
      // Закрывающий тег - проверяем, соответствует ли он последнему открытому
      if (stack.length > 0 && stack[stack.length - 1].name === name) {
        stack.pop(); // Тег закрыт корректно
      } else {
        // Закрывающий тег не соответствует открытому - возможно, пропущен закрывающий тег
        let matchFound = false;
        
        // Ищем этот тег в стеке
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
            matchFound = true;
            
            // Закрываем все теги до найденного
            for (let j = stack.length - 1; j >= i; j--) {
              result = result.slice(0, index) + `</${stack[j].name}>` + result.slice(index);
              stack.pop();
            }
            break;
          }
        }
        
        // Если тег не найден в стеке, это лишний закрывающий тег - удаляем его
        if (!matchFound) {
          result = result.slice(0, index) + result.slice(index + tag.length);
        }
      }
    } else if (!tag.endsWith('/>')) {
      // Открывающий тег - добавляем в стек
      if (ALLOWED_TAGS.includes(name)) {
        stack.push({ name, index: index + tag.length });
      }
    }
  }
  
  // Закрываем все оставшиеся открытые теги
  if (stack.length > 0) {
    for (let i = stack.length - 1; i >= 0; i--) {
      result += `</${stack[i].name}>`;
    }
  }
  
  return result;
}

/**
 * Расширяет форматирование для лучшего отображения в Telegram
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст
 */
function enhanceFormatting(html) {
  // Убираем лишние переносы строк
  let result = html
    .replace(/\n{3,}/g, '\n\n')    // Не более двух переносов подряд
    .replace(/^\n+|\n+$/g, '');    // Убираем переносы в начале и конце
  
  // Исправляем параграфы, добавляя двойные переносы
  result = result
    .replace(/<\/p>\s*<p>/gi, '\n\n')        // Между параграфами добавляем двойной перенос
    .replace(/<p>\s*([^<]*)\s*<\/p>/gi, '$1\n\n');  // Параграфы заменяем на их содержимое и двойной перенос
  
  // Добавляем отступы для списков
  result = result
    .replace(/•/g, '  \n• ');  // Добавляем отступ для маркеров списка
  
  return result;
}

/**
 * Создает подпись к изображению с учетом лимитов Telegram
 * @param {string} html HTML-текст для преобразования в подпись
 * @returns {string} Подготовленная подпись к изображению
 */
export function createImageCaption(html) {
  const formattedHtml = formatHtmlForTelegram(html);
  
  // Telegram ограничивает длину подписи 1024 символами
  const TELEGRAM_CAPTION_LIMIT = 1024;
  
  // Если текст короче лимита, используем его полностью
  if (formattedHtml.length <= TELEGRAM_CAPTION_LIMIT) {
    return formattedHtml;
  }
  
  // Иначе обрезаем до лимита и добавляем многоточие
  return formattedHtml.substring(0, TELEGRAM_CAPTION_LIMIT - 3) + '...';
}

/**
 * Проверяет, содержит ли контент HTML-теги
 * @param {string} content Текст для проверки
 * @returns {boolean} Содержит ли текст HTML-теги
 */
export function containsHtml(content) {
  if (!content) return false;
  
  // Регулярное выражение для проверки наличия HTML-тегов
  const htmlRegex = /<\/?[a-z][^>]*>/i;
  
  return htmlRegex.test(content);
}

/**
 * Разделяет длинный текст на части с учетом целостности тегов
 * @param {string} html HTML-текст для разделения
 * @param {number} maxLength Максимальная длина части (по умолчанию 4096 символов)
 * @returns {string[]} Массив частей HTML-текста
 */
export function splitLongMessage(html, maxLength = 4096) {
  if (!html || html.length <= maxLength) {
    return [html];
  }
  
  const formattedHtml = formatHtmlForTelegram(html);
  const parts = [];
  let currentPart = '';
  let tagStack = [];
  
  // Разбиваем HTML на токены (теги и текст)
  const tokens = formattedHtml.split(/(<[^>]*>)/);
  
  for (const token of tokens) {
    if (!token) continue;
    
    // Если текущая часть и новый токен не превышают лимит, добавляем токен
    if (currentPart.length + token.length <= maxLength) {
      currentPart += token;
      
      // Обновляем стек тегов
      if (token.startsWith('<') && !token.startsWith('</')) {
        // Открывающий тег
        const tagName = token.match(/<([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
        if (tagName && ALLOWED_TAGS.includes(tagName)) {
          tagStack.push(tagName);
        }
      } else if (token.startsWith('</')) {
        // Закрывающий тег
        const tagName = token.match(/<\/([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
        if (tagName && tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
        }
      }
    } else {
      // Если добавление токена превысит лимит, закрываем все открытые теги
      let closingTags = '';
      for (let i = tagStack.length - 1; i >= 0; i--) {
        closingTags += `</${tagStack[i]}>`;
      }
      
      // Добавляем текущую часть с закрытыми тегами
      parts.push(currentPart + closingTags);
      
      // Начинаем новую часть с открытием всех тегов из стека
      let openingTags = '';
      for (let i = 0; i < tagStack.length; i++) {
        openingTags += `<${tagStack[i]}>`;
      }
      
      // Если токен - это тег, добавляем его в новую часть
      if (token.startsWith('<')) {
        currentPart = openingTags + token;
        
        // Обновляем стек тегов для нового токена
        if (!token.startsWith('</')) {
          const tagName = token.match(/<([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
          if (tagName && ALLOWED_TAGS.includes(tagName)) {
            tagStack.push(tagName);
          }
        } else {
          const tagName = token.match(/<\/([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
          if (tagName && tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
            tagStack.pop();
          }
        }
      } else {
        // Если токен - это текст, начинаем с него новую часть
        const truncatedToken = token.length > maxLength 
          ? token.substring(0, maxLength - openingTags.length) 
          : token;
        currentPart = openingTags + truncatedToken;
      }
    }
  }
  
  // Добавляем последнюю часть, если она не пуста
  if (currentPart) {
    parts.push(currentPart);
  }
  
  return parts;
}

// Экспортируем все функции
export default {
  formatHtmlForTelegram,
  createImageCaption,
  containsHtml,
  splitLongMessage
};