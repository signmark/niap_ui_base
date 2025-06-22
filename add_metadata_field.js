/**
 * Скрипт для добавления поля metadata в коллекцию campaign_content
 * Поле metadata будет типа JSON для хранения данных Stories
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

async function addMetadataField(token) {
  try {
    const fieldData = {
      field: 'metadata',
      type: 'json',
      meta: {
        field: 'metadata',
        type: 'json',
        interface: 'input-code',
        display: 'formatted-json-value',
        special: ['cast-json'],
        note: 'JSON поле для хранения дополнительных данных, включая Stories',
        hidden: false,
        readonly: false,
        required: false,
        sort: null,
        width: 'full',
        options: {
          language: 'json',
          lineNumber: true,
          template: '{\n  "storyData": null\n}'
        },
        display_options: null,
        validation: null,
        validation_message: null
      },
      schema: {
        name: 'metadata',
        table: 'campaign_content',
        data_type: 'json',
        default_value: null,
        max_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_nullable: true,
        is_primary_key: false,
        has_auto_increment: false,
        foreign_key_column: null,
        foreign_key_table: null,
        comment: 'JSON field for storing additional data including Stories'
      }
    };

    const response = await axios.post(
      'https://directus.roboflow.tech/fields/campaign_content',
      fieldData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Поле metadata успешно добавлено в коллекцию campaign_content');
    console.log('Детали:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при добавлении поля metadata:', error.response?.data || error.message);
    throw error;
  }
}

async function refreshDirectusSchema(token) {
  try {
    await axios.post(
      'https://directus.roboflow.tech/schema/snapshot',
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Схема Directus обновлена');
  } catch (error) {
    console.log('⚠️ Предупреждение: не удалось обновить схему Directus:', error.response?.data || error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Начало добавления поля metadata в коллекцию campaign_content...');
    
    // Аутентификация
    console.log('📡 Аутентификация в Directus...');
    const token = await authenticate();
    console.log('✅ Аутентификация успешна');
    
    // Добавление поля metadata
    console.log('📝 Добавление поля metadata...');
    await addMetadataField(token);
    
    // Обновление схемы
    console.log('🔄 Обновление схемы Directus...');
    await refreshDirectusSchema(token);
    
    console.log('🎉 Поле metadata успешно добавлено! Теперь можно создавать Stories контент.');
    
  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  }
}

main();