/**
 * Тест для проверки сохранения данных платформ при обновлении статуса публикации
 * 
 * Этот тест проверяет, что данные всех платформ сохраняются при публикации 
 * на одну платформу и их статусы обновляются корректно.
 */

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Импортируем логгер
const { log } = await import('./server/utils/logger.js');

// Базовый URL API
const API_URL = 'http://localhost:5000/api';

// Данные для теста
const testContent = {
  content: 'Тестовый контент для проверки сохранения платформ',
  campaignId: '45daab2a-4c6f-4578-8665-3a04f70d0421', // ID реальной кампании
  contentType: 'text',
  title: 'Тест сохранения платформ',
  status: 'draft',
  // Имитируем, что контент уже имеет настройки для трех платформ
  socialPlatforms: {
    telegram: {
      status: 'pending',
      scheduledAt: new Date(Date.now() + 60000).toISOString() // через 1 минуту
    },
    vk: {
      status: 'pending',
      scheduledAt: new Date(Date.now() + 120000).toISOString() // через 2 минуты
    },
    instagram: {
      status: 'pending',
      scheduledAt: new Date(Date.now() + 180000).toISOString() // через 3 минуты
    }
  }
};

// Результат публикации для Telegram
const telegramPublication = {
  platform: 'telegram',
  status: 'published',
  publishedAt: new Date().toISOString(),
  postId: '123456789',
  postUrl: 'https://t.me/channel/123456789',
  error: null
};

// Основная функция теста
async function runTest() {
  try {
    console.log('=== НАЧАЛО ТЕСТА СОХРАНЕНИЯ ПЛАТФОРМ ===');
    
    // Шаг 1: Создаем тестовый контент
    console.log('Шаг 1: Создание тестового контента...');
    const createResponse = await axios.post(`${API_URL}/contents`, testContent);
    const contentId = createResponse.data.id;
    console.log(`Создан контент с ID: ${contentId}`);
    
    // Шаг 2: Проверяем начальное состояние (все три платформы должны быть в pending)
    console.log('Шаг 2: Проверка начального состояния...');
    const initialContent = await axios.get(`${API_URL}/contents/${contentId}`);
    console.log('Начальное состояние socialPlatforms:');
    console.log(JSON.stringify(initialContent.data.socialPlatforms, null, 2));
    
    // Убедимся, что все три платформы присутствуют и имеют статус pending
    const platforms = ['telegram', 'vk', 'instagram'];
    let allPlatformsPresent = true;
    
    platforms.forEach(platform => {
      if (!initialContent.data.socialPlatforms[platform] || 
          initialContent.data.socialPlatforms[platform].status !== 'pending') {
        console.error(`ОШИБКА: Платформа ${platform} отсутствует или имеет неверный статус`);
        allPlatformsPresent = false;
      }
    });
    
    if (!allPlatformsPresent) {
      throw new Error('Начальные данные платформ некорректны');
    }
    
    console.log('✓ Начальное состояние корректно - все три платформы присутствуют со статусом pending');
    
    // Шаг 3: Публикуем на Telegram
    console.log('Шаг 3: Публикация на Telegram...');
    await axios.post(`${API_URL}/publish/${contentId}/telegram/direct`, telegramPublication);
    console.log('Запрос на публикацию в Telegram отправлен');
    
    // Шаг 4: Проверяем состояние после публикации
    console.log('Шаг 4: Проверка состояния после публикации...');
    const updatedContent = await axios.get(`${API_URL}/contents/${contentId}`);
    console.log('Обновленное состояние socialPlatforms:');
    console.log(JSON.stringify(updatedContent.data.socialPlatforms, null, 2));
    
    // Проверяем, что Telegram имеет статус published
    if (!updatedContent.data.socialPlatforms.telegram || 
        updatedContent.data.socialPlatforms.telegram.status !== 'published') {
      throw new Error('Telegram не имеет статуса published после публикации');
    }
    
    console.log('✓ Telegram имеет статус published после публикации');
    
    // Проверяем, что VK и Instagram всё еще присутствуют и имеют статус pending
    if (!updatedContent.data.socialPlatforms.vk || 
        updatedContent.data.socialPlatforms.vk.status !== 'pending') {
      throw new Error('VK отсутствует или не имеет статуса pending после публикации в Telegram');
    }
    
    if (!updatedContent.data.socialPlatforms.instagram || 
        updatedContent.data.socialPlatforms.instagram.status !== 'pending') {
      throw new Error('Instagram отсутствует или не имеет статуса pending после публикации в Telegram');
    }
    
    console.log('✓ VK и Instagram сохранили статус pending после публикации в Telegram');
    console.log('✓ Тест УСПЕШНО ПРОЙДЕН - данные всех платформ сохраняются при обновлении');
    
    // Очистка - удаляем тестовый контент
    console.log('Очистка - удаление тестового контента...');
    await axios.delete(`${API_URL}/contents/${contentId}`);
    console.log(`Тестовый контент с ID ${contentId} удален`);
    
    console.log('=== ТЕСТ ЗАВЕРШЕН УСПЕШНО ===');
    
  } catch (error) {
    console.error('=== ОШИБКА В ТЕСТЕ ===');
    console.error('Сообщение об ошибке:', error.message);
    
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
      console.error('Статус HTTP:', error.response.status);
    }
    
    process.exit(1);
  }
}

// Запускаем тест
runTest();