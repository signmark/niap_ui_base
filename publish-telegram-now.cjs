/**
 * Скрипт для отправки контента в Telegram через основной API нашего приложения
 * Запуск: node publish-telegram-now.cjs
 */

const axios = require('axios');
const dotenv = require('dotenv');

// Загружаем переменные окружения из .env файла
dotenv.config();

// API URL для нашего приложения
const API_URL = 'http://localhost:5000';

// ID Кампании по умолчанию
const DEFAULT_CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Пример HTML-контента для публикации
const HTML_CONTENT = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

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
 * Авторизация в приложении и получение токена
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function login() {
  try {
    log('Авторизация в приложении...');
    
    // Пробуем получить email и пароль из переменных окружения
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    if (!password) {
      log('ОШИБКА: Не указан пароль администратора');
      log('Установите переменную окружения DIRECTUS_ADMIN_PASSWORD');
      return null;
    }
    
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    log(`ПОЛНЫЙ ОТВЕТ СЕРВЕРА: ${JSON.stringify(response.data, null, 2)}`);

    if (response.data && response.data.token) {
      log('Авторизация успешна');
      return response.data.token;
    } else {
      log('ОШИБКА: Не удалось получить токен авторизации');
      log(`Ответ сервера: ${JSON.stringify(response.data)}`);
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
 * Публикация контента в Telegram через API приложения
 * @param {string} token Токен авторизации
 * @returns {Promise<object|null>} Результат публикации или null в случае ошибки
 */
async function publishToTelegram(token) {
  try {
    log('Отправка запроса на публикацию в Telegram...');
    
    // Подготавливаем данные для публикации
    const publishData = {
      platformId: 'telegram',
      campaignId: process.env.CAMPAIGN_ID || DEFAULT_CAMPAIGN_ID,
      content: HTML_CONTENT,
      title: 'Здоровое питание',
      contentType: 'telegram' // Указываем тип контента - Telegram
    };
    
    // Отправляем запрос на публикацию через основной API
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
    log(`Ответ сервера: ${JSON.stringify(response.data, null, 2)}`);
    
    return response.data;
  } catch (error) {
    log(`ОШИБКА при публикации: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
      
      // Проверяем, есть ли детальная информация об ошибке
      if (error.response.data && error.response.data.error) {
        log(`Детали ошибки: ${error.response.data.error}`);
      }
    }
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('=== Запуск публикации контента в Telegram ===');
  
  // Получаем токен авторизации
  const token = await login();
  
  if (!token) {
    log('ОШИБКА: Не удалось получить токен авторизации, завершение работы');
    return;
  }
  
  // Публикуем контент в Telegram
  const result = await publishToTelegram(token);
  
  if (result) {
    if (result.success) {
      log('УСПЕХ: Контент успешно опубликован в Telegram!');
      
      if (result.postUrl) {
        log(`URL публикации: ${result.postUrl}`);
      }
    } else {
      log('ОШИБКА: Публикация не была успешной');
    }
  } else {
    log('ОШИБКА: Не удалось получить результат публикации');
  }
  
  log('=== Работа скрипта завершена ===');
}

// Запускаем основную функцию
main();