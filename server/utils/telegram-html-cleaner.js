/**
 * Утилита для стандартизации HTML-тегов для Telegram
 * Преобразует любой HTML в формат, поддерживаемый Telegram
 */

// Используем динамический импорт для совместимости с ESM
const telegramFormatter = require('./telegram-formatter-common.js');

/**
 * Стандартизирует HTML-теги для отправки в Telegram
 * @param {string} html HTML-текст для форматирования
 * @returns {string} Отформатированный HTML-текст, готовый для отправки в Telegram
 */
function standardizeTelegramTags(html) {
  if (!html) return '';
  
  try {
    console.log(`[telegram-formatter] Форматирование HTML для Telegram: ${html.substring(0, 100)}...`);
    
    // Используем существующую функцию для форматирования HTML
    let formattedHtml = telegramFormatter.formatHtmlForTelegram(html);
    
    // Дополнительная обработка формата
    formattedHtml = postProcessHtml(formattedHtml);
    
    return formattedHtml;
  } catch (error) {
    console.error(`[telegram-formatter] Ошибка при стандартизации HTML для Telegram: ${error.message}`);
    
    // В случае ошибки пытаемся хотя бы исправить незакрытые теги
    try {
      return telegramFormatter.fixUnclosedTags(html);
    } catch (fixError) {
      // Если даже это не удалось, возвращаем исходный HTML
      return html;
    }
  }
}

/**
 * Выполняет дополнительную обработку HTML после основного форматирования
 * @param {string} html Предварительно отформатированный HTML
 * @returns {string} Окончательно отформатированный HTML
 */
function postProcessHtml(html) {
  // Обработка пунктов списка - добавление переносов строк между ними для лучшей читаемости
  let processedHtml = html.replace(/•\s*([^\n•]+)(?=\n•|\n|$)/g, '• $1\n');
  
  // Удаление лишних переносов строк
  processedHtml = processedHtml.replace(/\n{3,}/g, '\n\n');
  
  // Специальная обработка для параграфов
  processedHtml = processedHtml.replace(/(<\/p>\s*<p>|<br\s*\/?>)/gi, '\n');
  
  // Удаление лишних пробелов в начале строки
  processedHtml = processedHtml.replace(/^\s+/gm, '');
  
  return processedHtml.trim();
}

module.exports = {
  standardizeTelegramTags
};