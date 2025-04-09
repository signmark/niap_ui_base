/**
 * Скрипт для проверки наличия необходимых переменных окружения для Telegram API
 * Запуск: node check-telegram-secrets.js
 */

import fetch from 'node-fetch';

/**
 * Основная функция для проверки секретов Telegram
 */
async function checkTelegramSecrets() {
  // Проверяем наличие необходимых переменных окружения
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];

  console.log('=== Проверка переменных окружения для Telegram API ===');

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length === 0) {
    console.log('✅ Все необходимые переменные окружения найдены:');
    requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      // Скрываем секретные данные для безопасности
      const maskedValue = varName === 'TELEGRAM_BOT_TOKEN' 
        ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
        : value;
      console.log(`- ${varName}: ${maskedValue}`);
    });
  } else {
    console.log('❌ Отсутствуют следующие переменные окружения:');
    missingEnvVars.forEach(varName => {
      console.log(`- ${varName}`);
    });
    
    console.log('\n⚠️ Для работы с Telegram API необходимо добавить отсутствующие переменные окружения.');
    console.log('Вы можете добавить их в файл .env:');
    
    missingEnvVars.forEach(varName => {
      let exampleValue = '';
      if (varName === 'TELEGRAM_BOT_TOKEN') {
        exampleValue = '123456789:ABCDefGhIJklMNoPQrsTUVwxYZ';
      } else if (varName === 'TELEGRAM_CHAT_ID') {
        exampleValue = '-1001234567890';
      }
      console.log(`${varName}=${exampleValue}`);
    });
  }

  // Если токен Telegram есть, проверим его валидность
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('\n=== Проверка валидности токена Telegram ===');
    
    // Отправляем запрос к Telegram API
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/getMe`);
      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Токен Telegram валиден.');
        console.log(`Бот: ${data.result.first_name} (@${data.result.username})`);
        console.log(`ID бота: ${data.result.id}`);
      } else {
        console.log('❌ Токен Telegram невалиден:');
        console.log(data.description || 'Неизвестная ошибка');
      }
    } catch (error) {
      console.log('❌ Ошибка при проверке токена Telegram:');
      console.log(error.message);
    }
  }
}

// Запускаем проверку
checkTelegramSecrets().catch(error => {
  console.error('Критическая ошибка при проверке секретов Telegram:', error);
});