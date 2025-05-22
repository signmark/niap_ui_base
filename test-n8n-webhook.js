/**
 * Тестовый скрипт для проверки отправки запроса к n8n webhook
 */

const payload = {
  campaignId: "46868c44-c6a4-4bed-accf-9ad07bba790e",
  days: 7,
  timestamp: Date.now(),
  source: "smm-manager-api"
};

const webhookUrl = 'https://n8n.nplanner.ru/webhook/posts-to-analytics';

console.log('🚀 Отправляем запрос к n8n webhook...');
console.log('URL:', webhookUrl);
console.log('Payload:', JSON.stringify(payload, null, 2));

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'SMM-Manager-Test/1.0'
  },
  body: JSON.stringify(payload)
})
.then(response => {
  console.log('✅ Статус ответа:', response.status);
  console.log('📝 Headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
})
.then(data => {
  console.log('🎉 Успешный ответ от n8n:');
  console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('❌ Ошибка при запросе к n8n:', error.message);
  console.error('📋 Детали:', error);
});