/**
 * Скрипт для прямой отправки HTML-сообщения в Telegram с встроенной функцией очистки HTML
 * Запуск: node telegram-cleaner-direct-test.mjs
 */

import axios from 'axios';

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
    
    console.log(`[telegram-html-cleaner-new] ФИНАЛЬНЫЙ HTML:`);
    console.log(result);
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

// Пример HTML-контента для публикации
const htmlContent = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    // Получаем токен и ID чата из переменных окружения
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      throw new Error('Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения');
    }
    
    console.log('=== ИСХОДНЫЙ HTML ===');
    console.log(html);
    
    // Очищаем HTML для Telegram
    const cleanedHtml = cleanHtmlForTelegram(html);
    
    console.log('\n=== ОЧИЩЕННЫЙ HTML ДЛЯ TELEGRAM ===');
    console.log(cleanedHtml);
    
    // Отправляем сообщение в Telegram
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: cleanedHtml,
        parse_mode: 'HTML'
      }
    );
    
    console.log('\n=== ОТВЕТ ОТ API TELEGRAM ===');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.message);
    if (error.response) {
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Запускаем отправку
sendHtmlMessage(htmlContent);