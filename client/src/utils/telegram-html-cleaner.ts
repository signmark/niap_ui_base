/**
 * Утилита для очистки и подготовки HTML к публикации в Telegram
 * Реализует тот же алгоритм, что и серверная обработка, чтобы обеспечить
 * WYSIWYG функциональность для редактора Telegram
 */

/**
 * Список тегов, поддерживаемых Telegram
 * @type {string[]}
 */
const TELEGRAM_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];

/**
 * Очищает и форматирует HTML для публикации в Telegram
 * @param {string} html HTML-текст для очистки
 * @returns {string} Очищенный HTML-текст, готовый для Telegram
 */
export function cleanHtmlForTelegram(html: string): string {
  if (!html) return '';
  
  try {
    // Сохраняем исходный HTML для отслеживания изменений
    const originalHtml = html;
    
    // Шаг 1: Нормализация тегов HTML
    let result = normalizeHtmlTags(html);
    
    // Шаг 2: Конвертация блоков в текстовый формат
    result = convertBlocksToText(result);
    
    // Шаг 3: Преобразование маркированных списков
    result = convertLists(result);
    
    // Шаг 4: Удаление лишних атрибутов и неподдерживаемых тегов
    result = removeUnsupportedTags(result);
    
    // Шаг 5: Нормализация пробелов и переносов строк
    result = normalizeSpacesAndLinebreaks(result);
    
    // Шаг 6: Исправление незакрытых тегов
    result = fixUnclosedTags(result);
    
    return result;
  } catch (error) {
    console.error('Ошибка при очистке HTML для Telegram:', error);
    return html; // В случае ошибки возвращаем исходный HTML
  }
}

/**
 * Нормализует HTML-теги в соответствии с форматом Telegram
 * @param {string} html HTML-текст
 * @returns {string} Нормализованный HTML-текст
 */
function normalizeHtmlTags(html: string): string {
  let result = html;
  
  // Заменяем стандартные HTML-теги на Telegram-совместимые
  result = result
    // Тег strong на b
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>')
    
    // Тег em на i
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>')
    
    // Тег del и strike на s
    .replace(/<(del|strike)[^>]*>(.*?)<\/\1>/gi, '<s>$2</s>')
    
    // Тег ins на u
    .replace(/<ins[^>]*>(.*?)<\/ins>/gi, '<u>$1</u>')
    
    // Очистка атрибутов для code и pre
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '<code>$1</code>')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '<pre>$1</pre>')
    
    // Обработка ссылок - сохраняем только href атрибут
    .replace(
      /<a[^>]*href\s*=\s*["'](.*?)["'][^>]*>(.*?)<\/a>/gi, 
      '<a href="$1">$2</a>'
    );
  
  return result;
}

/**
 * Преобразует блочные элементы HTML в текст с переносами строк
 * @param {string} html HTML-текст с блочными элементами
 * @returns {string} Текст с соответствующими переносами строк
 */
function convertBlocksToText(html: string): string {
  let result = html;
  
  // Заменяем <br> на специальный маркер, чтобы не потерять в процессе обработки
  result = result.replace(/<br\s*\/?>/gi, '###NEWLINE###');
  
  // Преобразуем заголовки в жирный текст с двойным переносом
  result = result.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>###PARA###');
  
  // Преобразуем абзацы в текст с двойным переносом
  result = result.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1###PARA###');
  
  // Преобразуем div в текст с переносом
  result = result.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1###NEWLINE###');
  
  // Возвращаем наши маркеры к переносам строк
  result = result.replace(/###NEWLINE###/gi, '\n');
  result = result.replace(/###PARA###/gi, '\n\n');
  
  return result;
}

/**
 * Преобразует HTML-списки в текстовый формат с маркерами
 * @param {string} html HTML-текст со списками
 * @returns {string} Текст с маркированными списками
 */
function convertLists(html: string): string {
  let result = html;
  
  // Заменяем ul/ol на текст без дополнительного форматирования
  result = result.replace(/<(ul|ol)[^>]*>(.*?)<\/\1>/gi, '$2');
  
  // Преобразуем элементы списка в текст с маркером
  result = result.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  return result;
}

/**
 * Удаляет неподдерживаемые Telegram теги и атрибуты
 * @param {string} html HTML-текст
 * @returns {string} Очищенный HTML-текст
 */
function removeUnsupportedTags(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)(?:\s+([^>]*))?>/gi, (match, tagName, attributes) => {
    const lowerTagName = tagName.toLowerCase();
    
    // Если тег не поддерживается Telegram, удаляем его, но сохраняем содержимое
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
 * Нормализует пробелы и переносы строк в тексте
 * @param {string} html HTML-текст
 * @returns {string} Текст с нормализованными пробелами и переносами
 */
function normalizeSpacesAndLinebreaks(html: string): string {
  // Сначала заменяем все последовательности переносов на специальный маркер
  let result = html.replace(/\n+/g, '###LINEBREAK###');
  
  // Удаляем лишние пробелы между словами (оставляем один)
  result = result.replace(/\s+/g, ' ');
  
  // Восстанавливаем переносы строк из маркеров, но не больше двух подряд
  result = result.replace(/###LINEBREAK###/g, '\n\n');
  
  // Удаляем повторяющиеся переносы строк (оставляем не более двух подряд)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Удаляем пробелы в начале строки и в конце
  result = result.replace(/^\s+/gm, '').replace(/\s+$/, '');
  
  return result;
}

/**
 * Исправляет незакрытые HTML теги
 * @param {string} html HTML-текст
 * @returns {string} HTML-текст с исправленными незакрытыми тегами
 */
function fixUnclosedTags(html: string): string {
  const stack: string[] = [];
  let result = html;
  
  // Регулярное выражение для поиска всех HTML тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  let match;
  
  // Находим все теги
  const tags: {tag: string, tagName: string, isClosing: boolean, index: number}[] = [];
  
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