/**
 * Утилита для обработки контента перед публикацией в Telegram
 * Обеспечивает корректное преобразование HTML формата в поддерживаемые Telegram теги
 * и обрабатывает изображения в соответствии с требованиями платформы
 */

/**
 * Преобразует HTML контент в формат, поддерживаемый Telegram
 * @param {string} html - HTML текст для преобразования
 * @param {number} maxLength - Максимальная длина текста (Telegram ограничение = 4096)
 * @returns {string} - Отформатированный текст для Telegram
 */
function processContentForTelegram(html, maxLength = 4096) {
  if (!html) return '';
  
  try {
    console.log(`Обработка HTML для Telegram: исходный текст длиной ${html.length} символов`);
    
    // Преобразуем маркдаун разметку в HTML
    let processedText = html
      // Обработка маркдаун-разметки
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // **жирный**
      .replace(/\*(.*?)\*/g, '<i>$1</i>') // *курсив*
      .replace(/__(.*?)__/g, '<u>$1</u>') // __подчеркнутый__
      .replace(/~~(.*?)~~/g, '<s>$1</s>') // ~~зачеркнутый~~
      
      // Преобразуем блочные элементы в понятный Telegram формат
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gs, '$1\n\n')
      .replace(/<div[^>]*>(.*?)<\/div>/gs, '$1\n')
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gs, '<b>$1</b>\n\n')
      
      // Приводим HTML-теги к поддерживаемым в Telegram форматам
      .replace(/<strong[^>]*>(.*?)<\/strong>/gs, '<b>$1</b>')
      .replace(/<em[^>]*>(.*?)<\/em>/gs, '<i>$1</i>')
      .replace(/<strike[^>]*>(.*?)<\/strike>/gs, '<s>$1</s>')
      .replace(/<del[^>]*>(.*?)<\/del>/gs, '<s>$1</s>')
      .replace(/<ins[^>]*>(.*?)<\/ins>/gs, '<u>$1</u>')
      
      // Обработка span с inline-стилями
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-style\s*:\s*italic[^"']*?["'][^>]*>(.*?)<\/span>/gi, '<i>$1</i>')
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-weight\s*:\s*(bold|[6-9]00)[^"']*?["'][^>]*>(.*?)<\/span>/gi, '<b>$2</b>')
      
      // Улучшенная обработка списков
      .replace(/<ul[^>]*>([^]*?)<\/ul>/gs, '$1')
      .replace(/<ol[^>]*>([^]*?)<\/ol>/gs, '$1')
      .replace(/<li[^>]*>(.*?)<\/li>/gs, '• $1\n')
      
      // Обрабатываем ссылки по формату Telegram
      .replace(/<a\s+href\s*=\s*["'](.*?)["'].*?>(.*?)<\/a>/gs, '<a href="$1">$2</a>');
    
    // Telegram не поддерживает вложенные теги одного типа, исправляем это
    // Например: <b>жирный <b>вложенный</b> текст</b> -> <b>жирный вложенный текст</b>
    processedText = processedText
      .replace(/<(b|i|u|s|strike|code)>(.*?)<\/\1>.*?<\1>(.*?)<\/\1>/gs, '<$1>$2 $3</$1>')
      .replace(/<(b|i|u|s|strike|code)>(.*?)<\1>(.*?)<\/\1>(.*?)<\/\1>/gs, '<$1>$2$3$4</$1>');
      
    // Удаляем все неподдерживаемые HTML-теги, но сохраняем их содержимое
    processedText = processedText.replace(/<(\/?(?!b|strong|i|em|u|s|strike|code|pre|a\b)[^>]+)>/gi, '');
    
    // Проверяем правильность HTML (закрытые теги)
    const hasBalancedTags = checkTagsBalance(processedText);
    
    if (!hasBalancedTags) {
      console.log('Внимание: HTML-теги не сбалансированы. Применяем исправление.');
      // Применяем исправление незакрытых тегов
      processedText = fixUnclosedTags(processedText);
    }
    
    // Если текст слишком длинный, обрезаем его
    if (processedText.length > maxLength) {
      processedText = truncateTextSafely(processedText, maxLength);
    }
    
    console.log(`Обработка HTML для Telegram завершена: результат ${processedText.length} символов`);
    return processedText;
  } catch (error) {
    console.error(`Ошибка при обработке HTML для Telegram: ${error.message}`);
    // В случае ошибки возвращаем очищенный от HTML тегов текст
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Проверяет и исправляет незакрытые HTML теги в тексте
 * @param {string} html - HTML текст для проверки
 * @returns {string} - Исправленный HTML текст
 */
function fixUnclosedTags(html) {
  if (!html) return '';
  
  // Получение всех тегов, поддерживаемых Telegram
  // Используем для скобочной структуры - для каждого открывающего тега должен быть закрывающий
  const tagPattern = /<\/?(?:b|strong|i|em|u|s|strike|code|pre|a)(?:\s+[^>]*)?>/g;
  
  // Извлекаем все теги из текста
  const tags = html.match(tagPattern) || [];
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Здесь мы отслеживаем все незакрытые теги
  const unclosedTags = [];
  
  // Обход всех найденных тегов
  for (const tag of tags) {
    // Определяем, закрывающий это тег или открывающий
    if (tag.startsWith('</')) {
      // Это закрывающий тег
      const tagName = tag.match(/<\/([a-z]+)/i)[1];
      
      // Ищем соответствующий открывающий тег в стеке, начиная с конца
      let found = false;
      for (let i = openTags.length - 1; i >= 0; i--) {
        const openTag = openTags[i];
        const openTagName = openTag.match(/<([a-z]+)/i)[1];
        
        if (tagName === openTagName || 
            (tagName === 'b' && openTagName === 'strong') || 
            (tagName === 'strong' && openTagName === 'b') ||
            (tagName === 'i' && openTagName === 'em') || 
            (tagName === 'em' && openTagName === 'i') ||
            (tagName === 's' && openTagName === 'strike') || 
            (tagName === 'strike' && openTagName === 's')) {
          // Найден соответствующий открывающий тег, удаляем его из стека
          openTags.splice(i, 1);
          found = true;
          break;
        }
      }
      
      // Если закрывающий тег не имеет соответствующего открывающего
      if (!found) {
        // Это лишний закрывающий тег, игнорируем его
      }
    } else {
      // Это открывающий тег
      // Проверяем, не является ли это тегом ссылки без закрывающей части
      if (tag.includes('href') && !tag.endsWith('/>')) {
        // Добавляем в стек открытых тегов
        openTags.push(tag);
      }
      // Проверяем, не является ли это другим открывающим тегом
      else if (/<(b|strong|i|em|u|s|strike|code|pre)(\s|>)/i.test(tag)) {
        // Добавляем в стек открытых тегов
        openTags.push(tag);
      }
    }
  }
  
  // Теперь у нас в openTags остались только незакрытые теги
  // Добавляем их в список незакрытых тегов в обратном порядке
  for (let i = openTags.length - 1; i >= 0; i--) {
    const openTag = openTags[i];
    const tagName = openTag.match(/<([a-z]+)/i)[1];
    
    // Добавляем соответствующий закрывающий тег
    unclosedTags.push(`</${tagName}>`);
  }
  
  // Добавляем все закрывающие теги в конец текста
  let result = html;
  if (unclosedTags.length > 0) {
    result += unclosedTags.join('');
  }
  
  return result;
}

/**
 * Проверяет наличие баланса открывающих и закрывающих тегов
 * @param {string} html - HTML текст для проверки
 * @returns {boolean} - true, если теги сбалансированы, иначе false
 */
function checkTagsBalance(html) {
  // Получение всех тегов, поддерживаемых Telegram
  const tagPattern = /<\/?(?:b|strong|i|em|u|s|strike|code|pre|a)(?:\s+[^>]*)?>/g;
  
  // Извлекаем все теги из текста
  const tags = html.match(tagPattern) || [];
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Обход всех найденных тегов
  for (const tag of tags) {
    // Определяем, закрывающий это тег или открывающий
    if (tag.startsWith('</')) {
      // Это закрывающий тег
      const tagName = tag.match(/<\/([a-z]+)/i)[1];
      
      // Если стек пуст, значит у нас закрывающий тег без соответствующего открывающего
      if (openTags.length === 0) {
        return false;
      }
      
      // Проверяем соответствие последнего открытого тега
      const lastOpenTag = openTags.pop();
      const lastOpenTagName = lastOpenTag.match(/<([a-z]+)/i)[1];
      
      // Проверяем соответствие (учитываем эквивалентные теги)
      if (tagName !== lastOpenTagName && 
          !(tagName === 'b' && lastOpenTagName === 'strong') && 
          !(tagName === 'strong' && lastOpenTagName === 'b') &&
          !(tagName === 'i' && lastOpenTagName === 'em') && 
          !(tagName === 'em' && lastOpenTagName === 'i') &&
          !(tagName === 's' && lastOpenTagName === 'strike') && 
          !(tagName === 'strike' && lastOpenTagName === 's')) {
        return false;
      }
    } else {
      // Это открывающий тег
      // Проверяем, не является ли это тегом ссылки без закрывающей части
      if (tag.includes('href') && !tag.endsWith('/>')) {
        // Добавляем в стек открытых тегов
        openTags.push(tag);
      }
      // Проверяем, не является ли это другим открывающим тегом
      else if (/<(b|strong|i|em|u|s|strike|code|pre)(\s|>)/i.test(tag)) {
        // Добавляем в стек открытых тегов
        openTags.push(tag);
      }
    }
  }
  
  // Если после прохода по всем тегам стек не пуст, значит есть незакрытые теги
  return openTags.length === 0;
}

/**
 * Обрабатывает список дополнительных изображений
 * @param {Array} additionalImages - Массив URL-адресов дополнительных изображений
 * @returns {Array} - Обработанный массив URL-адресов изображений
 */
function processAdditionalImages(additionalImages) {
  if (!additionalImages || !Array.isArray(additionalImages)) {
    return [];
  }
  
  // Фильтруем пустые URL и проверяем формат
  return additionalImages
    .filter(url => url && typeof url === 'string' && url.trim() !== '')
    .map(url => {
      // Проверяем, является ли URL абсолютным
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Относительные URLs должны быть преобразованы в абсолютные
      // (в контексте этого модуля предполагаем, что они уже абсолютные)
      return url;
    });
}

/**
 * Определяет, нужно ли отправлять изображения отдельно от текста
 * @param {string} text - Текст для отправки
 * @param {number} thresholdLength - Пороговая длина текста (1024 для Telegram)
 * @returns {boolean} - true, если изображения нужно отправлять отдельно
 */
function shouldSendImagesBeforeText(text, thresholdLength = 1024) {
  return text.length > thresholdLength;
}

/**
 * Безопасно обрезает текст, сохраняя целостность предложений и форматирования
 * @param {string} text - Текст для обрезки
 * @param {number} maxLength - Максимальная длина
 * @returns {string} - Обрезанный текст
 */
function truncateTextSafely(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  
  console.log(`Обрезаем текст с ${text.length} до ${maxLength} символов`);
  
  // Оставляем немного места для многоточия
  const targetLength = maxLength - 3;
  
  // Находим последний полный предложение в пределах нужной длины
  let truncated = text.substring(0, targetLength);
  
  // Ищем последний разделитель предложения (точка, вопросительный или восклицательный знак)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! ')
  );
  
  // Если найден разделитель предложения, обрезаем по нему
  if (lastSentenceEnd > targetLength * 0.7) { // Не обрезаем, если точка слишком близко к началу
    truncated = truncated.substring(0, lastSentenceEnd + 1);
  }
  
  // Проверяем, не оборвана ли HTML-разметка
  const openTagsCount = (truncated.match(/<[^\/](?:[^>'"]*|['"][^'"]*['"])*>/g) || []).length;
  const closeTagsCount = (truncated.match(/<\/[^>]*>/g) || []).length;
  
  // Если разметка оборвана, применяем более безопасный вариант обрезки
  if (openTagsCount > closeTagsCount) {
    // Обрезаем текст без учета HTML-тегов
    const text = truncated.replace(/<[^>]*>/g, '');
    if (text.length > targetLength * 0.8) {
      // Если текст все еще длинный, используем его без тегов
      truncated = text;
    } else {
      // Иначе применяем фиксацию тегов
      truncated = fixUnclosedTags(truncated);
    }
  }
  
  // Добавляем многоточие
  return truncated + '...';
}

/**
 * Форматирует chat_id в соответствии с требованиями Telegram API
 * @param {string|number} chatId - ID чата/канала Telegram
 * @returns {string} - Правильно форматированный chat_id
 */
function formatChatId(chatId) {
  if (!chatId) return '';
  
  // Преобразуем в строку и удаляем лишние пробелы
  let formattedChatId = String(chatId).trim();
  
  // Если это имя пользователя без префикса @, добавляем его
  if (!formattedChatId.startsWith('@') && 
      !formattedChatId.match(/^-?\d+$/) && 
      !formattedChatId.includes('.')) {
    formattedChatId = `@${formattedChatId}`;
  }
  // Если это ID группы или канала без префикса -100, добавляем его
  else if (!formattedChatId.startsWith('-100') && formattedChatId.startsWith('-')) {
    formattedChatId = `-100${formattedChatId.replace(/^-/, '')}`;
  }
  // Если это числовой ID канала длиной >= 10 цифр, добавляем префикс -100
  else if (!formattedChatId.startsWith('-') && !isNaN(Number(formattedChatId)) && formattedChatId.length >= 10) {
    formattedChatId = `-100${formattedChatId}`;
  }
  
  return formattedChatId;
}

export {
  processContentForTelegram,
  fixUnclosedTags,
  processAdditionalImages,
  shouldSendImagesBeforeText,
  truncateTextSafely,
  formatChatId,
  checkTagsBalance
};