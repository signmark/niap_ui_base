/**
 * Тестирование отправки HTML-контента в Telegram через API нашего приложения
 * Запуск: node test-telegram-api.cjs
 */

const axios = require('axios');
const fs = require('fs');
const colors = require('./server/utils/colors');

// API URL для нашего приложения
const API_URL = 'http://localhost:5000';

// Пример HTML-контента для публикации
const htmlContent = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

/**
 * Получает токен авторизации напрямую из Directus
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getDirectAuthToken() {
  try {
    // В приоритете берем учетные данные из переменных окружения
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    console.log(colors.blue('Попытка прямой авторизации в Directus'));
    
    if (!password) {
      console.error(colors.red('Не указан пароль администратора Directus!'));
      console.error(colors.yellow('Установите переменную окружения DIRECTUS_ADMIN_PASSWORD'));
      return null;
    }
    
    // Отправляем запрос на прямую аутентификацию в Directus
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email,
      password,
      mode: 'cookie'
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      console.log(colors.green('Прямая авторизация в Directus успешна'));
      return response.data.data.access_token;
    } else {
      console.error(colors.red('Не удалось получить токен авторизации из Directus'));
      console.error('Ответ сервера:', response.data);
      return null;
    }
  } catch (error) {
    console.error(colors.red('Ошибка при прямой авторизации в Directus:'), error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    return null;
  }
}

/**
 * Получает токен авторизации через API приложения
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAppAuthToken() {
  try {
    // В приоритете берем учетные данные из переменных окружения
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    console.log(colors.blue('Попытка авторизации через API приложения'));
    
    if (!password) {
      console.error(colors.red('Не указан пароль администратора!'));
      console.error(colors.yellow('Установите переменную окружения DIRECTUS_ADMIN_PASSWORD'));
      return null;
    }

    // Отправляем запрос на аутентификацию
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });

    if (response.data && response.data.token) {
      console.log(colors.green('Авторизация через API приложения успешна'));
      return response.data.token;
    } else {
      console.error(colors.red('Не удалось получить токен авторизации через API приложения'));
      console.error('Ответ сервера:', response.data);
      return null;
    }
  } catch (error) {
    console.error(colors.red('Ошибка при авторизации через API приложения:'), error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    return null;
  }
}

/**
 * Отправляет HTML-контент в Telegram через API приложения
 * @param {string} token Токен авторизации
 * @returns {Promise<object|null>} Результат публикации или null в случае ошибки
 */
async function publishToTelegram(token) {
  try {
    // Формируем данные для публикации
    const publishData = {
      contentType: 'telegram',
      content: htmlContent,
      title: 'Персонализированное питание',
      platformId: 'telegram',
      campaignId: process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e'
    };

    console.log(colors.blue('Отправка контента в Telegram через API...'));

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

    if (response.data && response.data.success) {
      console.log(colors.green('Публикация успешно отправлена!'));
      
      if (response.data.postUrl) {
        console.log(colors.blue('URL публикации:'), response.data.postUrl);
      }
      
      return response.data;
    } else {
      console.error(colors.red('Ошибка при публикации контента через API:'));
      console.error('Данные ответа:', response.data);
      return null;
    }
  } catch (error) {
    console.error(colors.red('Ошибка при публикации:'), error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log(colors.green('=== Тестирование отправки HTML-контента в Telegram через API приложения ==='));
  
  // Выводим исходный HTML
  console.log(colors.blue('\nИсходный HTML-контент:'));
  console.log(htmlContent);
  
  // Пытаемся получить токен авторизации через API приложения
  let token = await getAppAuthToken();
  
  // Если не удалось получить токен через API приложения, пробуем прямую авторизацию
  if (!token) {
    console.log(colors.yellow('\nНе удалось получить токен через API приложения, пробуем прямую авторизацию в Directus...'));
    token = await getDirectAuthToken();
  }

  if (!token) {
    console.error(colors.red('\nНе удалось получить токен авторизации ни одним из способов, завершение работы'));
    return;
  }

  console.log(colors.blue('\nТокен авторизации получен, отправляем контент...'));
  
  // Публикуем в Telegram
  const result = await publishToTelegram(token);

  if (!result) {
    console.error(colors.red('\nНе удалось опубликовать контент, завершение работы'));
    return;
  }

  console.log(colors.green('\n=== Тестирование успешно завершено ==='));
}

// Запускаем основную функцию
main();