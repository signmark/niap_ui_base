/**
 * Утилиты для обработки HTML для Telegram Bot API
 * Telegram поддерживает ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a>
 */

/**
 * Преобразует стандартные HTML-теги в теги, поддерживаемые Telegram
 * @param {string} html HTML-текст для преобразования
 * @returns {string} Преобразованный HTML-текст
 */
function standardizeTelegramTags(html) {
  if (!html) return '';

  // Замена <strong> на <b>
  html = html.replace(/<strong>(.*?)<\/strong>/gs, '<b>$1</b>');
  
  // Замена <em> на <i>
  html = html.replace(/<em>(.*?)<\/em>/gs, '<i>$1</i>');
  
  // Замена <p> на новую строку + текст
  html = html.replace(/<p>(.*?)<\/p>/gs, '$1\n\n');
  
  // Замена <br> и <br/> на новую строку
  html = html.replace(/<br\s*\/?>/gi, '\n');
  
  // Преобразование списков <ul>/<li> в маркированные списки
  html = html.replace(/<ul>(.*?)<\/ul>/gs, (match, content) => {
    // Заменяем каждый <li> на строку с маркером •
    return content.replace(/<li>(.*?)<\/li>/gs, '• $1\n');
  });
  
  // Преобразование списков <ol>/<li> в нумерованные списки
  html = html.replace(/<ol>(.*?)<\/ol>/gs, (match, content) => {
    let index = 1;
    // Заменяем каждый <li> на строку с номером
    return content.replace(/<li>(.*?)<\/li>/gs, () => {
      return `${index++}. $1\n`;
    });
  });
  
  // Удаление лишних тегов div
  html = html.replace(/<div>(.*?)<\/div>/gs, '$1\n');
  
  // Удаление лишних тегов span
  html = html.replace(/<span.*?>(.*?)<\/span>/gs, '$1');
  
  // Удаление HTML-комментариев
  html = html.replace(/<!--.*?-->/gs, '');
  
  // Удаление лишних переносов строк
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html;
}

/**
 * Исправляет незакрытые HTML-теги
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  if (!html) return '';
  
  // Массив для отслеживания открытых тегов
  const openTags = [];
  // Поддерживаемые Telegram теги
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  
  // Регулярное выражение для поиска открывающих и закрывающих тегов
  const regex = /<\/?([a-z]+)(?:\s+[^>]*)?\s*>/gi;
  
  // Новый HTML с исправленными тегами
  let fixedHtml = html.replace(regex, (match, tagName) => {
    // Игнорируем самозакрывающиеся теги и теги, не поддерживаемые Telegram
    if (match.endsWith('/>') || !supportedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    
    // Если это открывающий тег
    if (!match.startsWith('</')) {
      openTags.push(tagName.toLowerCase());
      return match;
    }
    
    // Если это закрывающий тег
    const closingTagName = tagName.toLowerCase();
    
    if (openTags.length === 0 || openTags[openTags.length - 1] !== closingTagName) {
      // Неправильный закрывающий тег, игнорируем его
      return '';
    }
    
    // Удаляем последний открытый тег, так как мы его закрыли
    openTags.pop();
    return match;
  });
  
  // Закрываем все оставшиеся открытые теги в обратном порядке
  for (let i = openTags.length - 1; i >= 0; i--) {
    fixedHtml += `</${openTags[i]}>`;
  }
  
  return fixedHtml;
}

/**
 * Обрабатывает HTML для Telegram
 * @param {string} html Исходный HTML
 * @returns {string} Обработанный HTML
 */
function formatHtmlForTelegram(html) {
  if (!html) return '';
  
  // Сначала преобразуем стандартные HTML-теги в поддерживаемые Telegram
  let formattedHtml = standardizeTelegramTags(html);
  
  // Затем исправляем незакрытые теги
  formattedHtml = fixUnclosedTags(formattedHtml);
  
  return formattedHtml;
}

/**
 * Создает подпись для изображения с учетом ограничений Telegram
 * @param {string} text Текст подписи
 * @returns {string} Форматированная подпись
 */
function createImageCaption(text) {
  if (!text) return '';
  
  // Telegram ограничивает длину подписи 1024 символами
  const MAX_CAPTION_LENGTH = 1000;
  
  // Сначала форматируем HTML
  let formattedCaption = formatHtmlForTelegram(text);
  
  // Обрезаем, если превышает максимальную длину
  if (formattedCaption.length > MAX_CAPTION_LENGTH) {
    formattedCaption = formattedCaption.substring(0, MAX_CAPTION_LENGTH) + '...';
  }
  
  return formattedCaption;
}

/**
 * Разбивает длинное сообщение на части
 * @param {string} text Текст сообщения
 * @param {number} maxLength Максимальная длина одной части
 * @returns {string[]} Массив частей сообщения
 */
function splitLongMessage(text, maxLength = 4000) {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];
  
  const chunks = [];
  let currentPosition = 0;
  
  while (currentPosition < text.length) {
    // Находим безопасную точку разделения (по возможности на границе абзаца)
    let splitPosition = currentPosition + maxLength;
    
    if (splitPosition >= text.length) {
      // Если оставшийся текст короче максимальной длины, берем его целиком
      splitPosition = text.length;
    } else {
      // Ищем ближайший конец абзаца назад от максимальной позиции
      const paragraphBreak = text.lastIndexOf('\n\n', splitPosition);
      
      if (paragraphBreak > currentPosition && paragraphBreak > splitPosition - 200) {
        // Если нашли подходящий перенос абзаца, используем его
        splitPosition = paragraphBreak + 2; // +2 для включения самого переноса
      } else {
        // Иначе ищем ближайший перенос строки
        const lineBreak = text.lastIndexOf('\n', splitPosition);
        
        if (lineBreak > currentPosition && lineBreak > splitPosition - 100) {
          splitPosition = lineBreak + 1; // +1 для включения самого переноса
        } else {
          // Если и перенос строки не нашли, ищем ближайший пробел
          const spacePosition = text.lastIndexOf(' ', splitPosition);
          
          if (spacePosition > currentPosition && spacePosition > splitPosition - 50) {
            splitPosition = spacePosition + 1; // +1 для включения самого пробела
          }
          // Если ничего не нашли, разбиваем просто по максимальной длине
        }
      }
    }
    
    // Добавляем часть в результат
    chunks.push(text.substring(currentPosition, splitPosition));
    currentPosition = splitPosition;
  }
  
  return chunks;
}

module.exports = {
  standardizeTelegramTags,
  fixUnclosedTags,
  formatHtmlForTelegram,
  createImageCaption,
  splitLongMessage
};