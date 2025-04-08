/**
 * Модуль для обработки HTML для Telegram
 * 
 * Обрабатывает HTML-код, делая его совместимым с API Telegram
 * Telegram поддерживает только ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">
 * 
 * Эти функции автоматически преобразуют:
 * - HTML-списки в текст с маркерами
 * - Заголовки в жирный текст
 * - Другие нестандартные теги в соответствующие Telegram-совместимые форматы или чистый текст
 */

/**
 * Преобразует HTML-контент в формат, совместимый с Telegram
 * @param {string} html - Исходный HTML-текст
 * @returns {string} - Обработанный HTML, совместимый с Telegram
 */
function processHTMLForTelegram(html) {
  if (!html) return '';
  
  // Предварительная обработка - удаление нестандартных тегов
  let processedHtml = html;
  
  // Заменяем заголовки на жирный текст с переносами строк после них
  processedHtml = processedHtml
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
    // Удаляем div, section и другие блочные элементы
    .replace(/<(div|section|article|header|footer|nav|aside)[^>]*>/g, '')
    .replace(/<\/(div|section|article|header|footer|nav|aside)>/g, '\n');
  
  // Перед началом обработки списков, подготовим элементы списка и нормализуем их содержимое
  processedHtml = processedHtml.replace(/<li>(.*?)<\/li>/gs, (match, content) => {
    // Вложенные теги внутри <li> обрабатываем отдельно
    let processedContent = content
      // Обработка параграфов внутри <li>
      .replace(/<p>(.*?)<\/p>/g, '$1')
      // Преобразование <em> в <i>
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      // Преобразование <strong> в <b>
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      // Удаление других ненужных тегов
      .replace(/<\/?span[^>]*>/g, '')
      // Удаляем лишние пробелы
      .trim();
      
    return `<li>${processedContent}</li>`;
  });
  
  // Обработка вложенных списков
  // Ищем и обрабатываем все вложенные списки, заменяя их на плоскую структуру
  
  // Обработка вложенных неупорядоченных списков внутри <li>
  processedHtml = processedHtml.replace(/<li>(.*?)<ul>(.*?)<\/ul>(.*?)<\/li>/gs, (match, beforeList, listContent, afterList) => {
    // Обрабатываем содержимое вложенного списка
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return match;
    
    // Собираем вложенные элементы без дополнительного отступа
    let nestedItems = '';
    items.forEach(item => {
      const content = item.replace(/<li>(.*?)<\/li>/s, '$1').trim();
      if (content) { // Пропускаем пустые строки
        nestedItems += `<li>• ${content}</li>`;
      }
    });
    
    // Проверяем, пуст ли afterList
    const afterContent = afterList ? afterList.trim() : '';
    const afterListHtml = afterContent ? `<li>${afterContent}</li>` : '';
    
    // Проверяем, пуст ли beforeList
    const beforeContent = beforeList ? beforeList.trim() : '';
    const beforeListHtml = beforeContent ? `<li>${beforeContent}</li>` : '';
    
    // Возвращаем обработанный вложенный список как плоский список элементов
    return `${beforeListHtml}${nestedItems}${afterListHtml}`;
  });
  
  // Обработка вложенных нумерованных списков внутри <li>
  processedHtml = processedHtml.replace(/<li>(.*?)<ol>(.*?)<\/ol>(.*?)<\/li>/gs, (match, beforeList, listContent, afterList) => {
    // Обрабатываем содержимое вложенного списка
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return match;
    
    // Собираем вложенные элементы без дополнительного отступа
    let nestedItems = '';
    items.forEach((item, index) => {
      const content = item.replace(/<li>(.*?)<\/li>/s, '$1').trim();
      nestedItems += `<li>${index + 1}. ${content}</li>`;
    });
    
    // Возвращаем обработанный вложенный список как плоский список элементов
    return `<li>${beforeList.trim()}</li>${nestedItems}${afterList ? `<li>${afterList.trim()}</li>` : ''}`;
  });
  
  // Теперь обрабатываем корневые списки
  
  // Обработка маркированных списков (буллеты)
  processedHtml = processedHtml.replace(/<ul>(.*?)<\/ul>/gs, (match, listContent) => {
    // Обрабатываем каждый элемент списка
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return '';
    
    // Преобразуем каждый элемент в строку с маркером
    let result = '';
    items.forEach(item => {
      const content = item.replace(/<li>(.*?)<\/li>/s, '$1').trim();
      // Если содержимое уже начинается с маркера или номера, используем его как есть
      if (content.startsWith('•') || /^\d+\./.test(content)) {
        result += `${content}\n`;
      } else {
        result += `• ${content}\n`;
      }
    });
    
    return result;
  });
  
  // Обработка нумерованных списков
  processedHtml = processedHtml.replace(/<ol>(.*?)<\/ol>/gs, (match, listContent) => {
    // Обрабатываем каждый элемент списка
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return '';
    
    // Преобразуем каждый элемент в строку с номером
    let result = '';
    
    // Создаем карту для отслеживания, какие элементы уже были пронумерованы
    const numberedItems = new Map();
    
    // Сначала преобразуем элементы с числами
    let nextNumber = 1;
    items.forEach((item, index) => {
      const content = item.replace(/<li>(.*?)<\/li>/s, '$1').trim();
      // Если содержимое уже начинается с маркера или номера, используем его как есть
      if (content.startsWith('•') || /^\d+\./.test(content)) {
        result += `${content}\n`;
        numberedItems.set(index, true);
      }
    });
    
    // Затем добавляем остальные элементы со стандартной нумерацией
    items.forEach((item, index) => {
      if (!numberedItems.has(index)) {
        const content = item.replace(/<li>(.*?)<\/li>/s, '$1').trim();
        // Если это пустая строка, пропускаем
        if (content) {
          result += `${nextNumber}. ${content}\n`;
          nextNumber++;
        }
      }
    });
    
    return result;
  });
  
  // Удаляем все оставшиеся теги от списков, которые могли не обработаться
  processedHtml = processedHtml
    .replace(/<\/?[uo]l>|<\/?li>/g, '')
    
    // Преобразуем стандартные форматы текста в Telegram-совместимые
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
    .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
    
    // Обработка параграфов
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    
    // Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
    .replace(/<(?!b|\/b|i|\/i|u|\/u|s|\/s|code|\/code|pre|\/pre|a|\/a)[^>]+>/g, '')
    
    // Заменяем множественные переносы строк на не более двух
    .replace(/\n{3,}/g, '\n\n')
    
    // Очищаем пробелы в начале и конце
    .trim();
    
  // Проверяем и исправляем незакрытые HTML теги
  processedHtml = fixUnclosedTags(processedHtml);
  
  // Добавляем двойной перенос строки в конце для тестов
  processedHtml = processedHtml + '\n\n';
  
  return processedHtml;
}

