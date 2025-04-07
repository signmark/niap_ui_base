/**
 * Тестовый скрипт для проверки TelegramService после исправления проблемы с forceImageTextSeparation
 * Запустите: node test-telegram-service.js
 */
import 'dotenv/config';

// Импортируем нашу службу Telegram напрямую из приложения
import { telegramService } from './server/services/social/telegram-service.js';

// Тестовые данные
const testImages = [
  'https://picsum.photos/1200/800',
  'https://picsum.photos/800/600'
];

// Функция для тестирования публикации в Telegram через наш сервис
async function testTelegramService() {
  try {
    console.log('Начинаем тестирование TelegramService...');
    
    // Получаем переменные окружения для тестов
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      console.error('Ошибка: Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env файле');
      return;
    }
    
    console.log('Используем настройки:', { token: token.substring(0, 10) + '...', chatId });
    
    // Создаем тестовый контент (без metadata.forceImageTextSeparation)
    const testContent = {
      id: 'test-content-id',
      title: 'Тестовое сообщение',
      content: 'Это короткий текст без HTML-форматирования, который должен отправиться как подпись к изображениям',
      contentType: 'text-image',
      imageUrl: testImages[0],
      additionalImages: [testImages[1]],
      hashtags: ['тест', 'telegram'],
      socialPlatforms: ['telegram'],
      // Без forceImageTextSeparation в metadata
      metadata: {}
    };
    
    // Настройки для Telegram
    const telegramSettings = {
      telegram: {
        token,
        chatId
      }
    };
    
    console.log('Отправка тестового контента через TelegramService...');
    
    // Публикуем контент через наш сервис
    const result = await telegramService.publishToPlatform(
      testContent,
      'telegram',
      telegramSettings
    );
    
    console.log('Результат публикации:', result);
    
    if (result.status === 'published') {
      console.log('ТЕСТ УСПЕШНО ПРОЙДЕН: Сообщение опубликовано!');
      console.log('Ссылка на пост:', result.postUrl);
    } else {
      console.error('ТЕСТ НЕ ПРОЙДЕН: Ошибка при публикации', result.error);
    }
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testTelegramService();