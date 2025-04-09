/**
 * Утилита для нового метода очистки HTML для Telegram
 * Более надежный алгоритм, сохраняющий форматирование
 */

// Константы для настройки очистителя
const TELEGRAM_SUPPORTED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre']);
const IGNORED_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'canvas'];
const BLOCK_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'section', 'header', 'footer', 'aside', 'main', 'address'];
const LIST_TAGS = ['ul', 'ol', 'dl'];
const LIST_ITEM_TAGS = ['li', 'dt', 'dd'];

// Алиасы для тегов
const TAG_ALIASES = {
  'strong': 'b',
  'em': 'i',
  'ins': 'u',
  'strike': 's',
  'del': 's'
};

/**
 * Очищает HTML для совместимости с Telegram
 * @param {string} html Исходный HTML
 * @returns {string} Очищенный HTML для Telegram
 */
function cleanHtmlForTelegram(html) {
  if (!html) return '';
  console.log(`[telegram-html-cleaner-new] Начало очистки HTML, длина: ${html.length}`);
  
  try {
    // Шаг 1: Удаляем скрипты, стили и другие нежелательные блоки
    let result = removeIgnoredTags(html);
    
    // Шаг 2: Конвертируем блочные элементы в текст
    result = convertBlocksToText(result);
    
    // Шаг 3: Конвертируем списки в текст с маркерами
    result = convertListsToText(result);
    
    // Шаг 4: Заменяем br на переносы строк
    result = result.replace(/<br\s*\/?>/gi, '\n');
    
    // Шаг 5: Нормализуем форматирующие теги
    result = normalizeFormattingTags(result);
    
    // Шаг 6: Обрабатываем ссылки
    result = processLinks(result);
    
    // Шаг 7: Удаляем все оставшиеся HTML-теги
    result = removeUnsupportedTags(result);
    
    // Шаг 8: Общая очистка и форматирование
    result = cleanupText(result);
    
    console.log(`[telegram-html-cleaner-new] HTML успешно очищен, новая длина: ${result.length}`);
    return result;
  } catch (error) {
    console.error(`[telegram-html-cleaner-new] Ошибка при очистке HTML: ${error.message}`);
    // В случае ошибки возвращаем текст, удалив все HTML-теги
    return html.replace(/<\/?[^>]+(>|$)/g, '');
  }
}

/**
 * Удаляет полностью игнорируемые теги вместе с содержимым
 * @param {string} html Исходный HTML
 * @returns {string} HTML без игнорируемых тегов
 */
function removeIgnoredTags(html) {
  let result = html;
  for (const tag of IGNORED_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
    result = result.replace(regex, '');
  }
  return result;
}

/**
 * Конвертирует блочные элементы в текст с переносами строк
 * @param {string} html Исходный HTML
 * @returns {string} HTML с замененными блочными элементами
 */
function convertBlocksToText(html) {
  let result = html;
  
  // Обрабатываем теги p отдельно (заменяем на перенос строки)
  const openPRegex = new RegExp(`<p[^>]*>`, 'gi');
  result = result.replace(openPRegex, '');
  
  const closePRegex = new RegExp(`</p>`, 'gi');
  result = result.replace(closePRegex, '\n\n'); // Два переноса строки после параграфа
  
  // Обрабатываем заголовки с добавлением дополнительного переноса
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    // Для заголовков добавляем пустую строку перед содержимым
    result = result.replace(openRegex, '');
    
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    // Добавляем два переноса строки после заголовка
    result = result.replace(closeRegex, '\n\n');
  }
  
  // Заменяем открывающие теги остальных блочных элементов на пустую строку
  for (const tag of BLOCK_TAGS) {
    if (tag === 'p' || tag.match(/^h[1-6]$/)) continue; // Пропускаем p и заголовки, так как уже обработали
    
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    result = result.replace(openRegex, '');
    
    // Заменяем закрывающие теги блочных элементов на перенос строки
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(closeRegex, '\n\n');
  }
  
  return result;
}

/**
 * Конвертирует списки в текст с маркерами
 * @param {string} html Исходный HTML
 * @returns {string} HTML с замененными списками
 */
function convertListsToText(html) {
  let result = html;
  
  // Удаляем теги списков
  for (const tag of LIST_TAGS) {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(openRegex, '\n'); // Добавляем перенос перед списком
    result = result.replace(closeRegex, '\n\n'); // Добавляем двойной перенос после списка
  }
  
  // Заменяем элементы списка на маркеры
  for (const tag of LIST_ITEM_TAGS) {
    const itemRegex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'gis');
    result = result.replace(itemRegex, '• $1\n');
  }
  
  // Удаляем лишние переносы строк между элементами списка
  result = result.replace(/• (.*?)\n\n• /gis, '• $1\n• ');
  
  // Добавляем перенос строки после последнего пункта списка, если за ним нет переноса
  result = result.replace(/• (.*?)([^\n])$/gis, '• $1$2\n');
  
  return result;
}

/**
 * Добавляет переносы строк между последовательными тегами форматирования
 * @param {string} html HTML-текст для обработки
 * @returns {string} HTML-текст с переносами строк между последовательными тегами
 */
function addLinebreaksBetweenFormattingTags(html) {
  const closingTagRegex = /<\/(b|i|u|s|code)>/gi;
  let lastIndex = 0;
  let result = '';
  let match;
  
  while ((match = closingTagRegex.exec(html)) !== null) {
    const endOfTag = match.index + match[0].length;
    // Добавляем текст до конца закрывающего тега включительно
    result += html.substring(lastIndex, endOfTag);
    
    // Проверяем, идет ли сразу после закрывающего тега открывающий тег форматирования
    if (endOfTag < html.length && html.substring(endOfTag, endOfTag + 3).match(/<[biusc]/i)) {
      result += '\n\n';
    }
    
    lastIndex = endOfTag;
  }
  
  // Добавляем оставшуюся часть текста
  result += html.substring(lastIndex);
  
  return result;
}

