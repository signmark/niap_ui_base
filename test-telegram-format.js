/**
 * Тестовый файл для проверки форматирования HTML в Telegram
 * Использует новый сервис для публикации тестового контента с различным форматированием
 */

import * as dotenv from 'dotenv';
import { publishToTelegram } from './server/services/telegram-service-adapter.js';

// Загрузка переменных окружения
dotenv.config();

// Логирование
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Проверка наличия переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
  log('❌ Ошибка: Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID');
  log('Укажите их в файле .env');
  process.exit(1);
}

// Создание тестового контента с разными вариантами форматирования HTML
const testContent = {
  id: 'test-content-' + Date.now(),
  title: 'Тестовый пост с форматированием HTML',
  content: `
<p>Это тестовый пост для проверки <strong>форматирования HTML</strong> в Telegram.</p>
<p>Давайте проверим разные стили:</p>
<ul>
  <li><strong>Жирный текст</strong> - должен отображаться жирным</li>
  <li><em>Курсивный текст</em> - должен отображаться курсивом</li>
  <li><strong><em>Жирный и курсивный</em></strong> - должен объединять стили</li>
  <li><u>Подчеркнутый текст</u> - должен быть подчеркнутым</li>
  <li><code>Моноширинный текст</code> - для кода или технической информации</li>
</ul>
<p>Проверим ссылки: <a href="https://t.me">Telegram</a></p>
<p>А теперь проверим перенос строк и абзацы:</p>
<p>Первый абзац с текстом.</p>
<p>Второй абзац должен быть отделен.</p>
<p>Проверим <strong>вложенные <em>стили и их</em> правильную</strong> обработку.</p>
<blockquote>Это цитата, которая должна быть оформлена</blockquote>
<p>И напоследок проверим списки:</p>
<ol>
  <li>Нумерованный пункт 1</li>
  <li>Нумерованный пункт 2</li>
  <li>Нумерованный пункт 3</li>
</ol>
`,
  imageUrl: 'https://i.imgur.com/k8P6jBT.png', // Тестовое изображение
  hashtags: ['тест', 'html', 'форматирование', 'telegram'],
  additionalImages: [] // Дополнительных изображений нет
};

// Создание тестового контента с длинным текстом (более 1024 символов)
const longTextContent = {
  ...testContent,
  id: 'test-content-long-' + Date.now(),
  title: 'Длинный тестовый пост для проверки разделения текста и изображений',
  content: testContent.content.repeat(3) // Повторяем контент для создания длинного текста
};

// Настройки Telegram из переменных окружения
const telegramSettings = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHANNEL_ID
};

/**
 * Основная функция для запуска тестов
 */
async function runTests() {
  try {
    log('🚀 Начало тестирования публикации в Telegram с новым форматированием HTML');
    
    log('\n📝 ТЕСТ 1: Публикация обычного контента с изображением');
    const result1 = await publishToTelegram(testContent, telegramSettings);
    log(`Результат: ${result1.status === 'success' ? '✅ Успех' : '❌ Ошибка'}`);
    if (result1.status === 'success') {
      log(`URL публикации: ${result1.url}`);
    } else {
      log(`Ошибка: ${result1.error}`);
    }
    
    log('\n📝 ТЕСТ 2: Публикация длинного контента с изображением (должно разделить изображение и текст)');
    const result2 = await publishToTelegram(longTextContent, telegramSettings);
    log(`Результат: ${result2.status === 'success' ? '✅ Успех' : '❌ Ошибка'}`);
    if (result2.status === 'success') {
      log(`URL публикации: ${result2.url}`);
    } else {
      log(`Ошибка: ${result2.error}`);
    }
    
    log('\n📝 ТЕСТ 3: Публикация только текста без изображений');
    const textOnlyContent = { ...testContent, id: 'test-text-only-' + Date.now(), imageUrl: null };
    const result3 = await publishToTelegram(textOnlyContent, telegramSettings);
    log(`Результат: ${result3.status === 'success' ? '✅ Успех' : '❌ Ошибка'}`);
    if (result3.status === 'success') {
      log(`URL публикации: ${result3.url}`);
    } else {
      log(`Ошибка: ${result3.error}`);
    }
    
    log('\n✅ Все тесты выполнены!');
  } catch (error) {
    log(`❌ Ошибка при выполнении тестов: ${error.message}`);
    console.error(error);
  }
}

// Запуск тестов
runTests();