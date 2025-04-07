/**
 * Тестовый скрипт для проверки HTML форматирования в Telegram через API нашего приложения
 * Запуск: node test-app-telegram-api.js
 */
import axios from 'axios';
import { config } from 'dotenv';

config();

// ID кампании "Правильное питание"
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Адрес Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://smm-manager.directus.app';

// Адрес нашего API
const API_URL = 'http://localhost:3000';

// Учетные данные Directus
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'zxczxc123';

// Текст с HTML-тегами для тестирования
const TEST_HTML = `<b>Жирный текст</b>

<i>Курсивный текст</i>

<u>Подчеркнутый текст</u>

<b>Вложенный <i>текст с</i> разными <u>тегами</u></b>

<i>Незакрытый тег курсива

<b>Незакрытый тег жирного

Проверка работы HTML-тегов в Telegram`;

/**
 * Основная функция теста
 */
async function testTelegramHtmlFormatting() {
  console.log('=== Тест отправки HTML-форматированного текста в Telegram через API приложения ===\n');
  
  try {
    // 1. Авторизуемся в Directus
    console.log('1. Авторизация в Directus...');
    const authResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (!authResponse.data || !authResponse.data.data || !authResponse.data.data.access_token) {
      throw new Error('Ошибка авторизации в Directus: токен не получен');
    }
    
    const token = authResponse.data.data.access_token;
    console.log('Успешная авторизация в Directus, токен получен.');
    
    // 2. Создаем временный контент для теста
    console.log('\n2. Создание тестового контента в Directus...');
    const testContent = {
      title: 'Тест HTML-форматирования в Telegram',
      content: TEST_HTML,
      text: TEST_HTML,
      status: 'draft',
      campaign_id: CAMPAIGN_ID,
      user_id: authResponse.data.data.user.id,
      social_platforms: {
        telegram: {
          status: 'pending'
        }
      }
    };
    
    const contentResponse = await axios.post(`${DIRECTUS_URL}/items/campaign_content`, testContent, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!contentResponse.data || !contentResponse.data.data || !contentResponse.data.data.id) {
      throw new Error('Ошибка создания контента в Directus');
    }
    
    const contentId = contentResponse.data.data.id;
    console.log(`Тестовый контент создан в Directus, ID: ${contentId}`);
    
    // 3. Получаем кампанию для проверки настроек Telegram
    console.log('\n3. Получение настроек кампании...');
    const campaignResponse = await axios.get(`${DIRECTUS_URL}/items/campaigns/${CAMPAIGN_ID}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!campaignResponse.data || !campaignResponse.data.data) {
      throw new Error(`Кампания ${CAMPAIGN_ID} не найдена`);
    }
    
    const campaign = campaignResponse.data.data;
    console.log(`Данные кампании получены: ${campaign.name}`);
    
    // Проверяем наличие настроек Telegram
    if (!campaign.settings || !campaign.settings.telegram) {
      throw new Error('Настройки Telegram не найдены в кампании');
    }
    
    const telegramSettings = campaign.settings.telegram;
    console.log(`Настройки Telegram: token=${telegramSettings.token ? 'задан' : 'отсутствует'}, chatId=${telegramSettings.chatId || 'отсутствует'}`);
    
    // 4. Вызываем API для публикации контента в Telegram
    console.log('\n4. Отправка запроса на публикацию в Telegram через API приложения...');
    console.log('Текст для отправки:');
    console.log('--------------------------------------------------');
    console.log(TEST_HTML);
    console.log('--------------------------------------------------');
    
    const publishResponse = await axios.post(`${API_URL}/api/publish/${contentId}`, {
      platforms: ['telegram']
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 5. Проверяем результат публикации
    console.log('\n5. Проверка результата публикации:');
    
    if (publishResponse.data && publishResponse.data.results && publishResponse.data.results.telegram) {
      const result = publishResponse.data.results.telegram;
      console.log(JSON.stringify(result, null, 2));
      
      if (result.status === 'published') {
        console.log('\n✅ УСПЕХ: Сообщение успешно опубликовано в Telegram!');
        console.log(`URL сообщения: ${result.postUrl || 'URL не доступен'}`);
      } else {
        console.log(`\n❌ ОШИБКА: Не удалось опубликовать сообщение. Статус: ${result.status}`);
        if (result.error) {
          console.log(`Описание ошибки: ${result.error}`);
        }
      }
    } else {
      console.log('\n❌ ОШИБКА: Неожиданный ответ от API публикации');
      console.log(JSON.stringify(publishResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА при выполнении теста:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.status);
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Запускаем тест
testTelegramHtmlFormatting();