/**
 * Утилита для преобразования HTML из редактора в формат, совместимый с Telegram API
 * 
 * Эта утилита специально обрабатывает стилизованный текст из редактора,
 * превращая его в корректный HTML формат, который поддерживается Telegram API.
 */

import { log } from './logger.js';

/**
 * Основные теги, поддерживаемые Telegram
 * @type {string[]}
 */
const TELEGRAM_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];

/**
 * Преобразует HTML из редактора в формат Telegram
 * @param {string} html HTML-текст из редактора
 * @returns {string} HTML-текст в формате Telegram
 */
export function convertEditorToTelegram(html) {
  if (!html) return '';
  
  try {
    log(`Преобразование HTML из редактора в формат Telegram, длина: ${html.length}`, 'editor-to-telegram');
    
    // Сохраняем оригинальный HTML для отладки
    const originalHtml = html;
    
    // Шаг 1: Преобразование inline стилей в соответствующие HTML теги
    let result = convertInlineStylesToTags(html);
    
    // Шаг 2: Преобразование блочных элементов в формат Telegram
    result = convertBlockElementsToTelegram(result);
    
    // Шаг 3: Удаление атрибутов, кроме href у ссылок
    result = removeUnsupportedAttributes(result);
    
    // Шаг 4: Обработка переносов строк
    result = fixLineBreaks(result);
    
    // Шаг 5: Исправление незакрытых тегов
    result = fixUnclosedTags(result);
    
    log(`Преобразование успешно, исходный HTML: ${originalHtml.length} символов, результат: ${result.length} символов`, 'editor-to-telegram');
    
    return result;
  } catch (error) {
    log(`Ошибка при преобразовании HTML из редактора: ${error.message}`, 'editor-to-telegram');
    return html; // В случае ошибки возвращаем исходный HTML
  }
}

/**
 * Преобразует inline стили в HTML теги
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст с преобразованными стилями
 */
