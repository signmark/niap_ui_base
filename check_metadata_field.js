/**
 * Скрипт для проверки поля metadata в коллекции campaign_content
 */

import axios from 'axios';

async function authenticate() {
  try {
    const response = await axios.post('https://directus.roboflow.tech/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL || 'admin@roboflow.tech',
      password: process.env.DIRECTUS_ADMIN_PASSWORD || 'roboflow2024!'
    });
    
    return response.data.data.access_token;
  } catch (error) {
    console.error('Ошибка аутентификации:', error.response?.data || error.message);
    throw error;
  }
}

async function checkMetadataField(token) {
  try {
    // Получаем информацию о полях коллекции campaign_content
    const response = await axios.get(
      'https://directus.roboflow.tech/fields/campaign_content',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Поля коллекции campaign_content:');
    response.data.data.forEach(field => {
      console.log(`- ${field.field} (${field.type})`);
      if (field.field === 'metadata') {
        console.log('  ✅ Поле metadata найдено!');
        console.log('  Тип:', field.type);
        console.log('  Интерфейс:', field.meta?.interface);
        console.log('  Скрытое:', field.meta?.hidden);
      }
    });

    const metadataField = response.data.data.find(field => field.field === 'metadata');
    if (metadataField) {
      console.log('\n📋 Детали поля metadata:');
      console.log(JSON.stringify(metadataField, null, 2));
    } else {
      console.log('\n❌ Поле metadata не найдено в коллекции');
    }

    return metadataField;
  } catch (error) {
    console.error('❌ Ошибка при проверке поля metadata:', error.response?.data || error.message);
    throw error;
  }
}

async function testContentWithMetadata(token) {
  try {
    // Попробуем получить контент с полем metadata
    const response = await axios.get(
      'https://directus.roboflow.tech/items/campaign_content?limit=5&fields=id,title,content_type,metadata',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n📄 Тест получения контента с полем metadata:');
    response.data.data.forEach(item => {
      console.log(`- ID: ${item.id}, Тип: ${item.content_type}, Metadata: ${item.metadata ? 'есть' : 'нет'}`);
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Ошибка при получении контента:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔍 Проверка поля metadata в коллекции campaign_content...');
    
    const token = await authenticate();
    console.log('✅ Аутентификация успешна\n');
    
    await checkMetadataField(token);
    await testContentWithMetadata(token);
    
    console.log('\n🎉 Проверка завершена!');
    
  } catch (error) {
    console.error('💥 Ошибка:', error);
    process.exit(1);
  }
}

main();