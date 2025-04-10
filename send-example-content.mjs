/**
 * Скрипт для отправки тестового контента через API немедленной публикации в Telegram
 * Запуск: node send-example-content.mjs
 */

import axios from 'axios';

// Пример HTML-контента для публикации
const htmlContent = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

async function login() {
  try {
    // Логин для получения токена
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.DIRECTUS_ADMIN_PASSWORD || 'password'
    });
    
    if (loginResponse.data && loginResponse.data.token) {
      console.log('Успешная авторизация');
      return loginResponse.data.token;
    } else {
      console.error('Не удалось получить токен авторизации');
      return null;
    }
  } catch (error) {
    console.error('Ошибка авторизации:', error.message);
    return null;
  }
}

async function publishToTelegram(token) {
  try {
    // Создаем объект с данными для публикации
    const publishData = {
      contentType: 'telegram',
      content: htmlContent,
      title: 'Персонализированное питание',
      platformId: 'telegram',
      campaignId: process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e'
    };
    
    console.log('Отправка контента в Telegram...');
    
    // Отправляем запрос на публикацию контента
    const response = await axios.post(
      'http://localhost:5000/api/social/publish',
      publishData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Ответ от сервера:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Ошибка при публикации:', error.message);
    if (error.response) {
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function main() {
  // Авторизуемся
  const token = await login();
  
  if (!token) {
    console.error('Не удалось получить токен авторизации. Проверьте учетные данные.');
    return;
  }
  
  // Публикуем в Telegram
  const result = await publishToTelegram(token);
  
  if (result && result.success) {
    console.log('Публикация успешно отправлена!');
    if (result.postUrl) {
      console.log('URL публикации:', result.postUrl);
    }
  } else {
    console.error('Не удалось опубликовать контент.');
  }
}

main();