/**
 * Скрипт для отправки конкретного контента в Telegram через API приложения
 * и последующего возврата в статус "draft"
 * 
 * Запуск: node send-specific-content.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Базовый URL для API приложения
const API_BASE_URL = 'http://localhost:5000/api';

// ID контента и кампании
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e';
const CONTENT_ID = '094bb372-d8ae-4759-8d0e-1c6c63391a04'; // Конкретный ID контента для публикации

// Платформа для публикации
const PLATFORM = 'telegram';

// Получение токена авторизации для работы с API
async function getAuthToken() {
  try {
    console.log('Попытка авторизации с заданными учетными данными...');
    
    // Используем заданные учетные данные
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'lbrspb@gmail.com',
      password: 'Qtzp3dh7'
    });
    
    console.log('Ответ от сервера авторизации:', loginResponse.status);
    console.log('Структура данных ответа:', Object.keys(loginResponse.data).join(', '));
    
    // Полная проверка структуры ответа
    if (loginResponse.data) {
      if (loginResponse.data.token) {
        console.log('Обнаружен прямой токен в data.token');
        return loginResponse.data.token;
      } else if (loginResponse.data.access_token) {
        console.log('Обнаружен токен в data.access_token');
        return loginResponse.data.access_token;
      } else if (loginResponse.data.data && loginResponse.data.data.access_token) {
        console.log('Обнаружен токен в data.data.access_token');
        return loginResponse.data.data.access_token;
      } else {
        console.log('Детали ответа:', JSON.stringify(loginResponse.data).substring(0, 200) + '...');
      }
    }
    
    // Специфичный для Directus запрос на прямое получение токена
    try {
      console.log('Попытка прямого запроса к Directus API...');
      
      const directusResponse = await axios.post('https://directus.nplanner.ru/auth/login', {
        email: 'lbrspb@gmail.com',
        password: 'Qtzp3dh7'
      });
      
      if (directusResponse.data && directusResponse.data.data && directusResponse.data.data.access_token) {
        console.log('Получен токен от Directus API');
        return directusResponse.data.data.access_token;
      }
    } catch (directusError) {
      console.error('Ошибка прямого запроса к Directus:', directusError.message);
    }
    
    console.error('Ошибка: не удалось получить токен авторизации из ответа');
    return null;
  } catch (error) {
    console.error('Ошибка авторизации:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data || {}));
    }
    return null;
  }
}

/**
 * Публикует указанный контент в Telegram
 * @returns {Promise<object>} Результат публикации
 */
async function publishContent() {
  try {
    console.log(`\nПубликация контента ID: ${CONTENT_ID}`);
    console.log(`Кампания ID: ${CAMPAIGN_ID}`);
    console.log(`Платформа: ${PLATFORM}`);
    
    // Получаем токен авторизации
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Не удалось получить токен авторизации' };
    }
    
    // Сначала получаем данные контента, чтобы затем опубликовать их
    const contentResponse = await axios.get(`${API_BASE_URL}/content/${CONTENT_ID}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!contentResponse.data || !contentResponse.data.content) {
      console.error('Ошибка: не удалось получить данные контента');
      return { success: false, error: 'Контент не найден' };
    }
    
    const content = contentResponse.data;
    console.log(`Получен контент: "${content.title || 'Без заголовка'}"`);
    
    // Проверяем текущий статус контента и меняем его на "scheduled" если нужно
    const currentStatus = content.status || 'draft';
    console.log(`Текущий статус контента: ${currentStatus}`);
    
    if (currentStatus !== 'scheduled') {
      console.log('Изменение статуса контента на "scheduled" для публикации...');
      
      // Изменяем статус на "scheduled" для публикации
      await axios.patch(`${API_BASE_URL}/content/${CONTENT_ID}`, 
        { status: 'scheduled' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
    
    // Тестовый маршрут для отправки HTML с контролем форматирования
    const publishResponse = await axios.post(`${API_BASE_URL}/test/telegram-html`, {
      contentId: CONTENT_ID,
      campaignId: CAMPAIGN_ID,
      html: content.content,
      autoFixHtml: true
    }, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    return { 
      success: publishResponse.data.success, 
      response: publishResponse.data,
      content: content
    };
  } catch (error) {
    console.error('Ошибка при публикации контента:', error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return { success: false, error: error.message };
  }
}

/**
 * Возвращает контент в статус "draft" после публикации
 * @param {string} contentId ID контента
 * @param {string} originalStatus Исходный статус контента
 * @returns {Promise<boolean>} Успешность операции
 */
async function revertToDraft(contentId, originalStatus = 'draft') {
  try {
    console.log(`\nВозврат контента ${contentId} в статус "${originalStatus}"...`);
    
    // Получаем токен авторизации
    const token = await getAuthToken();
    if (!token) {
      return false;
    }
    
    // Изменяем статус обратно на "draft"
    await axios.patch(`${API_BASE_URL}/content/${contentId}`, 
      { status: originalStatus },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log(`✅ Контент успешно возвращен в статус "${originalStatus}"`);
    return true;
  } catch (error) {
    console.error(`Ошибка при возврате контента в статус "${originalStatus}":`, error.message);
    return false;
  }
}

/**
 * Запускает процесс публикации и выводит результат
 */
async function main() {
  console.log('=== Начало публикации контента в Telegram ===');
  
  try {
    const result = await publishContent();
    
    if (result.success) {
      console.log('\n✅ Публикация успешна!');
      console.log(`URL публикации: ${result.response.postUrl || result.response.messageUrl || 'Нет URL'}`);
      
      if (result.response.details) {
        console.log('Детали:', JSON.stringify(result.response.details));
      }
    } else {
      console.log('\n❌ Ошибка при публикации');
      console.log('Детали ошибки:', result.error || 'Неизвестная ошибка');
    }
    
    // Получаем исходный статус из результата или используем "draft" по умолчанию
    const originalStatus = result.content?.status || 'draft';
    
    // Возвращаем контент в исходный статус
    await revertToDraft(CONTENT_ID, originalStatus);
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении скрипта:', error.message);
    
    // Пытаемся вернуть контент в статус "draft" в случае ошибки
    await revertToDraft(CONTENT_ID);
  }
  
  console.log('\n=== Завершение публикации контента в Telegram ===');
}

// Запускаем публикацию
main();