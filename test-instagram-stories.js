/**
 * Скрипт для тестирования публикации Instagram Stories
 * 
 * Запуск: node test-instagram-stories.js [contentId]
 * 
 * Если contentId не указан, будет использоваться тестовый контент с изображением
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Константы
const API_URL = process.env.API_URL || 'http://localhost:3000';
const CAMPAIGN_ID = process.env.TEST_CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Функция для логирования
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '🔴 ОШИБКА' : 
                 type === 'warn' ? '⚠️ ПРЕДУПРЕЖДЕНИЕ' : 
                 type === 'success' ? '✅ УСПЕХ' : 
                 type === 'step' ? '📋 ШАГ' : 'ℹ️ ИНФО';
  
  console.log(`${timestamp} [${prefix}] ${message}`);
}

/**
 * Выполняет публикацию сторис
 * @param {string} contentId - ID контента для публикации
 * @returns {Promise<Object>} - Результат публикации
 */
async function publishStory(contentId) {
  log(`Публикация контента ${contentId} в Instagram Stories...`, 'step');
  
  try {
    const response = await axios.post(`${API_URL}/api/publish/instagram-stories`, {
      contentId,
      campaignId: CAMPAIGN_ID,
      platform: 'instagram'
    });
    
    if (response.data && response.data.success) {
      log('Публикация успешно выполнена', 'success');
      return response.data;
    } else {
      const errorMessage = response.data && response.data.error 
        ? response.data.error 
        : 'Неизвестная ошибка';
      
      log(`Ошибка при публикации: ${errorMessage}`, 'error');
      return response.data;
    }
  } catch (error) {
    log(`Ошибка запроса: ${error.message}`, 'error');
    
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, 'error');
      return error.response.data;
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    // Получаем ID контента из аргументов командной строки или используем тестовый
    const contentId = process.argv[2];
    
    if (!contentId) {
      log('ID контента не указан. Используйте: node test-instagram-stories.js CONTENT_ID', 'warn');
      process.exit(1);
    }
    
    log(`Начинаем публикацию контента ${contentId} в Instagram Stories`);
    
    // Публикуем сторис
    const result = await publishStory(contentId);
    
    // Выводим результат
    if (result.success) {
      log(`Результат публикации:
      ID истории: ${result.result.storyId || 'не указан'}
      URL истории: ${result.result.storyUrl || 'не указан'}
      Время публикации: ${result.result.publishedAt ? new Date(result.result.publishedAt).toLocaleString() : 'не указано'}
      Имя пользователя: ${result.result.igUsername || 'не указано'}`, 'success');
    } else {
      log(`Публикация не удалась: ${result.error || 'неизвестная ошибка'}`, 'error');
    }
    
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запускаем основную функцию
main();