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
    // Логируем оригинальный HTML для отладки
    log(`Исходный HTML для форматирования: ${htmlContent.substring(0, 200)}...`, 'telegram-formatter');
    
    // Предварительная обработка для конвертации стилей в HTML теги
    let preprocessedHtml = preprocessEditorContent(htmlContent);
    
    // Заменяем маркеры списков на символы
    const textWithBullets = replaceBulletPoints(preprocessedHtml);
    
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
 * Предварительная обработка контента из редактора для лучшей совместимости с Telegram
 * @param {string} html HTML из редактора
 * @returns {string} Обработанный HTML
 */
function preprocessEditorContent(html) {
  if (!html) return '';
  
  try {
    // Сохраняем оригинальную длину
    const origLength = html.length;
    
    // Используем более простой подход для обнаружения стилей
    let result = html;
    
    // 1. Обработка HTML тегов со стилями
    // Ищем и заменяем теги со стилем курсива
    const italicRegex = /<[a-z][a-z0-9]*\s+[^>]*?style\s*=\s*["'][^"']*?font-style\s*:\s*italic[^"']*?["'][^>]*>([^<]+)<\/[a-z][a-z0-9]*>/gi;
    result = result.replace(italicRegex, '<i>$1</i>');
    
    // Ищем и заменяем теги со стилем жирного текста
    const boldRegex = /<[a-z][a-z0-9]*\s+[^>]*?style\s*=\s*["'][^"']*?font-weight\s*:\s*(bold|[6-9]00)[^"']*?["'][^>]*>([^<]+)<\/[a-z][a-z0-9]*>/gi;
    result = result.replace(boldRegex, '<b>$2</b>');
    
    // Ищем и заменяем теги со стилем подчеркивания
    const underlineRegex = /<[a-z][a-z0-9]*\s+[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*underline[^"']*?["'][^>]*>([^<]+)<\/[a-z][a-z0-9]*>/gi;
    result = result.replace(underlineRegex, '<u>$1</u>');
    
    // Ищем и заменяем теги со стилем зачеркивания
    const strikeRegex = /<[a-z][a-z0-9]*\s+[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*line-through[^"']*?["'][^>]*>([^<]+)<\/[a-z][a-z0-9]*>/gi;
    result = result.replace(strikeRegex, '<s>$1</s>');
    
    // 2. Обработка специальных тегов
    // Преобразуем <em> в <i>
    result = result.replace(/<em>([^<]+)<\/em>/gi, '<i>$1</i>');
    
    // Преобразуем <strong> в <b>
    result = result.replace(/<strong>([^<]+)<\/strong>/gi, '<b>$1</b>');
    
    // Преобразуем <span class="italic"> в <i>
    const italicClassRegex = /<span\s+[^>]*?class\s*=\s*["'][^"']*?italic[^"']*?["'][^>]*>([^<]+)<\/span>/gi;
    result = result.replace(italicClassRegex, '<i>$1</i>');
    
    // Преобразуем <span class="bold"> в <b>
    const boldClassRegex = /<span\s+[^>]*?class\s*=\s*["'][^"']*?bold[^"']*?["'][^>]*>([^<]+)<\/span>/gi;
    result = result.replace(boldClassRegex, '<b>$1</b>');
    
    // 3. Обработка специального форматирования из редактора
    // Для разных редакторов могут использоваться разные классы или атрибуты
    const editorSpecificRegex = /<span\s+[^>]*?data-format\s*=\s*["']italic["'][^>]*>([^<]+)<\/span>/gi;
    result = result.replace(editorSpecificRegex, '<i>$1</i>');
    
    // 4. Обработка переносов строк
    // Заменяем <br> на \n
    result = result.replace(/<br\s*\/?>/gi, '\n');
    
    // Заменяем <p>...</p> на текст с двойным переносом
    result = result.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // Заменяем <div>...</div> на текст с переносом строки
    result = result.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');
    
    log(`Предварительная обработка: было ${origLength} символов, стало ${result.length}`, 'telegram-formatter');
    
    return result;
  } catch (error) {
    log(`Ошибка предварительной обработки HTML: ${error.message}`, 'telegram-formatter');
    return html; // В случае ошибки возвращаем оригинальный HTML
  }
}

/**
 * Заменяет маркеры списков на символы с учетом уровня вложенности
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст
 */
function replaceBulletPoints(html) {
  // Обрабатываем списки ul/li, превращая их в удобочитаемый текст с символами
  let result = html;
  
  // Рекурсивно обрабатываем вложенные списки начиная с самых глубоких
  // Для этого используем функцию, которая обрабатывает все списки в тексте
  function processLists(text) {
    // Текущая глубина вложенности
    let currentLevel = 0;
    
    // Маркеры для разных уровней вложенности
    const markers = ['•', '◦', '▪', '▫', '⁃'];
    
    // Стек для отслеживания вложенности списков
    const listStack = [];
    
    // Результирующий текст
    let result = '';
    
    // Разбиваем HTML на токены (открывающие/закрывающие теги и текст)
    const tokens = text.split(/(<\/?(?:ul|ol|li)[^>]*>)/gi);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Пропускаем пустые токены
      if (!token.trim()) continue;
      
      // Обрабатываем открывающий тег ul/ol
      if (token.match(/<(ul|ol)[^>]*>/i)) {
        listStack.push(token.match(/<(ul|ol)[^>]*>/i)[1].toLowerCase());
        currentLevel = listStack.length;
        continue;
      }
      
      // Обрабатываем закрывающий тег ul/ol
      if (token.match(/<\/(ul|ol)[^>]*>/i)) {
        listStack.pop();
        currentLevel = listStack.length;
        continue;
      }
      
      // Обрабатываем открывающий тег li
      if (token.match(/<li[^>]*>/i)) {
        // Добавляем перенос строки и отступ в зависимости от уровня вложенности
        const indent = '    '.repeat(currentLevel - 1);
        const marker = markers[Math.min(currentLevel - 1, markers.length - 1)];
        result += `\n${indent}${marker} `;
        continue;
      }
      
      // Обрабатываем закрывающий тег li
      if (token.match(/<\/li>/i)) {
        continue;
      }
      
      // Остальные токены добавляем без изменений
      result += token;
    }
    
    return result;
  }
  
  // Обрабатываем все списки в тексте
  result = processLists(result);
  
  // Удаляем оставшиеся HTML-теги списков, если они остались
  result = result
    .replace(/<\/?li[^>]*>/gi, '')
    .replace(/<\/?ul[^>]*>/gi, '')
    .replace(/<\/?ol[^>]*>/gi, '');
  
  // Удаляем лишние пробелы в начале строк и множественные переносы строк
  result = result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/gm, '')
    .replace(/\n+$/, '');
  
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
  
  // Добавляем отступы для разных маркеров списка
  const markers = ['•', '◦', '▪', '▫', '⁃'];
  for (const marker of markers) {
    // Для каждого маркера создаем регулярное выражение
    const regex = new RegExp(`(\\s*)(${marker})(\\s*)`, 'g');
    // Добавляем перенос строки перед маркером и сохраняем отступы
    result = result.replace(regex, '$1\n$2 ');
  }
  
  return result;
}

/**
 * Создает подпись к изображению с учетом лимитов Telegram
 * @param {string} html HTML-текст для преобразования в подпись
 * @returns {string} Подготовленная подпись к изображению
 */
export function createImageCaption(html) {
  // Применяем специальную обработку для улучшения отображения списков в подписях
  // Используем ту же функцию, что и для обычного текста, но с особенностями для подписей
  
  // Применяем стандартное форматирование HTML для всего контента
  const formattedHtml = formatHtmlForTelegram(html);
  
  // Telegram ограничивает длину подписи 1024 символами
  const TELEGRAM_CAPTION_LIMIT = 1024;
  
  // Если текст короче лимита, используем его полностью
  if (formattedHtml.length <= TELEGRAM_CAPTION_LIMIT) {
    return formattedHtml;
  }
  
  // Иначе обрезаем до лимита и добавляем многоточие
  // Но при этом стараемся сохранить целостность форматирования
  
  // Находим последнюю открытую тег в обрезанном тексте
  const partialText = formattedHtml.substring(0, TELEGRAM_CAPTION_LIMIT - 3);
  const openTagRegex = /<([a-z][a-z0-9]*)[^>]*>/gi;
  const closeTagRegex = /<\/([a-z][a-z0-9]*)[^>]*>/gi;
  
  // Получаем все открывающие и закрывающие теги
  const openTags = [];
  const closeTags = [];
  let match;
  
  // Сначала находим все открывающие теги
  while ((match = openTagRegex.exec(partialText)) !== null) {
    openTags.push(match[1].toLowerCase());
  }
  
  // Затем находим все закрывающие теги
  while ((match = closeTagRegex.exec(partialText)) !== null) {
    closeTags.push(match[1].toLowerCase());
  }
  
  // Для каждого открывающего тега, который не имеет закрывающего,
  // добавляем закрывающий в конец обрезанного текста
  const unclosedTags = [];
  for (const tag of openTags) {
    // Удаляем из списка закрытые теги
    const closeIndex = closeTags.indexOf(tag);
    if (closeIndex !== -1) {
      closeTags.splice(closeIndex, 1);
    } else {
      // Если тег не найден среди закрывающих, добавляем его в список незакрытых
      unclosedTags.unshift(tag);
    }
  }
  
  // Формируем закрывающие теги
  let closingTags = '';
  for (const tag of unclosedTags) {
    if (ALLOWED_TAGS.includes(tag)) {
      closingTags += `</${tag}>`;
    }
  }
  
  return partialText + closingTags + '...';
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