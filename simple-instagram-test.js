#!/usr/bin/env node

/**
 * Простой тест Instagram публикации через N8N
 * Использует demo данные без реальных учетных данных
 */

const axios = require('axios');

// Тестовые данные для демонстрации
const testData = {
  content: "🚀 Тестовый пост из SMM Manager! #SMM #автоматизация #Instagram",
  imageUrl: "https://picsum.photos/1080/1080",
  contentId: `test-${Date.now()}`,
  campaignId: "demo-campaign",
  hashtags: ["#SMM", "#автоматизация", "#Instagram"],
  caption: "🚀 Тестовый пост из SMM Manager! #SMM #автоматизация #Instagram",
  
  // Реальные настройки для тестирования
  settings: {
    username: "it.zhdanov",
    password: "QtpZ3dh70307"
  }
};

async function testInstagramWorkflow() {
  console.log('🔥 Тестируем Instagram workflow...');
  console.log('📝 Данные поста:', {
    content: testData.content,
    imageUrl: testData.imageUrl,
    contentId: testData.contentId
  });
  
  // Проверяем доступность N8N
  const N8N_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.nplanner.ru/webhook/publish-instagram';
  
  try {
    console.log('📡 Отправляем запрос к N8N webhook:', N8N_URL);
    
    const response = await axios.post(N8N_URL, testData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SMM-Manager-Test/1.0'
      },
      timeout: 30000 // 30 секунд
    });
    
    console.log('✅ Ответ от N8N:', response.status);
    console.log('📄 Данные ответа:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('🎉 Workflow выполнен успешно!');
      if (response.data.postUrl) {
        console.log('🔗 URL поста:', response.data.postUrl);
      }
    } else {
      console.log('❌ Workflow выполнился с ошибкой:', response.data.error);
      console.log('📝 Сообщение:', response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    
    if (error.response) {
      console.log('📄 Статус ответа:', error.response.status);
      console.log('📝 Данные ошибки:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔧 N8N сервер недоступен. Проверьте, что сервер запущен.');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🔧 Не удается найти N8N сервер. Проверьте URL.');
    }
  }
}

// Альтернативный тест через локальный webhook
async function testLocalWebhook() {
  console.log('🔄 Тестируем локальный webhook...');
  
  const LOCAL_URL = 'http://localhost:5000/webhook/publish-instagram';
  
  try {
    const response = await axios.post(LOCAL_URL, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Локальный webhook ответил:', response.status);
    console.log('📄 Данные:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Локальный webhook недоступен:', error.message);
    
    if (error.response) {
      console.log('📄 Статус:', error.response.status);
      console.log('📝 Данные:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Главная функция
async function main() {
  console.log('🚀 Запуск простого теста Instagram публикации...');
  
  // Тестируем N8N webhook
  await testInstagramWorkflow();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Тестируем локальный webhook
  await testLocalWebhook();
  
  console.log('\n✅ Все тесты завершены!');
}

// Запуск
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testInstagramWorkflow, testData };