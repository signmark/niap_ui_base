/**
 * Скрипт для публикации контента в Telegram
 * 
 * Этот скрипт может использоваться как автономный инструмент для публикации контента
 * в Telegram канал или группу, а также интегрироваться в основное приложение.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Базовый URL для Telegram Bot API
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Загружает изображение в Telegram
 * @param {string} imageUrl URL изображения для загрузки
 * @param {string} caption Текст подписи к изображению
 * @returns {Promise<Object>} Результат запроса к API Telegram
 */
export async function sendTelegramPhoto(imageUrl, caption = '') {
  try {
    console.log(`[telegram] Отправка фото в Telegram. Канал: ${TELEGRAM_CHAT_ID}`);
    console.log(`[telegram] URL изображения: ${imageUrl}`);
    
    // Проверяем наличие токена и ID чата
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('Отсутствуют токен бота или ID чата Telegram');
    }

    let imageData;
    let formData;

    // Локальные изображения (начинаются с 'uploads/')
    if (imageUrl.startsWith('/uploads/') || imageUrl.includes('uploads/')) {
      const localPath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
      
      console.log(`[telegram] Попытка загрузки локального файла: ${localPath}`);
      
      if (fs.existsSync(localPath)) {
        console.log(`[telegram] Локальный файл существует`);
        
        // Формируем multipart/form-data для отправки файла
        formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        
        // Добавляем подпись, если она есть
        if (caption && caption.trim()) {
          console.log(`[telegram] Добавляем подпись: ${caption.substring(0, 50)}...`);
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
        }
        
        // Создаем файл для формы
        const fileBlob = new Blob([fs.readFileSync(localPath)]);
        formData.append('photo', fileBlob, path.basename(localPath));
        
        // Отправляем запрос
        const response = await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        console.log(`[telegram] Фото успешно отправлено в Telegram`);
        return response.data;
      } else {
        console.error(`[telegram] Файл не найден: ${localPath}`);
        throw new Error(`Файл не найден: ${localPath}`);
      }
    }
    // Изображения по URL
    else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      console.log(`[telegram] Отправка изображения по URL`);
      
      // Для URL мы отправляем запрос с JSON данными
      const response = await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, {
        chat_id: TELEGRAM_CHAT_ID,
        photo: imageUrl,
        caption: caption || '',
        parse_mode: 'HTML'
      });
      
      console.log(`[telegram] Фото успешно отправлено в Telegram через URL`);
      return response.data;
    } else {
      throw new Error(`Неподдерживаемый формат изображения: ${imageUrl}`);
    }
  } catch (error) {
    console.error(`[telegram] Ошибка при отправке фото в Telegram:`, error.message);
    
    // Пытаемся отправить текст, если изображение не получается отправить
    if (caption) {
      console.log(`[telegram] Отправляем только текст, так как изображение не удалось отправить`);
      return sendTelegramText(caption);
    }
    
    throw error;
  }
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} text Текст для отправки
 * @returns {Promise<Object>} Результат запроса к API Telegram
 */
export async function sendTelegramText(text) {
  try {
    console.log(`[telegram] Отправка текста в Telegram. Канал: ${TELEGRAM_CHAT_ID}`);
    console.log(`[telegram] Текст: ${text.substring(0, 50)}...`);
    
    // Проверяем наличие токена и ID чата
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('Отсутствуют токен бота или ID чата Telegram');
    }
    
    // Проверяем наличие текста
    if (!text || !text.trim()) {
      throw new Error('Текст сообщения не может быть пустым');
    }

    // Отправляем запрос
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });
    
    console.log(`[telegram] Текст успешно отправлен в Telegram`);
    return response.data;
  } catch (error) {
    console.error(`[telegram] Ошибка при отправке текста в Telegram:`, error.message);
    if (error.response) {
      console.error(`[telegram] Данные ответа при ошибке:`, error.response.data);
    }
    throw error;
  }
}

/**
 * Публикует контент в Telegram
 * @param {Object} content Объект с данными контента
 * @returns {Promise<Object>} Результат публикации
 */
