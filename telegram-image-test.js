/**
 * Тестовый скрипт для проверки отправки изображений с HTML-подписями в Telegram
 * Использует прямой API Telegram
 * 
 * Запуск: node telegram-image-test.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Настраиваем dotenv
dotenv.config();

// Получаем текущую директорию в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройки тестирования
const TELEGRAM_TOKEN = process.env.TELEGRAM_TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

// Проверяем, есть ли необходимые переменные окружения
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Ошибка: Не заданы TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID в переменных окружения');
  process.exit(1);
}

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Исправляет незакрытые HTML-теги в тексте и делает их совместимыми с Telegram
 * Использует более надежный алгоритм с правильным учетом порядка вложенности тегов
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  // Список тегов, поддерживаемых Telegram
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a'];
  
  // Преобразует некоторые неподдерживаемые теги в поддерживаемые аналоги
  let processedHtml = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>') // h1-h6 -> b
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n') // p -> текст с переводами строк
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n') // div -> текст с переводом строки
    .replace(/<br\s*\/?>/gi, '\n') // br -> перевод строки
    .replace(/<hr\s*\/?>/gi, '\n———\n'); // hr -> линия из символов
  
  // Удаляем все неподдерживаемые теги, но сохраняем их содержимое
  const unsupportedTagsRegex = new RegExp(`<(?!\/?(${supportedTags.join('|')})[\\s>])[^>]*>`, 'gi');
  processedHtml = processedHtml.replace(unsupportedTagsRegex, '');
  
  // 1. Извлечем все теги (открывающие и закрывающие)
  const tagPattern = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  let allTags = [];
  let match;
  
  while ((match = tagPattern.exec(processedHtml)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const position = match.index;
    
    if (supportedTags.includes(tagName)) {
      allTags.push({
        fullTag,
        tagName,
        isClosing,
        position
      });
    }
  }
  
  // 2. Создаем новую структуру с правильной вложенностью тегов
  let stack = [];
  let resultHtml = processedHtml;
  let additionalClosingTags = '';
  let openTags = {};
  
  // Считаем количество открытых тегов каждого типа
  for (const tag of allTags) {
    if (!tag.isClosing) {
      openTags[tag.tagName] = (openTags[tag.tagName] || 0) + 1;
    } else {
      openTags[tag.tagName] = (openTags[tag.tagName] || 0) - 1;
    }
  }
  
  // Проверяем, есть ли незакрытые теги
  let hasUnclosedTags = false;
  for (const tag in openTags) {
    if (openTags[tag] !== 0) {
      hasUnclosedTags = true;
      break;
    }
  }
  
  // Если есть незакрытые теги, исправляем HTML
  if (hasUnclosedTags) {
    // Полностью пересоздаем HTML-структуру
    let newHtml = '';
    let position = 0;
    stack = [];
    
    for (let i = 0; i < processedHtml.length; i++) {
      // Проверяем, есть ли тег в данной позиции
      const tagAtPosition = allTags.find(tag => tag.position === i);
      
      if (tagAtPosition) {
        const { tagName, isClosing, fullTag } = tagAtPosition;
        
        if (!isClosing) {
          // Открывающий тег
          stack.push(tagName);
          newHtml += fullTag;
          i += fullTag.length - 1; // Пропускаем сам тег
        } else {
          // Закрывающий тег
          // Проверяем, соответствует ли последний открытый тег
          if (stack.length > 0) {
            const lastOpenTag = stack[stack.length - 1];
            
            if (lastOpenTag === tagName) {
              // Правильная пара, закрываем тег
              stack.pop();
              newHtml += fullTag;
            } else {
              // Нарушение порядка вложенности
              // Закрываем все открытые теги до соответствующего и потом снова открываем их
              const indexInStack = stack.lastIndexOf(tagName);
              
              if (indexInStack !== -1) {
                // Тег был открыт ранее
                const tagsToReopen = stack.slice(indexInStack + 1);
                
                // Закрываем все теги до нужного
                for (let j = stack.length - 1; j > indexInStack; j--) {
                  newHtml += `</${stack[j]}>`;
                }
                
                // Закрываем искомый тег
                newHtml += fullTag;
                stack.splice(indexInStack, 1);
                
                // Снова открываем промежуточные теги
                for (let j = 0; j < tagsToReopen.length; j++) {
                  newHtml += `<${tagsToReopen[j]}>`;
                  stack.push(tagsToReopen[j]);
                }
              } else {
                // Закрывающий тег без соответствующего открывающего, игнорируем
                // newHtml += fullTag; // Можно оставить или удалить
              }
            }
          } else {
            // Стек пуст, но есть закрывающий тег - игнорируем
            // newHtml += fullTag; // Можно оставить или удалить
          }
          
          i += fullTag.length - 1; // Пропускаем сам тег
        }
      } else {
        // Обычный символ
        newHtml += processedHtml[i];
      }
    }
    
    // Закрываем все оставшиеся открытые теги
    for (let i = stack.length - 1; i >= 0; i--) {
      newHtml += `</${stack[i]}>`;
    }
    
    resultHtml = newHtml;
  }
  
  return resultHtml;
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения или путь к локальному файлу
 * @param {string} caption HTML-форматированная подпись
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithCaption(imageUrl, caption) {
  try {
    log(`Отправка изображения в Telegram: ${imageUrl.substring(0, 50)}${imageUrl.length > 50 ? '...' : ''}`);
    log(`Подпись: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`);

    // Исправляем HTML-теги в подписи
    const fixedCaption = fixHtmlForTelegram(caption);
    log(`Исправленная подпись: ${fixedCaption.substring(0, 50)}${fixedCaption.length > 50 ? '...' : ''}`);

    let response;

    // Проверяем, является ли imageUrl локальным файлом или URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Если это URL, используем sendPhoto с параметром photo как URL
      response = await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          photo: imageUrl,
          caption: fixedCaption,
          parse_mode: 'HTML'
        }
      );
    } else {
      // Если это локальный файл, используем FormData и передаем файл напрямую
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('photo', fs.createReadStream(imageUrl));
      formData.append('caption', fixedCaption);
      formData.append('parse_mode', 'HTML');

      response = await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
        formData,
        {
          headers: formData.getHeaders()
        }
      );
    }

    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Сообщение успешно отправлено! Message ID: ${messageId}`);
      
      // Формируем URL сообщения
      let messageUrl;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        const chatIdForUrl = TELEGRAM_CHAT_ID.substring(4);
        messageUrl = `https://t.me/c/${chatIdForUrl}/${messageId}`;
      } else {
        messageUrl = `https://t.me/${TELEGRAM_CHAT_ID}/${messageId}`;
      }
      
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId: messageId,
        messageUrl: messageUrl
      };
    } else {
      log(`Ошибка при отправке: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    
    if (error.response && error.response.data) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data.description || error.message
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет группу изображений с одной HTML-подписью в Telegram
 * @param {string[]} imageUrls Массив URL изображений или путей к локальным файлам
 * @param {string} caption HTML-форматированная подпись
 * @returns {Promise<object>} Результат отправки
 */
