/**
 * Тест публикации HTML с изображением в Telegram
 * 
 * Скрипт отправляет тестовое изображение с HTML-подписью, а затем отдельное HTML-сообщение
 * Используется для проверки обработки HTML-форматирования с изображениями
 * 
 * Запуск: node telegram-html-image-test.js
 */

import { formatHtmlForTelegram } from './server/utils/telegram-formatter.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем данные из .env или из аргументов командной строки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Тестовое изображение
const TEST_IMAGE_URL = 'https://i.imgur.com/bAZxaYq.jpeg';

// Тестовый HTML-текст с форматированием для подписи к изображению
const shortHtmlCaption = `
<b>Подсознание наизнанку</b>

В ходе предыдущего <strong>обсуждения</strong> мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 😊
`;

// Более длинный HTML-текст для отдельного сообщения
const longHtmlText = `<p>В ходе предыдущего <strong>обсуждения</strong> мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 😊</p><p>В настоящее время целесообразно проанализировать роль перекусов, поскольку они могут как способствовать поддержанию здоровья <strong>"хорошего"</strong>, так и незаметно наносить вред фигуре и самочувствию. 🍎</p><p><em>Полезными перекусами являются те, которые обеспечивают чувство сытости, стабильный энергетический баланс и поступление питательных веществ.</em> 🥗 К ним можно отнести орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой. 🥑 🍞 🥒</p>`;

/**
 * Отправляет изображение с HTML-подписью в Telegram
 */
async function sendImageWithCaption() {
  console.log('Отправка изображения с HTML-подписью...');
  
  // Форматируем HTML-подпись
  const formattedCaption = formatHtmlForTelegram(shortHtmlCaption);
  
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      chat_id: TELEGRAM_CHAT_ID,
      photo: TEST_IMAGE_URL,
      caption: formattedCaption,
      parse_mode: 'HTML'
    });
    
    console.log('Изображение успешно отправлено!');
    console.log('Message ID:', response.data.result.message_id);
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке изображения:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Отправляет HTML-сообщение в Telegram
 */
async function sendHtmlMessage() {
  console.log('Отправка HTML-сообщения...');
  
  // Форматируем HTML-текст
  const formattedHtml = formatHtmlForTelegram(longHtmlText);
  
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: formattedHtml,
      parse_mode: 'HTML'
    });
    
    console.log('HTML-сообщение успешно отправлено!');
    console.log('Message ID:', response.data.result.message_id);
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML-сообщения:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Отправляет медиа-группу (несколько изображений)
 */
async function sendMediaGroup() {
  console.log('Отправка медиа-группы...');
  
  const formattedCaption = formatHtmlForTelegram(shortHtmlCaption);
  
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
      chat_id: TELEGRAM_CHAT_ID,
      media: [
        {
          type: 'photo',
          media: TEST_IMAGE_URL,
          caption: formattedCaption,
          parse_mode: 'HTML'
        },
        {
          type: 'photo',
          media: 'https://i.imgur.com/Z8gRU8C.jpeg'
        }
      ]
    });
    
    console.log('Медиа-группа успешно отправлена!');
    console.log('Message IDs:', response.data.result.map(msg => msg.message_id).join(', '));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке медиа-группы:', error.response?.data || error.message);
    throw error;
  }
}

// Запускаем тесты последовательно
async function runAllTests() {
  console.log('=== ЗАПУСК ТЕСТОВ HTML + ИЗОБРАЖЕНИЯ ===\n');
  
  try {
    // Тест 1: Отправка изображения с подписью
    console.log('ТЕСТ 1: ИЗОБРАЖЕНИЕ С HTML-ПОДПИСЬЮ');
    await sendImageWithCaption();
    console.log('✅ Тест 1 успешно пройден\n');
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 2: Отправка HTML-сообщения
    console.log('ТЕСТ 2: ОТДЕЛЬНОЕ HTML-СООБЩЕНИЕ');
    await sendHtmlMessage();
    console.log('✅ Тест 2 успешно пройден\n');
    
    // Небольшая задержка
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 3: Отправка медиа-группы
    console.log('ТЕСТ 3: МЕДИА-ГРУППА (НЕСКОЛЬКО ИЗОБРАЖЕНИЙ)');
    await sendMediaGroup();
    console.log('✅ Тест 3 успешно пройден\n');
    
    console.log('Все тесты успешно пройдены! Проверьте результаты в Telegram.');
  } catch (error) {
    console.error('❌ Ошибка при выполнении тестов:', error.message);
  }
}

// Запускаем все тесты
runAllTests();