/**
 * Нормализует форматирующие теги для Telegram
 * @param {string} html Исходный HTML
 * @returns {string} HTML с нормализованными тегами
 */
function normalizeFormattingTags(html) {
  let result = html;
  
  // Заменяем эквивалентные теги на стандартные для Telegram
  for (const [originalTag, telegramTag] of Object.entries(TAG_ALIASES)) {
    if (originalTag === telegramTag) continue; // Пропускаем, если теги совпадают
    
    // Замена открывающих тегов
    const openOriginalRegex = new RegExp(`<${originalTag}[^>]*>`, 'gi');
    result = result.replace(openOriginalRegex, `<${telegramTag}>`);
    
    // Замена закрывающих тегов
    const closeOriginalRegex = new RegExp(`</${originalTag}>`, 'gi');
    result = result.replace(closeOriginalRegex, `</${telegramTag}>`);
  }
  
  // Удаляем все атрибуты из поддерживаемых форматирующих тегов
  for (const tag of TELEGRAM_SUPPORTED_TAGS) {
    if (tag !== 'a') { // Обрабатываем отдельно ссылки
      const attributeRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      result = result.replace(attributeRegex, `<${tag}>`);
    }
  }
  
  // Добавляем переносы строк между последовательными форматирующими тегами
  // Используем более надежный алгоритм с функцией обратного вызова
  result = addLinebreaksBetweenFormattingTags(result);
  
  return result;
}

/**
 * Обрабатывает ссылки и сохраняет только атрибут href
 * @param {string} html Исходный HTML
 * @returns {string} HTML с обработанными ссылками
 */
function processLinks(html) {
  // Преобразуем теги <a> с любыми атрибутами, сохраняя только href
  return html.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, (match, href, text) => {
    // Проверяем, что ссылка не пустая
    if (!href.trim()) {
      return text; // Если href пустой, возвращаем только текст
    }
    
    // Удаляем лишние пробелы из URL и текста ссылки
    const cleanHref = href.replace(/\s+/g, '');
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Возвращаем ссылку только с атрибутом href
    return `<a href="${cleanHref}">${cleanText}</a>`;
  });
}

/**
 * Удаляет все неподдерживаемые HTML-теги
 * @param {string} html Исходный HTML
 * @returns {string} Очищенный HTML
 */
function removeUnsupportedTags(html) {
  // Создаем список тегов для сохранения
  const tagsToKeep = Array.from(TELEGRAM_SUPPORTED_TAGS).map(tag => tag.toLowerCase());
  
  // Удаляем все теги, которые не в списке для сохранения
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    
    // Преобразуем алиасы тегов
    const normalizedTag = TAG_ALIASES[tag] || tag;
    
    // Если тег нужно сохранить, возвращаем его
    if (tagsToKeep.includes(normalizedTag)) {
      // Если это закрывающий тег
      if (match.startsWith('</')) {
        return `</${normalizedTag}>`;
      }
      // Если это тег <a>, он уже обработан в processLinks
      if (normalizedTag === 'a') {
        return match;
      }
      // Для других тегов возвращаем просто открывающий тег
      return `<${normalizedTag}>`;
    }
    
    // Удаляем неподдерживаемый тег
    return '';
  });
}

/**
 * Выполняет общую очистку и форматирование текста
 * @param {string} html Исходный HTML
 * @returns {string} Очищенный и отформатированный текст
 */
function cleanupText(html) {
  // Преобразуем HTML-сущности
  let result = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  // Удаляем пробелы в начале и конце каждой строки
  result = result.replace(/^\s+|\s+$/gm, '');
  
  // Удаляем избыточные переносы строк (более 2 подряд)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Удаляем избыточные пробелы в строках, но НЕ заменяем переносы строк
  const lines = result.split('\n');
  result = lines.map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
  
  // Обрабатываем склеенные слова
  // Добавляем пробелы только если первое слово заканчивается на букву/цифру, 
  // а второе начинается с заглавной буквы
  result = result.replace(/([a-zA-Zа-яА-Я0-9])([A-ZА-Я])/g, (match, g1, g2) => {
    // Игнорируем case HTML-XXX и подобные
    if ((g1 === '-') || (g1 === 'L') || (g1 === 'M')) {
      return match;
    }
    return `${g1} ${g2}`;
  });
  
  // Добавляем пробелы между закрывающими тегами форматирования и открывающими
  // внутри одного блока текста, например <b>один</b><u>тест</u>
  result = result.replace(/(<\/(b|i|u|s|code)>)(<(b|i|u|s|code)>)/gi, '$1 $3');
  
  // Добавляем пробелы между текстом и маркерами списка
  result = result.replace(/([a-zA-Zа-яА-Я0-9.,:;!?])•/g, '$1\n\n•');
  
  // Обрабатываем маркированные списки, чтобы они не имели лишних переносов строк
  result = result.replace(/• (.*?)\n\n• /g, '• $1\n• ');
  
  // Добавляем дополнительный перенос строки между предложениями, если там нет маркера списка
  result = result.replace(/([.!?])\s+([^•\n])/g, '$1\n\n$2');
  
  // Добавляем двойные переносы между параграфами, если это не список
  result = result.replace(/([^•])\n([^•\n])/g, '$1\n\n$2');
  
  // Убираем излишние переносы (более 2 подряд)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

// Экспортируем функцию для использования в других модулях
export { cleanHtmlForTelegram };