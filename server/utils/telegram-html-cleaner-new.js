/**
 * Новая улучшенная утилита для очистки HTML-контента для Telegram
 * Максимально простой и надежный подход без лишнего форматирования
 * 
 * Telegram поддерживает только: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="">
 */

// Полностью игнорируемые теги (удаляются вместе с их содержимым)
const IGNORED_TAGS = new Set(['script', 'style', 'iframe', 'noscript']);

// Теги, которые заменяются на текст (содержимое сохраняется)
const BLOCK_TAGS = new Set(['div', 'p', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const LIST_TAGS = new Set(['ul', 'ol', 'dl']);
const LIST_ITEM_TAGS = new Set(['li', 'dt', 'dd']);

// Поддерживаемые Telegram теги
const TELEGRAM_SUPPORTED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a']);

// Преобразование эквивалентных тегов
const TAG_ALIASES = {
  'strong': 'b',
  'em': 'i',
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
  console.log(`[telegram-html-cleaner-new] ИСХОДНЫЙ HTML: ${html}`);
  
  try {
    // Шаг 1: Удаляем скрипты, стили и другие нежелательные блоки
    let result = removeIgnoredTags(html);
    console.log(`[telegram-html-cleaner-new] После удаления игнорируемых тегов: ${result}`);
    
    // Шаг 2: Конвертируем блочные элементы в текст
    result = convertBlocksToText(result);
    console.log(`[telegram-html-cleaner-new] После конвертации блочных элементов: ${result}`);
    
    // Шаг 3: Конвертируем списки в текст с маркерами
    result = convertListsToText(result);
    console.log(`[telegram-html-cleaner-new] После конвертации списков: ${result}`);
    
    // Шаг 4: Заменяем br на переносы строк
    result = result.replace(/<br\s*\/?>/gi, '\n');
    
    // Шаг 5: Нормализуем форматирующие теги
    result = normalizeFormattingTags(result);
    console.log(`[telegram-html-cleaner-new] После нормализации форматирующих тегов: ${result}`);
    
    // Шаг 6: Обрабатываем ссылки
    result = processLinks(result);
    
    // Шаг 7: Удаляем все оставшиеся HTML-теги
    result = removeUnsupportedTags(result);
    console.log(`[telegram-html-cleaner-new] После удаления неподдерживаемых тегов: ${result}`);
    
    // Шаг 8: Общая очистка и форматирование
    result = cleanupText(result);
    
    console.log(`[telegram-html-cleaner-new] ФИНАЛЬНЫЙ HTML: ${result}`);
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
  result = result.replace(closePRegex, '\n');
  
  // Обрабатываем заголовки с добавлением дополнительного переноса
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    result = result.replace(openRegex, '');
    
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(closeRegex, '\n');
  }
  
  // Заменяем открывающие теги остальных блочных элементов на пустую строку
  for (const tag of BLOCK_TAGS) {
    if (tag === 'p' || tag.match(/^h[1-6]$/)) continue; // Пропускаем p и заголовки, так как уже обработали
    
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    result = result.replace(openRegex, '');
    
    // Заменяем закрывающие теги блочных элементов на перенос строки
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(closeRegex, '\n');
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
    result = result.replace(openRegex, '');
    result = result.replace(closeRegex, '\n');
  }
  
  // Заменяем элементы списка на маркеры
  for (const tag of LIST_ITEM_TAGS) {
    const itemRegex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'gis');
    result = result.replace(itemRegex, '• $1\n');
  }
  
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
    
    // Возвращаем ссылку только с атрибутом href
    return `<a href="${href}">${text}</a>`;
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
  
  // Добавляем дополнительный перенос строки между абзацами для лучшей читаемости
  result = result.replace(/\n/g, '\n\n');
  
  // Убираем излишние переносы (более 2 подряд)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

module.exports = {
  cleanHtmlForTelegram
};