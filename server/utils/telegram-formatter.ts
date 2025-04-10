/**
 * Утилиты для форматирования HTML-текста для Telegram
 * Telegram поддерживает ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">
 */

/**
 * Разрешенные HTML-теги в Telegram
 */
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre', 'a'];

/**
 * Исправляет незакрытые HTML-теги
 * @param html HTML-текст для исправления
 * @returns Исправленный HTML-текст
 */
export function fixUnclosedTags(html: string): string {
  if (!html) return '';
  
  const stack: string[] = [];
  let result = html;
  
  // Регулярное выражение для поиска HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  // Находим все теги и отслеживаем открытые и закрытые
  result = result.replace(tagRegex, (match, tagName) => {
    // Пропускаем самозакрывающиеся теги (например, <br/>)
    if (match.endsWith('/>')) {
      return match;
    }
    
    // Проверяем, является ли тег закрывающим
    if (match.startsWith('</')) {
      // Если стек не пустой и текущий тег закрывает последний открытый тег
      if (stack.length > 0 && stack[stack.length - 1].toLowerCase() === tagName.toLowerCase()) {
        stack.pop(); // Удаляем соответствующий открытый тег из стека
      } else {
        // Если закрывающий тег не соответствует последнему открытому тегу
        // Пропускаем его (удаляем из результата)
        return '';
      }
    } else {
      // Если тег открывающий, добавляем его в стек
      const cleanTagName = tagName.toLowerCase();
      
      // Добавляем только поддерживаемые Telegram теги
      if (ALLOWED_TAGS.includes(cleanTagName)) {
        stack.push(cleanTagName);
      } else {
        // Для неподдерживаемых тегов возвращаем пустую строку
        return '';
      }
    }
    
    return match;
  });
  
  // Закрываем все оставшиеся открытые теги в обратном порядке
  while (stack.length > 0) {
    const tag = stack.pop();
    result += `</${tag}>`;
  }
  
  return result;
}

/**
 * Форматирует HTML-текст для отправки в Telegram
 * @param htmlContent HTML-текст для форматирования
 * @returns Отформатированный HTML-текст
 */
export function formatHtmlForTelegram(htmlContent: string): string {
  if (!htmlContent) return '';
  
  let result = htmlContent;
  
  // Сначала удаляем неподдерживаемые теги и их содержимое
  const unsupportedBlockTags = ['ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'font'];
  for (const tag of unsupportedBlockTags) {
    // Удаляем открывающие и закрывающие теги, оставляя содержимое
    const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeTagRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(openTagRegex, '');
    result = result.replace(closeTagRegex, '');
  }
  
  // Обрабатываем блочные элементы
  result = result.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
  result = result.replace(/<div[^>]*>(.*?)<\/div>/gis, '$1\n');
  result = result.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '$1\n\n');
  
  // Обрабатываем списки
  result = result.replace(/<li[^>]*>(.*?)<\/li>/gis, '• $1\n');
  
  // Заменяем тег <br> и <br/> на перенос строки
  result = result.replace(/<br\s*\/?>/gi, '\n');
  
  // Конвертируем стандартные форматирующие теги
  result = result.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '<b>$1</b>');
  result = result.replace(/<em[^>]*>(.*?)<\/em>/gis, '<i>$1</i>');
  result = result.replace(/<(s|strike|del)[^>]*>(.*?)<\/\1>/gis, '<s>$2</s>');
  
  // Исправляем незакрытые теги и управляем вложенностью
  const allowedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  const stack: string[] = [];
  
  // Находим все теги
  result = result.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    
    // Преобразование эквивалентных тегов
    let normalizedTag = tag;
    if (tag === 'strong') normalizedTag = 'b';
    if (tag === 'em') normalizedTag = 'i';
    if (tag === 'strike') normalizedTag = 's';
    if (tag === 'del') normalizedTag = 's';
    
    // Если тег не поддерживается, удаляем его
    if (!allowedTags.includes(normalizedTag)) {
      return '';
    }
    
    // Если это закрывающий тег
    if (match.startsWith('</')) {
      if (stack.length > 0 && stack[stack.length - 1] === normalizedTag) {
        stack.pop(); // Удаляем из стека
        return `</${normalizedTag}>`; // Возвращаем нормализованный закрывающий тег
      }
      return ''; // Удаляем несоответствующий закрывающий тег
    } 
    // Если это открывающий тег
    else {
      // Если тег a, сохраняем только href
      if (normalizedTag === 'a') {
        const hrefMatch = match.match(/href=["']([^"']*)["']/i);
        if (hrefMatch) {
          stack.push('a');
          return `<a href="${hrefMatch[1]}">`;
        }
        return ''; // Если нет href, удаляем тег
      }
      
      // Для других поддерживаемых тегов, сохраняем только имя тега
      stack.push(normalizedTag);
      return `<${normalizedTag}>`;
    }
  });
  
  // Закрываем все оставшиеся открытые теги
  while (stack.length > 0) {
    const tag = stack.pop();
    if (tag) {
      result += `</${tag}>`;
    }
  }
  
  // Удаляем лишние пробелы и переносы
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/^\s+|\s+$/g, '');
  
  return result;
}

/**
 * Стандартизирует HTML-теги для отправки в Telegram
 * @param html HTML-текст для форматирования
 * @returns Отформатированный HTML-текст, готовый для отправки в Telegram
 */
export function standardizeTelegramTags(html: string): string {
  if (!html) return '';
  
  // Применяем полное форматирование HTML для Telegram
  let formattedHtml = formatHtmlForTelegram(html);
  
  // Дополнительная обработка HTML после основного форматирования
  formattedHtml = postProcessHtml(formattedHtml);
  
  return formattedHtml;
}

/**
 * Выполняет дополнительную обработку HTML после основного форматирования
 * @param html Предварительно отформатированный HTML
 * @returns Окончательно отформатированный HTML
 */
// Функция для дополнительной обработки HTML после основного форматирования
export function postProcessHtml(html: string): string {
  if (!html) return '';
  
  let processedHtml = html;
  
  // Удаляем лишние пробелы
  processedHtml = processedHtml.replace(/\s+/g, ' ').trim();
  
  // Удаляем пробелы перед знаками препинания
  processedHtml = processedHtml.replace(/\s+([.,;:!?])/g, '$1');
  
  // Убираем пустые теги
  processedHtml = processedHtml.replace(/<([a-z][a-z0-9]*)\b[^>]*>\s*<\/\1>/gi, '');
  
  return processedHtml;
}