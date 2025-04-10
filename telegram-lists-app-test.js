/**
 * Тест для проверки улучшенной обработки HTML-списков в Telegram через API приложения
 * Скрипт использует функционал platformPublish для отправки списков в Telegram
 * 
 * Запуск: node telegram-lists-app-test.js
 */

// Импортируем необходимые модули
import axios from 'axios';
import dotenv from 'dotenv';
import { log } from './server/utils/logger.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Тестовый контент
const testContent = {
  title: "Тестирование списков в Telegram",
  content: `
<p><strong>В ходе предыдущей дискуссии</strong> <em>мы рассмотрели причины</em>, по которым завтрак является наиважнейшим приемом пищи, и его влияние на энергетический баланс, метаболические процессы и контроль аппетита. 🌞</p>

<p>В настоящий момент представляется целесообразным проанализировать роль перекусов, поскольку они могут как благоприятно воздействовать на состояние здоровья 🏋️‍♀️, так и незаметно наносить вред фигуре и самочувствию. 🍕</p>

<p><strong>Следует, однако, осознавать, что не все перекусы одинаково полезны. ⚠️</strong> К нежелательным перекусам относятся кондитерские изделия, выпечка, чипсы и прочие продукты фастфуда. 🍩</p>

<p><em>Полезными перекусами являются те, которые обеспечивают чувство насыщения, стабильный энергетический баланс и поступление питательных веществ. 🥗</em></p>

<p><strong>Рекомендации по правильному перекусыванию: 📝</strong></p>

<ul>
    <li>Отдавайте предпочтение перекусам, содержащим белок, полезные жиры и клетчатку – они дольше обеспечивают чувство насыщения и поддерживают обмен веществ. 💪</li>
    <li>Не употребляйте пищу автоматически – перекус необходим, если вы действительно испытываете легкое чувство голода, а не просто по привычке или от скуки. 🤔</li>
    <li>Контролируйте размер порции – умеренное количество орехов полезно, но если съесть полпакета, это уже станет полноценным приемом пищи. 🥜</li>
</ul>

<p>Если вы стремитесь разобраться в вопросах здорового питания, присоединяйтесь к нашему марафону на нашем телеграм-канале. 📲</p>`,
  imageUrl: "https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg",
  additionalImages: []
};

/**
 * Публикует контент в Telegram через оптимизированный API приложения
 * @returns {Promise<object>} Результат публикации
 */
async function publishToTelegram() {
  try {
    const apiUrl = 'http://localhost:5000/api/test/optimized-platform-publish';
    
    // Настройки для публикации
    const settings = {
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID
    };
    
    // Данные для отправки
    const payload = {
      ...testContent,
      ...settings
    };
    
    log(`Отправка запроса к API приложения для публикации контента в Telegram...`, 'test');
    const response = await axios.post(apiUrl, payload);
    
    log(`Ответ от API: ${JSON.stringify(response.data)}`, 'test');
    
    return response.data;
  } catch (error) {
    log(`Ошибка при публикации контента в Telegram: ${error.message}`, 'test');
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Основная функция для проведения теста
 */
async function runTest() {
  try {
    console.log('\n========== ТЕСТ ПУБЛИКАЦИИ СПИСКОВ В TELEGRAM ==========\n');
    
    const result = await publishToTelegram();
    
    if (result.success) {
      console.log(`✅ Тест успешно выполнен. URL сообщения: ${result.postUrl || result.messageUrl}`);
    } else {
      console.log(`❌ Тест не выполнен: ${result.error}`);
    }
    
    console.log('\n========== ТЕСТ ЗАВЕРШЕН ==========\n');
  } catch (error) {
    console.error('Ошибка в процессе выполнения теста:', error);
  }
}

// Запускаем тест
runTest();