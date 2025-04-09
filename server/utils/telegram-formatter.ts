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
  
  let html = htmlContent;
  
  // Шаг 1: Конвертируем блочные элементы
  // p в текст с переносом строки
  html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  
  // div в текст без дополнительных переносов
  html = html.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1');
  
  // Шаг 2: Конвертируем списки
  // Убираем теги ul/ol
  html = html.replace(/<\/?ul[^>]*>/gi, '');
  html = html.replace(/<\/?ol[^>]*>/gi, '');
  
  // Преобразуем элементы списка в текст с маркером
  html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  // Шаг 3: Конвертируем стандартные форматирующие теги
  // strong/b в <b>
  html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>');
  
  // em/i в <i>
  html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>');
  
  // s/strike/del в <s>
  html = html.replace(/<(s|strike|del)[^>]*>(.*?)<\/\1>/gi, '<s>$2</s>');
  
  // Шаг 4: Удаляем лишние атрибуты из тегов
  // Удаляем все атрибуты из b, i, u, s, code, pre
  html = html.replace(/<(b|i|u|s|code|pre)(?:\s+[^>]*)?>/gi, '<$1>');
  
  // Сохраняем только href в теге a
  html = html.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '<a href="$1">$2</a>');
  
  // Шаг 5: Исправляем незакрытые теги
  html = fixUnclosedTags(html);
  
  // Шаг 6: Удаляем лишние переносы строк
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html.trim();
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