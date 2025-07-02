/**
 * Простой тест анализа сайта с Wikipedia страницей о сале
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testWebsiteAnalysis() {
  const startTime = Date.now();
  console.log('🧪 Тестируем анализ сайта Wikipedia...');
  
  try {
    const response = await axios.post('http://localhost:5000/api/website-analysis', {
      url: 'https://ru.wikipedia.org/wiki/Сало',
      campaignId: '8e4a1018-72ff-48eb-a3ff-9bd41bf83253'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 секунд таймаут
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Анализ завершен за ${duration}ms`);
    console.log('📄 Результат анализа:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Проверяем что получили структурированные данные
    if (response.data && response.data.companyName) {
      console.log('✅ Данные структурированы правильно');
      console.log(`- Название: ${response.data.companyName}`);
      console.log(`- Описание: ${response.data.businessDescription?.substring(0, 100)}...`);
    } else {
      console.log('❌ Данные не структурированы или отсутствуют');
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Ошибка анализа за ${duration}ms:`, error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      console.log('⏰ Таймаут запроса - DeepSeek API не отвечает');
    }
  }
}

testWebsiteAnalysis();