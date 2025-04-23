/**
 * Скрипт для тестирования доступа к Gemini API с проверкой географических ограничений
 * 
 * Запуск: node test-gemini-location.js GEMINI_API_KEY
 * Пример: node test-gemini-location.js "AIza..."
 */

const https = require('https');

// Получаем API ключ из аргументов командной строки
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('❌ Ошибка: API ключ не указан');
  console.log('Использование: node test-gemini-location.js API_KEY');
  console.log('Пример: node test-gemini-location.js "AIza..."');
  process.exit(1);
}

console.log('🔑 API ключ получен из аргументов командной строки');

// Получение информации о текущем IP-адресе сервера
async function getServerLocation() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ipinfo.io',
      path: '/json',
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const ipInfo = JSON.parse(data);
            resolve(ipInfo);
          } catch (err) {
            reject('Не удалось получить информацию о местоположении сервера');
          }
        } else {
          reject(`Ошибка при получении информации о местоположении: ${res.statusCode}`);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(`Ошибка сети при проверке IP: ${error.message}`);
    });
    
    req.end();
  });
}

// Тестирование Gemini API с учетом возможного ограничения по локации
async function testGeminiAccess() {
  console.log('\n📋 Получение информации о местоположении сервера...');
  
  try {
    // 1. Сначала получаем информацию о местоположении сервера
    const locationInfo = await getServerLocation();
    console.log(`\n📍 Информация о сервере:
  IP: ${locationInfo.ip}
  Страна: ${locationInfo.country}
  Регион: ${locationInfo.region}
  Город: ${locationInfo.city}
  Провайдер: ${locationInfo.org}`);
    
    // 2. Проверяем, находится ли сервер в поддерживаемом регионе
    console.log('\n📋 Проверка поддержки API Gemini для текущего местоположения...');
    
    // Список стран, где Gemini API точно работает (неполный)
    const supportedCountries = ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI', 'IE', 'AU', 'NZ', 'JP', 'KR', 'SG'];
    
    if (!supportedCountries.includes(locationInfo.country)) {
      console.log(`\n⚠️ Предупреждение: ваш сервер находится в регионе (${locationInfo.country}), который может не поддерживаться Gemini API.`);
      console.log('Google ограничивает доступ к Gemini API в некоторых странах и регионах.');
    }
    
    // 3. Тестируем доступ к API
    console.log('\n📋 Отправка тестового запроса к Gemini API...');
    
    // Запрос к API
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Hello, world!"
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50
        }
      });
      
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': requestData.length
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          console.log(`\n🌐 Статус ответа: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            resolve({
              success: true,
              data: JSON.parse(responseData)
            });
          } else {
            try {
              const errorData = JSON.parse(responseData);
              resolve({
                success: false,
                status: res.statusCode,
                error: errorData
              });
            } catch (e) {
              reject(`Неизвестная ошибка: ${responseData}`);
            }
          }
        });
      });
      
      req.on('error', (error) => {
        reject(`Ошибка сети: ${error.message}`);
      });
      
      req.write(requestData);
      req.end();
    });
  } catch (error) {
    console.error(`\n❌ Ошибка: ${error}`);
    return { success: false, error };
  }
}

// Анализ результатов и вывод рекомендаций
async function main() {
  try {
    const testResult = await testGeminiAccess();
    
    if (testResult.success) {
      console.log('\n✅ Тест успешно пройден! API ключ Gemini работает корректно в вашем регионе.');
      console.log('\n📝 Краткий ответ API:');
      console.log('------------------------');
      console.log(testResult.data.candidates[0].content.parts[0].text.substring(0, 100) + '...');
      console.log('------------------------');
    } else {
      console.log('\n❌ Ошибка при тестировании API:');
      
      if (testResult.status === 400 && 
          testResult.error?.error?.message?.includes('User location is not supported')) {
        console.log('\n🚫 Подтверждено: Ваш регион не поддерживается Gemini API.');
        console.log('\n📢 Рекомендации:');
        console.log('1️⃣ Используйте VPN для доступа через поддерживаемый регион (например, США или ЕС)');
        console.log('2️⃣ Разместите приложение на сервере в поддерживаемом регионе');
        console.log('3️⃣ Используйте альтернативный API (например, Claude от Anthropic или другие модели)');
        console.log('\n👉 Подробнее: https://ai.google.dev/available_regions');
      } else if (testResult.status === 400) {
        console.log('Возможная причина: неверный формат запроса или другая ошибка валидации.');
        console.log('Подробности ошибки:', testResult.error?.error?.message || 'Нет деталей');
      } else if (testResult.status === 401) {
        console.log('Возможная причина: недействительный API ключ.');
        console.log('Проверьте правильность ключа или получите новый ключ.');
      } else if (testResult.status === 403) {
        console.log('Возможная причина: отказано в доступе. Ключ API может быть ограничен или отключен.');
      } else if (testResult.status === 429) {
        console.log('Возможная причина: превышен лимит запросов. Попробуйте позже.');
      } else {
        console.log(`Статус ошибки: ${testResult.status}`);
        console.log('Подробности:', JSON.stringify(testResult.error, null, 2));
      }
    }
  } catch (error) {
    console.error(`\n❌ Критическая ошибка: ${error}`);
  }
}

// Запуск теста
main();