/**
 * Модуль для обработки HTML-контента для Telegram
 * Telegram поддерживает ограниченный набор HTML-тегов и имеет особенности форматирования
 * 
 * Поддерживаемые теги Telegram: <b>, <i>, <u>, <s>, <code>, <pre>, <a href>
 */

/**
 * Исправляет HTML-теги для корректного отображения в Telegram
 * @param {string} html HTML-текст
 * @param {Object} options Опции форматирования
 * @param {boolean} options.debug Выводить отладочную информацию
 * @returns {string} Исправленный HTML, совместимый с Telegram
 */
function processHtmlForTelegram(html, options = {}) {
  const { debug = false } = options;
  
  if (!html) return '';
  
  const log = debug ? (message) => console.log(`[telegram-html] ${message}`) : () => {};
  
  log('Начало обработки HTML для Telegram...');
  log(`Исходный HTML (первые 100 символов): ${html.substring(0, 100)}...`);
  
  // Шаг 1: Исправление стандартных тегов
  let result = html;
  
  // Заменяем базовые HTML теги на теги, поддерживаемые Telegram
  result = result.replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
                 .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
                 .replace(/<del>([\s\S]*?)<\/del>/g, '<s>$1</s>')
                 .replace(/<strike>([\s\S]*?)<\/strike>/g, '<s>$1</s>');
  
  // Улучшенная обработка параграфов - сохраняем внутреннюю структуру тегов
  result = result.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
  
  // Обработка переносов строк
  result = result.replace(/<br\s*\/?>/g, '\n');
  
  // Шаг 2: Обработка списков с поддержкой вложенности
  
  // Вспомогательная функция для определения уровня вложенности по количеству родительских ul/ol
  function processNestedLists(html, level = 0, listType = 'ul') {
    // Определение маркера в зависимости от уровня и типа списка
    function getMarker(level, listType) {
      if (listType === 'ol') {
        // Для нумерованных списков используем цифры с разными разделителями
        return ['1. ', '1) ', 'a) ', 'i. '][level % 4];
      } else {
        // Для ненумерованных списков используем разные маркеры
        return ['• ', '◦ ', '▪ ', '▫ '][level % 4];
      }
    }
    
    // Регулярное выражение для поиска <li> элементов на текущем уровне
    const listItemRegex = /<li>([\s\S]*?)(?=<\/li>)/g;
    let processedHtml = html;
    let match;
    let itemIndex = 1; // Индекс для нумерованных списков
    
    // Получаем и обрабатываем каждый элемент списка на текущем уровне
    while ((match = listItemRegex.exec(html)) !== null) {
      const itemContent = match[1];
      
      // Проверяем, содержит ли элемент списка вложенный список
      const hasNestedList = /<(ul|ol)[^>]*>[\s\S]*?<\/\1>/g.test(itemContent);
      
      if (hasNestedList) {
        // Разделяем текст элемента и его вложенный список
        const itemParts = itemContent.split(/<(ul|ol)[^>]*>/);
        const itemText = itemParts[0].trim();
        
        // Определяем тип вложенного списка (ul или ol)
        const nestedListTypeMatch = /<(ul|ol)[^>]*>[\s\S]*?<\/\1>/g.exec(itemContent);
        const nestedListType = nestedListTypeMatch ? nestedListTypeMatch[1] : 'ul';
        
        // Обработка вложенного списка с увеличением уровня вложенности
        const nestedListMatch = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/g.exec(itemContent);
        if (nestedListMatch) {
          const nestedListContent = nestedListMatch[2];
          const processedNestedList = processNestedLists(nestedListContent, level + 1, nestedListType);
          
          // Собираем итоговый элемент списка с отступом для текущего уровня
          const indent = '  '.repeat(level);
          const marker = listType === 'ol' ? 
            getMarker(level, 'ol').replace('1', itemIndex) : // Заменяем 1 на текущий индекс для нумерованных списков
            getMarker(level, 'ul');
          
          // Форматируем элемент списка с маркером и вложенным списком
          const formattedItem = `${indent}${marker}${itemText}\n${processedNestedList}`;
          
          // Заменяем исходный элемент списка на отформатированный
          const fullItemMatch = new RegExp(`<li>${escapeRegExp(itemContent)}<\/li>`, 'g');
          processedHtml = processedHtml.replace(fullItemMatch, formattedItem);
        }
      } else {
        // Обрабатываем обычный элемент списка без вложенности
        const indent = '  '.repeat(level);
        const marker = listType === 'ol' ? 
          getMarker(level, 'ol').replace('1', itemIndex) : // Заменяем 1 на текущий индекс
          getMarker(level, 'ul');
        
        // Форматируем элемент списка с маркером
        const formattedItem = `${indent}${marker}${itemContent.trim()}`;
        
        // Заменяем исходный элемент списка на отформатированный
        const fullItemMatch = new RegExp(`<li>${escapeRegExp(itemContent)}<\/li>`, 'g');
        processedHtml = processedHtml.replace(fullItemMatch, formattedItem);
      }
      
      // Увеличиваем индекс для нумерованных списков
      if (listType === 'ol') {
        itemIndex++;
      }
    }
    
    // Удаляем теги списков, оставляя только отформатированный контент
    return processedHtml.replace(/<\/?(?:ul|ol)[^>]*>/g, '\n');
  }
  
  // Вспомогательная функция для экранирования специальных символов в регулярных выражениях
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Найти все списки верхнего уровня в документе
  const topLevelListPattern = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  
  // Используем итеративный подход для обработки каждого найденного списка
  while ((match = topLevelListPattern.exec(result)) !== null) {
    const fullList = match[0];         // Полный HTML списка
    const listType = match[1];         // тип списка (ul или ol)
    const listContent = match[2];      // содержимое списка без внешних тегов
    
    log(`Обработка списка типа <${listType}>`);
    
    // Обрабатываем список с начальным уровнем вложенности 0
    const processedList = processNestedLists(listContent, 0, listType);
    
    // Заменяем исходный список на обработанный
    result = result.replace(fullList, `\n${processedList}\n`);
  }
  
  // Подсчет общего количества обработанных списков
  const allLists = result.match(/(?:• |◦ |▪ |▫ |1\. |1\) |a\) |i\. )/g) || [];
  log(`Обработано элементов списков: ${allLists.length}`);
  
  // Обрабатываем оставшиеся отдельные элементы списков, которые могли быть пропущены
  result = result.replace(/<li>([\s\S]*?)<\/li>/g, '• $1\n')
                 .replace(/<\/?ul>|<\/?ol>/g, '\n');
  
  log('Базовые замены тегов выполнены');
  
  // Шаг 3: Сохраняем только поддерживаемые теги
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre'];
  
  // Сохраняем теги <a> отдельно, так как они имеют атрибуты
  const links = [];
  result = result.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    links.push({ url, text });
    return `###LINK${links.length - 1}###`;
  });
  
  log(`Найдено и сохранено ссылок: ${links.length}`);
  
  // Нормализуем поддерживаемые теги
  result = supportedTags.reduce((text, tag) => {
    // Заменяем все открывающие и закрывающие теги на стандартные версии
    const openTagRegExp = new RegExp(`<${tag}[^>]*>`, 'g');
    const closeTagRegExp = new RegExp(`</${tag}>`, 'g');
    
    return text.replace(openTagRegExp, `<${tag}>`).replace(closeTagRegExp, `</${tag}>`);
  }, result);
  
  // Очищаем от всех остальных тегов, кроме поддерживаемых
  result = result.replace(/<(?!\/?(?:b|i|u|s|code|pre)\b)[^>]+>/g, '');
  
  log('Нормализация тегов выполнена');
  
  // Восстанавливаем ссылки
  links.forEach((link, index) => {
    result = result.replace(`###LINK${index}###`, `<a href="${link.url}">${link.text}</a>`);
  });
  
  log('Ссылки восстановлены');
  
  // Шаг 4: Исправляем и закрываем незакрытые теги
  // Подсчитываем открывающие и закрывающие теги
  supportedTags.forEach(tag => {
    const openCount = (result.match(new RegExp(`<${tag}>`, 'g')) || []).length;
    const closeCount = (result.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    
    log(`Тег <${tag}>: открывающих - ${openCount}, закрывающих - ${closeCount}`);
    
    if (openCount > closeCount) {
      // Добавляем недостающие закрывающие теги
      for (let i = 0; i < openCount - closeCount; i++) {
        result += `</${tag}>`;
      }
      log(`Добавлено ${openCount - closeCount} закрывающих тегов </${tag}>`);
    }
  });
  
  // Шаг 5: Финальная обработка пробелов и переносов строк
  // Избегаем множественных переносов строк
  result = result.replace(/\n{3,}/g, '\n\n');
  
  log('Обработка HTML завершена');
  return result;
}

