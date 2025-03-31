import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Простой скрипт для тестирования Telegram API
 * Этот скрипт отправляет сообщение в Telegram без дополнительного кода из основного приложения
 * Помогает выявить ошибки, связанные с настройками или токенами
 */

// Получаем токен из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не указан в .env файле');
  process.exit(1);
}

if (!chatId) {
  console.error('❌ Ошибка: TELEGRAM_CHAT_ID не указан в .env файле');
  process.exit(1);
}

console.log('✅ Токен и chat_id получены из переменных окружения');

const telegramApiUrl = `https://api.telegram.org/bot${token}`;

// Тестовое сообщение
const message = {
  chat_id: chatId,
  text: 'Тестовое сообщение из скрипта test-telegram.js',
  parse_mode: 'HTML'
};

// Тестовая отправка текстового сообщения
async function sendTextMessage() {
  try {
    console.log(`📤 Отправка текстового сообщения в Telegram...`);
    console.log(`🔗 URL: ${telegramApiUrl}/sendMessage`);
    console.log(`📝 Сообщение: ${message.text}`);
    
    const response = await axios.post(`${telegramApiUrl}/sendMessage`, message);
    
    console.log('✅ Сообщение успешно отправлено!');
    console.log('📊 Ответ сервера:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при отправке сообщения:');
    console.error(error.message);
    
    if (error.response) {
      console.error('📊 Детали ошибки от сервера:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Тестовая отправка изображения
async function sendPhoto(photoUrl) {
  try {
    console.log(`📤 Отправка фото в Telegram...`);
    console.log(`🔗 URL: ${telegramApiUrl}/sendPhoto`);
    console.log(`🖼️ Фото: ${photoUrl}`);
    
    const photoMessage = {
      chat_id: chatId,
      photo: photoUrl,
      caption: 'Тестовое фото из скрипта test-telegram.js',
      parse_mode: 'HTML'
    };
    
    const response = await axios.post(`${telegramApiUrl}/sendPhoto`, photoMessage);
    
    console.log('✅ Фото успешно отправлено!');
    console.log('📊 Ответ сервера:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при отправке фото:');
    console.error(error.message);
    
    if (error.response) {
      console.error('📊 Детали ошибки от сервера:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Проверка возможности отправить несколько фото за раз
async function sendMultiplePhotos(photoUrls) {
  try {
    console.log(`📤 Отправка нескольких фото в Telegram...`);
    console.log(`🔗 URL: ${telegramApiUrl}/sendMediaGroup`);
    console.log(`🖼️ Количество фото: ${photoUrls.length}`);
    
    // Создаем массив медиа-файлов для отправки
    const media = photoUrls.map((url, index) => ({
      type: 'photo',
      media: url,
      caption: index === 0 ? 'Тестовые фото (группа) из скрипта test-telegram.js' : '',
      parse_mode: 'HTML'
    }));
    
    const multiPhotoMessage = {
      chat_id: chatId,
      media: media
    };
    
    const response = await axios.post(`${telegramApiUrl}/sendMediaGroup`, multiPhotoMessage);
    
    console.log('✅ Группа фото успешно отправлена!');
    console.log('📊 Ответ сервера:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при отправке группы фото:');
    console.error(error.message);
    
    if (error.response) {
      console.error('📊 Детали ошибки от сервера:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Вызов функций
async function runTests() {
  // Тестовые URL фотографий
  const photoUrl1 = 'https://i.imgur.com/DYmYr3S.jpeg'; // Используем фото с известного хостинга
  const photoUrl2 = 'https://i.imgur.com/LPeQeYe.jpeg';
  const photoUrl3 = 'https://i.imgur.com/2Ni7GqS.jpeg';
  
  console.log('🚀 Запуск тестов Telegram API...');
  
  // Тест 1: Отправка текстового сообщения
  console.log('\n📝 Тест 1: Отправка текстового сообщения');
  await sendTextMessage();
  
  // Тест 2: Отправка одного фото
  console.log('\n🖼️ Тест 2: Отправка одного фото');
  await sendPhoto(photoUrl1);
  
  // Тест 3: Отправка нескольких фото
  console.log('\n🖼️🖼️🖼️ Тест 3: Отправка нескольких фото');
  await sendMultiplePhotos([photoUrl1, photoUrl2, photoUrl3]);
  
  console.log('\n✅ Все тесты завершены!');
}

// Запускаем тесты
runTests().catch(error => {
  console.error('❌ Ошибка при выполнении тестов:', error);
});