async function sendImagesGroupWithCaption(imageUrls, caption) {
  try {
    log(`Отправка группы изображений в Telegram: ${imageUrls.length} изображений`);
    log(`Подпись: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`);

    // Исправляем HTML-теги в подписи
    const fixedCaption = fixHtmlForTelegram(caption);
    log(`Исправленная подпись: ${fixedCaption.substring(0, 50)}${fixedCaption.length > 50 ? '...' : ''}`);

    // Для отправки группы изображений используем метод sendMediaGroup
    // Подготавливаем массив изображений в формате InputMediaPhoto
    const media = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const mediaItem = {
        type: 'photo',
        media: imageUrls[i]
      };

      // Подпись добавляем только к первому изображению
      if (i === 0 && fixedCaption) {
        mediaItem.caption = fixedCaption;
        mediaItem.parse_mode = 'HTML';
      }

      media.push(mediaItem);
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMediaGroup`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        media: media
      }
    );

    if (response.data && response.data.ok) {
      const messageIds = response.data.result.map(msg => msg.message_id);
      log(`Группа изображений успешно отправлена! Message IDs: ${messageIds.join(', ')}`);
      
      // Формируем URL первого сообщения в группе
      let messageUrl;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        const chatIdForUrl = TELEGRAM_CHAT_ID.substring(4);
        messageUrl = `https://t.me/c/${chatIdForUrl}/${messageIds[0]}`;
      } else {
        messageUrl = `https://t.me/${TELEGRAM_CHAT_ID}/${messageIds[0]}`;
      }
      
      log(`URL первого сообщения в группе: ${messageUrl}`);
      
      return {
        success: true,
        messageIds: messageIds,
        messageUrl: messageUrl
      };
    } else {
      log(`Ошибка при отправке группы: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке группы изображений: ${error.message}`);
    
    if (error.response && error.response.data) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data.description || error.message
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Запускает все тесты
 */
async function runTests() {
  log('=== Запуск тестов отправки изображений с HTML-подписями в Telegram ===');
  
  // Тест 1: Отправка одного изображения с простой HTML-подписью
  log('\n--- Тест 1: Отправка одного изображения с простой HTML-подписью ---');
  const testImage1 = 'https://picsum.photos/800/600?random=1';
  const testCaption1 = '<b>Тестовое изображение</b> с <i>форматированием</i>';
  await sendImageWithCaption(testImage1, testCaption1);
  
  // Тест 2: Отправка изображения с HTML-подписью со вложенными тегами
  log('\n--- Тест 2: Отправка изображения с HTML-подписью со вложенными тегами ---');
  const testImage2 = 'https://picsum.photos/800/600?random=2';
  const testCaption2 = '<b>Заголовок</b>\n\n<i>Описание с <b>важным текстом</b> внутри</i>\n\n<code>Код</code>';
  await sendImageWithCaption(testImage2, testCaption2);
  
  // Тест 3: Отправка изображения с HTML-подписью с незакрытыми тегами
  log('\n--- Тест 3: Отправка изображения с HTML-подписью с незакрытыми тегами ---');
  const testImage3 = 'https://picsum.photos/800/600?random=3';
  const testCaption3 = '<b>Текст с <i>незакрытым тегом</b> курсива';
  await sendImageWithCaption(testImage3, testCaption3);
  
  // Тест 4: Отправка группы изображений с HTML-подписью
  log('\n--- Тест 4: Отправка группы изображений с HTML-подписью ---');
  const testImages = [
    'https://picsum.photos/800/600?random=4',
    'https://picsum.photos/800/600?random=5',
    'https://picsum.photos/800/600?random=6'
  ];
  const testGroupCaption = '<b>Группа изображений</b>\n\n<i>Эта подпись будет только на первом фото в группе</i>';
  await sendImagesGroupWithCaption(testImages, testGroupCaption);

  log('\n=== Тесты завершены ===');
}

// Запускаем тесты
runTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
  process.exit(1);
});

export {};