function convertInlineStylesToTags(html) {
  let result = html;
  
  try {
    log(`Обработка редакторского HTML для Telegram: длина ${html.length} символов`, 'editor-to-telegram');
    
    // Более точное преобразование для курсива (font-style: italic)
    result = result.replace(
      /<([a-z][a-z0-9]*)\s+[^>]*?style\s*=\s*["'][^"']*?font-style\s*:\s*italic[^"']*?["'][^>]*>([\s\S]*?)<\/\1>/gi, 
      '<i>$2</i>'
    );
    
    // Более точное преобразование для жирного текста (font-weight: bold|700)
    result = result.replace(
      /<([a-z][a-z0-9]*)\s+[^>]*?style\s*=\s*["'][^"']*?font-weight\s*:\s*(bold|[6-9]00)[^"']*?["'][^>]*>([\s\S]*?)<\/\1>/gi, 
      '<b>$3</b>'
    );
    
    // Более точное преобразование для подчеркнутого текста (text-decoration: underline)
    result = result.replace(
      /<([a-z][a-z0-9]*)\s+[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*underline[^"']*?["'][^>]*>([\s\S]*?)<\/\1>/gi, 
      '<u>$2</u>'
    );
    
    // Более точное преобразование для зачеркнутого текста (text-decoration: line-through)
    result = result.replace(
      /<([a-z][a-z0-9]*)\s+[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*line-through[^"']*?["'][^>]*>([\s\S]*?)<\/\1>/gi, 
      '<s>$2</s>'
    );
    
    log(`HTML после обработки стилей: ${result.substring(0, 100)}...`, 'editor-to-telegram');
    
    // Преобразуем стандартные HTML теги в формат Telegram
    // Тег strong в b
    result = result.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>');
    
    // Тег em в i
    result = result.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>');
    
    // Тег del и strike в s
    result = result.replace(/<(del|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '<s>$2</s>');
    
    // Тег ins в u и прямое использование u
    result = result.replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>');
    result = result.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
    
    // Тег code оставляем как есть, но очищаем атрибуты
    result = result.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>');
    
    // Тег pre оставляем как есть, но очищаем атрибуты
    result = result.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>');
    
    // Обработка ссылок - сохраняем только href атрибут
    result = result.replace(
      /<a[^>]*href\s*=\s*["'](.*?)["'][^>]*>([\s\S]*?)<\/a>/gi, 
      '<a href="$1">$2</a>'
    );
    
    log(`HTML после обработки тегов: ${result.substring(0, 100)}...`, 'editor-to-telegram');
    
    return result;
  } catch (error) {
    log(`Ошибка при преобразовании инлайн-стилей в теги: ${error.message}`, 'editor-to-telegram');
    return html; // Возвращаем исходный текст в случае ошибки
  }
}

/**
 * Преобразует блочные элементы в формат Telegram
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст с преобразованными блочными элементами
 */
function convertBlockElementsToTelegram(html) {
  let result = html;
  
  // 1. Преобразуем абзацы в текст с двойным переносом
  result = result.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // 2. Преобразуем div в текст с переносом
  result = result.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');
  
  // 3. Преобразуем заголовки в жирный текст с двойным переносом
  result = result.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n');
  
  // 4. Преобразуем списки
  // Заменяем ul/ol на текст без дополнительного форматирования
  result = result.replace(/<(ul|ol)[^>]*>(.*?)<\/\1>/gi, '$2');
  
  // Преобразуем элементы списка в текст с маркером
  result = result.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  // 5. Преобразуем <br> в переносы строк
  result = result.replace(/<br\s*\/?>/gi, '\n');
  
  return result;
}

/**
 * Удаляет неподдерживаемые атрибуты из тегов
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст без неподдерживаемых атрибутов
 */
function removeUnsupportedAttributes(html) {
  return html.replace(/<([a-z][a-z0-9]*)(?:\s+([^>]*))?>/gi, (match, tagName, attributes) => {
    const lowerTagName = tagName.toLowerCase();
    
    // Если тег не поддерживается Telegram, удаляем его
    if (!TELEGRAM_TAGS.includes(lowerTagName)) {
      return '';
    }
    
    // Для ссылок сохраняем только атрибут href
    if (lowerTagName === 'a' && attributes) {
      const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
      if (hrefMatch) {
        return `<a href="${hrefMatch[1]}">`;
      }
    }
    
    // Для остальных поддерживаемых тегов удаляем все атрибуты
    return `<${lowerTagName}>`;
  });
}

/**
 * Исправляет переносы строк в тексте
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст с исправленными переносами строк
 */
function fixLineBreaks(html) {
  // Удаляем повторяющиеся переносы строк (оставляем не более двух подряд)
  let result = html.replace(/\n{3,}/g, '\n\n');
  
  // Удаляем пробелы в начале строки и переносы в конце
  result = result.replace(/^\s+/gm, '').replace(/\n+$/, '');
  
  return result;
}

/**
 * Исправляет незакрытые HTML теги
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст с исправленными незакрытыми тегами
 */
function fixUnclosedTags(html) {
  const stack = [];
  let result = html;
  
  // Регулярное выражение для поиска всех HTML тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  let match;
  let lastIndex = 0;
  const tags = [];
  
  // Находим все теги
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = tag.startsWith('</');
    
    tags.push({
      tag,
      tagName,
      isClosing,
      index: match.index
    });
  }
  
  // Обрабатываем теги
  for (const tag of tags) {
    if (tag.isClosing) {
      // Закрывающий тег - ищем соответствующий открывающий
      if (stack.length > 0 && stack[stack.length - 1] === tag.tagName) {
        // Найден - удаляем из стека
        stack.pop();
      } else {
        // Не найден - это лишний закрывающий тег
        // Определяем есть ли этот тег в стеке
        const index = stack.indexOf(tag.tagName);
        if (index !== -1) {
          // Тег есть в стеке, но не на вершине - закрываем все теги до него
          const tagsToClose = stack.slice(index + 1);
          // Удаляем лишний закрывающий тег
          result = result.substring(0, tag.index) + result.substring(tag.index + tag.tag.length);
          // Закрываем все теги до нужного и удаляем их из стека
          for (let i = stack.length - 1; i > index; i--) {
            result = result.substring(0, tag.index) + `</${stack[i]}>` + result.substring(tag.index);
            stack.pop();
          }
          // Закрываем нужный тег и удаляем его из стека
          result = result.substring(0, tag.index) + `</${stack[index]}>` + result.substring(tag.index);
          stack.splice(index, 1);
        } else {
          // Тега нет в стеке - удаляем лишний закрывающий тег
          result = result.substring(0, tag.index) + result.substring(tag.index + tag.tag.length);
        }
      }
    } else if (!tag.tag.endsWith('/>')) {
      // Открывающий тег - добавляем в стек
      if (TELEGRAM_TAGS.includes(tag.tagName)) {
        stack.push(tag.tagName);
      }
    }
  }
  
  // Закрываем все оставшиеся открытые теги
  for (let i = stack.length - 1; i >= 0; i--) {
    result += `</${stack[i]}>`;
  }
  
  return result;
}

// Экспортируем утилиту
export default {
  convertEditorToTelegram
};