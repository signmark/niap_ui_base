/**
 * Тестирование отправки HTML-контента в Telegram через API нашего приложения
 * Запуск: node test-telegram-api.js
 */

const axios = require('axios');

// API URL для нашего приложения
const API_URL = 'http://localhost:5000';

// Пример HTML-контента для публикации
const htmlContent = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

/**
 * Получает токен авторизации
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAuthToken() {
  try {
    // Проверяем наличие переменных окружения для авторизации
    if (!process.env.DIRECTUS_ADMIN_EMAIL || !process.env.DIRECTUS_ADMIN_PASSWORD) {
      console.error('Отсутствуют переменные окружения для авторизации:');
      console.error('Установите DIRECTUS_ADMIN_EMAIL и DIRECTUS_ADMIN_PASSWORD');
      return null;
    }

    // Отправляем запрос на аутентификацию
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: process.env.DIRECTUS_ADMIN_EMAIL,
      password: process.env.DIRECTUS_ADMIN_PASSWORD
    });

    if (response.data && response.data.token) {
      console.log('Авторизация успешна');
      return response.data.token;
    } else {
      console.error('Не удалось получить токен авторизации');
      console.error('Ответ сервера:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при авторизации:', error.message);
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

    console.log('Отправка контента в Telegram через API...');

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

    console.log('Публикация успешно отправлена!');
    console.log('Ответ от сервера:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Ошибка при публикации:', error.message);
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
  // Получаем токен авторизации
  const token = await getAuthToken();

  if (!token) {
    console.error('Не удалось получить токен авторизации, завершение работы');
    return;
  }

  // Публикуем в Telegram
  const result = await publishToTelegram(token);

  if (!result) {
    console.error('Не удалось опубликовать контент, завершение работы');
    return;
  }
}

// Запускаем основную функцию
main();