/**
 * Создает новый контент в кампании с вашим HTML и тестирует публикацию
 */

import axios from 'axios';
import fs from 'fs';

// Настройки API
const API_URL = 'http://localhost:3000/api';
const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // Базовая кампания

// HTML из редактора
const contentHTML = `<p><em>В ходе предыдущего обсуждения мы разобрали, почему завтрак – это король дня, и как он влияет на нашу энергию, метаболизм и контроль аппетита. 👑 Сегодня пришло время осветить тему перекусов – этих маленьких, но важных спутников нашего дня. 🍭</em></p>

<p><strong>Перекусы могут быть как союзниками в деле поддержания здоровья и стройности 💪, так и коварными врагами, незаметно подрывающими наши усилия. 😈</strong> Правильные перекусы помогают избежать резких скачков сахара в крови, обеспечивают стабильный приток энергии и не позволяют голоду взять верх, что часто приводит к переедания на основных приемах пищи. ⏱️ <strong>Но не все перекусы одинаково полезны – есть те, что лучше обходить стороной! ☝️</strong></p>

<p>Сладости, булочки, печенье, чипсы и прочие соблазны фастфуда могут подарить лишь мимолетный прилив сил, а после – упадок энергии, усиление аппетита и лишние сантиметры на талии. 😩 <em>Истинно полезные перекусы – это те, что надолго утоляют голод, дарят заряд бодрости и снабжают организм ценными питательными веществами. 🥗</em> Орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой – вот настоящие друзья стройной фигуры и хорошего самочувствия! 🥜🍓🥑</p>

<p><strong>Вот несколько золотых правил грамотного перекуса: 📝</strong></p>

<ul>
<li>Выбирайте перекусы с белком, полезными жирами и клетчаткой – они дольше сохраняют чувство сытости и поддерживают метаболизм. 💪</li>
<li>Прислушивайтесь к своему телу – перекусывайте, только когда действительно голодны, а не по привычке или от скуки. 🤔</li>
<li>Контролируйте порции – горсть орехов полезна, но целый пакет уже перебор. 🥜</li>
</ul>

<p>Если вы стремитесь разобраться в тонкостях правильного питания, избавиться от вредных привычек и выстроить идеальную систему питания для себя, присоединяйтесь к нашему марафону в Телеграме! 📲</p>`;

/**
 * Получает аутентификационный токен
 * @returns {Promise<string>} Токен авторизации
 */
async function getToken() {
  try {
    const response = await axios.get(`${API_URL}/auth/me`);
    
    if (response.data && response.data.token) {
      console.log('✅ Авторизация успешна');
      return response.data.token;
    }
    
    throw new Error('Не удалось получить токен');
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
    throw error;
  }
}

/**
 * Создает новый контент с заданным HTML
 * @param {string} token Токен авторизации
 * @returns {Promise<string>} ID созданного контента
 */
async function createContent(token) {
  try {
    const contentData = {
      campaign_id: campaignId,
      content_type: 'text',
      title: '🥗 Перекусы: друзья или враги стройности?',
      content: contentHTML,
      status: 'draft'
    };
    
    console.log('Создаю новый контент...');
    
    const response = await axios.post(`${API_URL}/campaign-content`, contentData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.data && response.data.data.id) {
      console.log(`✅ Контент успешно создан с ID: ${response.data.data.id}`);
      return response.data.data.id;
    }
    
    throw new Error('Не удалось создать контент');
  } catch (error) {
    console.error('❌ Ошибка при создании контента:', error);
    throw error;
  }
}

/**
 * Публикует контент в Telegram
 * @param {string} token Токен авторизации
 * @param {string} contentId ID контента
 * @returns {Promise<object>} Результат публикации
 */
async function publishToTelegram(token, contentId) {
  try {
    console.log(`Публикую контент ${contentId} в Telegram...`);
    
    const response = await axios.post(`${API_URL}/content/${contentId}/publish-social`, {
      platform: 'telegram'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Публикация успешно выполнена!');
      console.log(`URL публикации: ${response.data.postUrl || 'недоступен'}`);
      return response.data;
    }
    
    throw new Error('Не удалось опубликовать контент');
  } catch (error) {
    console.error('❌ Ошибка при публикации контента:', error);
    throw error;
  }
}

/**
 * Главная функция
 */
async function main() {
  try {
    console.log('=== Тестирование публикации контента в Telegram ===\n');
    
    // Получаем токен авторизации
    const token = await getToken();
    
    // Создаем новый контент
    const contentId = await createContent(token);
    
    // Публикуем контент в Telegram
    const result = await publishToTelegram(token, contentId);
    
    console.log('\n=== Тестирование завершено ===');
    console.log('Результат:', result);
  } catch (error) {
    console.error('\n❌ Произошла ошибка:', error);
  }
}

// Запускаем тест
main();