/**
 * Разделяет длинный текст на части подходящего размера для Telegram
 * @param {string} text Длинный текст
 * @param {number} maxLength Максимальная длина части (по умолчанию 4096 символов)
 * @returns {string[]} Массив частей текста
 */
function splitLongText(text, maxLength = 4096) {
  if (!text) return [];
  if (text.length <= maxLength) return [text];
  
  const parts = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }
    
    // Ищем подходящее место для разделения (предпочтительно на переносе строки)
    let splitIndex = remaining.substring(0, maxLength).lastIndexOf('\n\n');
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.substring(0, maxLength).lastIndexOf('\n');
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.substring(0, maxLength).lastIndexOf('. ');
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }
    
    parts.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }
  
  return parts;
}

/**
 * Проверяет, подходит ли текст для отправки как подпись к изображению
 * @param {string} text HTML-текст
 * @param {number} maxCaptionLength Максимальная длина подписи (по умолчанию 1024 символа)
 * @returns {boolean} true, если текст может быть отправлен как подпись
 */
function canUseCaptionForImage(text, maxCaptionLength = 1024) {
  return text.length <= maxCaptionLength;
}

/**
 * Определяет оптимальный способ отправки контента в Telegram (с изображением или без)
 * @param {Object} content Объект с контентом
 * @param {string} content.text HTML-текст контента
 * @param {string|null} content.imageUrl URL изображения (опционально)
 * @param {Object} options Опции отправки
 * @param {number} options.maxCaptionLength Максимальная длина подписи (по умолчанию 1024 символа)
 * @param {number} options.maxMessageLength Максимальная длина сообщения (по умолчанию 4096 символов)
 * @returns {Object} Объект с информацией о способе отправки
 */