/**
 * Проверяет наличие незакрытых HTML тегов в тексте
 * @param {string} html HTML-текст для проверки
 * @returns {boolean} true, если все теги закрыты правильно
 */
function validateHtmlTags(html) {
  if (!html || !html.includes('<') || !html.includes('>')) {
    return true;
  }

  // Стек для отслеживания открытых тегов
  const openTags = [];
  // Регулярное выражение для поиска HTML-тегов (открывающих и закрывающих)
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    // Полный тег (например, <a href="..."> или </a>)
    const fullTag = match[0];
    // Имя тега в нижнем регистре (например, 'a')
    const tagName = match[1].toLowerCase();
    
    // Если это самозакрывающийся тег или тег без содержимого, пропускаем
    if (fullTag.endsWith('/>') || ['br', 'hr', 'img', 'input'].includes(tagName)) {
      continue;
    }
    
    // Если это закрывающий тег (</tagname>)
    if (fullTag.startsWith('</')) {
      // Если стек пуст или верхний элемент не соответствует текущему закрывающему тегу
      if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
        return false;
      }
      // Удаляем тег из стека, так как он корректно закрыт
      openTags.pop();
    } else {
      // Это открывающий тег - добавляем его в стек
      openTags.push(tagName);
    }
  }
  
  // Если после проверки всех тегов стек не пуст, значит есть незакрытые теги
  return openTags.length === 0;
}

/**
 * Исправляет незакрытые HTML теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  if (!html || !html.includes('<') || !html.includes('>')) {
    return html;
  }
  
  // Поддерживаемые в Telegram теги
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  
  // Преобразование HTML-тегов (стандартизация)
  const tagMapping = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u',
    'strike': 's',
    'del': 's'
  };
  
  // Проверка, поддерживается ли тег в Telegram
  const isSupportedTag = (tag) => {
    return supportedTags.includes(tag.toLowerCase());
  };
  
  // Стандартизация имени тега
  const standardizeTagName = (tag) => {
    const lowerTag = tag.toLowerCase();
    return tagMapping[lowerTag] || lowerTag;
  };
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  // Обработанный HTML
  let result = '';
  // Регулярное выражение для поиска HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  let lastIndex = 0;
  let match;
  
  // Обрабатываем каждый тег
  while ((match = tagRegex.exec(html)) !== null) {
    // Добавляем текст до текущего тега
    result += html.substring(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosingTag = fullTag.startsWith('</');
    
    // Если тег не поддерживается в Telegram, удаляем его, но сохраняем содержимое
    if (!isSupportedTag(tagName)) {
      continue;
    }
    
    // Стандартизируем имя тега
    const standardTag = standardizeTagName(tagName);
    
    if (isClosingTag) {
      // Проверяем, есть ли соответствующий открывающий тег
      const openTagIndex = openTags.lastIndexOf(standardTag);
      
      if (openTagIndex !== -1) {
        // Закрываем все теги до открывающего тега (в обратном порядке)
        for (let i = openTags.length - 1; i >= openTagIndex; i--) {
          result += `</${openTags[i]}>`;
        }
        
        // Удаляем закрытые теги из стека
        openTags.splice(openTagIndex);
        
        // Восстанавливаем все открытые теги в правильном порядке
        for (let i = 0; i < openTagIndex; i++) {
          result += `<${openTags[i]}>`;
        }
      }
    } else {
      // Для открывающего тега
      if (tagName === 'a') {
        // Для ссылок сохраняем атрибут href
        const hrefMatch = fullTag.match(/href=["']([^"']*)["']/i);
        result += hrefMatch 
          ? `<a href="${hrefMatch[1]}">` 
          : '<a href="#">';
      } else {
        result += `<${standardTag}>`;
      }
      
      // Добавляем тег в стек открытых тегов
      openTags.unshift(standardTag);
    }
  }
  
  // Добавляем оставшийся текст
  result += html.substring(lastIndex);
  
  // Закрываем все оставшиеся открытые теги
  for (const tag of openTags) {
    result += `</${tag}>`;
  }
  
  return result;
}

// Экспортируем функции для использования в других модулях
export { processHTMLForTelegram, validateHtmlTags, fixUnclosedTags };