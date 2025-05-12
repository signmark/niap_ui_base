/**
 * Скрипт для тестирования публикации Instagram Stories
 * 
 * Запуск: node test-instagram-stories.js [contentId]
 * 
 * Если contentId не указан, будет использоваться тестовый контент с изображением
 */

import fetch from 'node-fetch';
import { env } from 'process';

// Настройки API
const API_URL = env.API_URL || 'http://localhost:5000';
const STORY_PUBLISHING_ENDPOINT = '/api/publish/stories';

// Токен авторизации (при необходимости)
const AUTH_TOKEN = env.AUTH_TOKEN;

// Содержимое тестового запроса
const TEST_CONTENT_ID = env.TEST_CONTENT_ID || 'c8db1fd0-6fd3-4a21-ab5d-c4efd801bb63';

// Целевая платформа - Instagram
const PLATFORM = 'instagram';

/**
 * Выполняет публикацию сторис
 * @param {string} contentId - ID контента для публикации
 * @returns {Promise<Object>} - Результат публикации
 */
async function publishStory(contentId) {
    try {
        console.log(`[Test] Публикация Instagram Story для контента ID: ${contentId}`);
        
        // Подготовка параметров запроса
        const payload = {
            contentId,
            platform: PLATFORM
        };
        
        // Настройки запроса
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
            },
            body: JSON.stringify(payload)
        };
        
        console.log(`[Test] Отправка запроса на ${API_URL}${STORY_PUBLISHING_ENDPOINT}`);
        console.log(`[Test] Параметры: ${JSON.stringify(payload)}`);
        
        // Отправка запроса
        const response = await fetch(`${API_URL}${STORY_PUBLISHING_ENDPOINT}`, requestOptions);
        const result = await response.json();
        
        // Проверка результата
        if (response.ok) {
            console.log('[Test] Публикация выполнена успешно');
            console.log(`[Test] Статус код: ${response.status}`);
            console.log(`[Test] Результат: ${JSON.stringify(result, null, 2)}`);
            return result;
        } else {
            console.error('[Test] Ошибка при публикации');
            console.error(`[Test] Статус код: ${response.status}`);
            console.error(`[Test] Ошибка: ${JSON.stringify(result, null, 2)}`);
            throw new Error(`Ошибка API: ${result.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error(`[Test] Критическая ошибка: ${error.message}`);
        throw error;
    }
}

/**
 * Главная функция скрипта
 */
async function main() {
    try {
        // Получаем ID контента из аргументов или используем тестовый ID
        const contentId = process.argv[2] || TEST_CONTENT_ID;
        console.log(`[Test] Запуск тестирования публикации Instagram Story`);
        console.log(`[Test] API URL: ${API_URL}`);
        console.log(`[Test] Content ID: ${contentId}`);
        
        // Публикуем сторис
        const result = await publishStory(contentId);
        
        console.log(`[Test] Тестирование завершено успешно`);
        process.exit(0);
    } catch (error) {
        console.error(`[Test] Тестирование завершилось с ошибкой: ${error.message}`);
        process.exit(1);
    }
}

// Запуск скрипта
main();