export async function publishToTelegram(content) {
  console.log(`[telegram] Публикация контента "${content.title}" в Telegram`);
  
  try {
    // Базовая валидация
    if (!content) {
      throw new Error('Контент не определен');
    }
    
    let result;
    
    // Определяем тип контента и выбираем стратегию публикации
    if (content.contentType === 'text-image' && content.imageUrl) {
      // Публикация текста с изображением
      const caption = formatTelegramText(content);
      result = await sendTelegramPhoto(content.imageUrl, caption);
      
      // Если есть дополнительные изображения, отправляем их как отдельные сообщения
      if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
        console.log(`[telegram] Найдено ${content.additionalImages.length} дополнительных изображений`);
        
        for (const imageUrl of content.additionalImages) {
          if (imageUrl) {
            try {
              await sendTelegramPhoto(imageUrl);
            } catch (error) {
              console.error(`[telegram] Ошибка при отправке дополнительного изображения:`, error.message);
            }
          }
        }
      }
    } else {
      // Публикация только текста
      const text = formatTelegramText(content);
      result = await sendTelegramText(text);
    }
    
    console.log(`[telegram] Контент успешно опубликован в Telegram`);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error(`[telegram] Ошибка при публикации в Telegram:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Форматирует текст для публикации в Telegram
 * @param {Object} content Объект с данными контента
 * @returns {string} Отформатированный текст
 */
function formatTelegramText(content) {
  if (!content) return '';
  
  let formattedText = '';
  
  // Добавляем заголовок, если он есть
  if (content.title) {
    formattedText += `<b>${escapeHtml(content.title)}</b>\n\n`;
  }
  
  // Добавляем основной текст
  if (content.text) {
    formattedText += `${formatHtmlForTelegram(content.text)}\n\n`;
  }
  
  // Добавляем хештеги, если они есть
  if (content.keywords && Array.isArray(content.keywords) && content.keywords.length > 0) {
    const hashtags = content.keywords
      .map(kw => `#${kw.replace(/\s+/g, '_')}`)
      .join(' ');
    
    formattedText += hashtags;
  }
  
  return formattedText;
}

/**
 * Форматирует HTML текст для Telegram (поддерживает только ограниченный набор тегов)
 * @param {string} html HTML текст
 * @returns {string} Текст, отформатированный для Telegram
 */
function formatHtmlForTelegram(html) {
  if (!html) return '';
  
  let text = html;
  
  // Telegram поддерживает только ограниченный набор HTML тегов
  // Заменяем некоторые общие теги на поддерживаемые Telegram аналоги
  
  // Заголовки
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>\n');
  
  // Параграфы
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Списки
  text = text.replace(/<ul[^>]*>(.*?)<\/ul>/gi, '$1\n');
  text = text.replace(/<ol[^>]*>(.*?)<\/ol>/gi, '$1\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  // Жирный текст
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '<b>$1</b>');
  
  // Курсив
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '<i>$1</i>');
  
  // Подчеркнутый текст
  text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');
  
  // Зачеркнутый текст
  text = text.replace(/<s[^>]*>(.*?)<\/s>/gi, '<s>$1</s>');
  text = text.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '<s>$1</s>');
  text = text.replace(/<del[^>]*>(.*?)<\/del>/gi, '<s>$1</s>');
  
  // Код
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '<code>$1</code>');
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '<pre>$1</pre>');
  
  // Ссылки
  text = text.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, '<a href="$1">$2</a>');
  
  // Удаляем все остальные HTML теги
  text = text.replace(/<[^>]*>/g, '');
  
  // Удаляем множественные переносы строк
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Экранируем HTML в обычном тексте
  text = escapeHtml(text);
  
  return text;
}

/**
 * Экранирует специальные символы HTML
 * @param {string} text Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, match => htmlEntities[match]);
}

// Если скрипт запущен напрямую, выполняем тестовую публикацию
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Пример использования
  const testContent = {
    title: 'Тестовая публикация',
    text: '<p>Это тест автоматической публикации в Telegram.</p><p>Поддерживает <b>форматирование</b> и <i>стилизацию</i> текста.</p>',
    contentType: 'text-image',
    imageUrl: '/uploads/test.jpg', // Путь к тестовому изображению
    keywords: ['тест', 'публикация', 'telegram']
  };
  
  publishToTelegram(testContent)
    .then(result => {
      console.log('Результат публикации:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Ошибка при публикации:', error);
      process.exit(1);
    });
}