function determineSendingStrategy(content, options = {}) {
  const { text, imageUrl } = content;
  const { maxCaptionLength = 1024, maxMessageLength = 4096 } = options;
  
  if (!text && !imageUrl) {
    return { type: 'error', message: 'Нет контента для отправки' };
  }
  
  if (!imageUrl) {
    // Только текст
    if (text.length <= maxMessageLength) {
      return { type: 'text', parts: [text] };
    } else {
      // Длинный текст, разбиваем на части
      const parts = splitLongText(text, maxMessageLength);
      return { type: 'long_text', parts };
    }
  } else {
    // Есть изображение
    if (text.length <= maxCaptionLength) {
      // Текст помещается в подпись к изображению
      return { type: 'image_with_caption', imageUrl, caption: text };
    } else {
      // Текст слишком длинный для подписи, отправляем отдельно
      if (text.length <= maxMessageLength) {
        return { type: 'image_and_text', imageUrl, text };
      } else {
        // Длинный текст, разбиваем на части
        const parts = splitLongText(text, maxMessageLength);
        return { type: 'image_and_long_text', imageUrl, parts };
      }
    }
  }
}

// ES Module export
export {
  processHtmlForTelegram,
  splitLongText,
  canUseCaptionForImage,
  determineSendingStrategy
};

// CommonJS module export для обратной совместимости
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processHtmlForTelegram,
    splitLongText,
    canUseCaptionForImage,
    determineSendingStrategy
  };
}