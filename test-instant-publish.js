/**
 * Скрипт для тестирования немедленной публикации (как при нажатии на кнопку "Опубликовать сейчас")
 * Запуск: node test-instant-publish.js
 */

const axios = require('axios');
const dotenv = require('dotenv');

// Загружаем переменные окружения из .env файла
dotenv.config();

// API URL для нашего приложения
const API_URL = 'http://localhost:5000';

// Пример HTML-контента для публикации
const TEST_CONTENT = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

/**
 * Функция для вывода сообщения с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Получает токен авторизации через авторизацию в приложении
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getToken() {
  try {
    log('Попытка авторизации через API приложения...');
    
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    if (!password) {
      log('ОШИБКА: Не указан пароль администратора!');
      log('Установите переменную окружения DIRECTUS_ADMIN_PASSWORD');
      return null;
    }
    
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    if (response.data && response.data.token) {
      log('Авторизация успешна');
      return response.data.token;
    } else {
      log('ОШИБКА: Не удалось получить токен авторизации');
      return null;
    }
  } catch (error) {
    log(`ОШИБКА при авторизации: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Отправляет запрос на немедленную публикацию в Telegram
 * @param {string} token Токен авторизации
 * @returns {Promise<object|null>} Результат публикации или null в случае ошибки
 */
async function publishNow(token) {
  try {
    log('Отправка запроса на немедленную публикацию в Telegram...');
    
    // Данные для публикации
    const publishData = {
      contentType: 'telegram', // Тип контента - Telegram
      platformId: 'telegram',  // ID платформы
      campaignId: process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e', // ID кампании
      content: TEST_CONTENT,   // HTML-контент для публикации
      title: 'Тестовая публикация', // Заголовок публикации
      immediate: true,         // Флаг немедленной публикации
      channel: 'telegram'      // Канал публикации
    };
    
    // Отправляем запрос на публикацию
    const response = await axios.post(
      `${API_URL}/api/social/publish`, 
      publishData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    log('Запрос на публикацию отправлен успешно');
    return response.data;
  } catch (error) {
    log(`ОШИБКА при публикации: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  log('=== Запуск теста немедленной публикации в Telegram ===');
  
  // Получаем токен авторизации
  const token = await getToken();
  
  if (!token) {
    log('ОШИБКА: Не удалось получить токен авторизации, завершение работы');
    return;
  }
  
  // Отправляем запрос на немедленную публикацию
  const result = await publishNow(token);
  
  if (result) {
    log(`Результат публикации: ${JSON.stringify(result, null, 2)}`);
    
    if (result.success) {
      log('✅ Публикация успешно отправлена!');
      
      if (result.postUrl) {
        log(`URL публикации: ${result.postUrl}`);
      }
    } else {
      log('❌ Публикация не была успешной');
    }
  } else {
    log('❌ Не удалось получить результат публикации');
  }
  
  log('=== Тест завершен ===');
}

// Запускаем основную функцию
main();