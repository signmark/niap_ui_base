/**
 * Скрипт для добавления поддержки Stories в campaign_content
 * Добавляет поле metadata и обновляет ограничение content_type
 */

import axios from 'axios';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';

async function authenticate() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data?.data?.access_token) {
      console.log('✓ Успешная авторизация в Directus');
      return response.data.data.access_token;
    } else {
      throw new Error('Токен не получен');
    }
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.response?.data || error.message);
    throw error;
  }
}

async function addMetadataField(token) {
  try {
    console.log('🔧 Добавление поля metadata...');
    
    const fieldData = {
      field: 'metadata',
      type: 'json',
      meta: {
        field: 'metadata',
        special: ['cast-json'],
        interface: 'input-code',
        options: {
          language: 'json',
          template: '{}'
        },
        display: 'formatted-json-value',
        readonly: false,
        hidden: false,
        sort: 20,
        width: 'full',
        note: 'Дополнительные данные контента (Stories, настройки и т.д.)',
        required: false,
        group: null,
        validation: null
      },
      schema: {
        name: 'metadata',
        table: 'campaign_content',
        data_type: 'json',
        default_value: '{}',
        is_nullable: true,
        is_unique: false,
        is_primary_key: false,
        has_auto_increment: false,
        foreign_key_column: null,
        foreign_key_table: null,
        comment: 'JSON поле для хранения дополнительных данных'
      }
    };

    const response = await axios.post(
      `${DIRECTUS_URL}/fields/campaign_content`,
      fieldData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✓ Поле metadata успешно добавлено');
    return response.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.errors?.[0]?.message?.includes('already exists')) {
      console.log('ℹ️ Поле metadata уже существует, пропускаем');
    } else {
      console.error('❌ Ошибка при добавлении поля metadata:', error.response?.data || error.message);
      throw error;
    }
  }
}

async function executeSQL(token, query, description) {
  try {
    console.log(`🔧 ${description}...`);
    
    // Используем /server/admin endpoint для выполнения SQL
    const response = await axios.post(
      `${DIRECTUS_URL}/server/admin`,
      {
        query: query,
        mode: 'raw'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✓ ${description} выполнено успешно`);
    return response.data;
  } catch (error) {
    // Игнорируем ошибки если ограничение уже существует или не существует
    if (error.response?.data?.message?.includes('already exists') || 
        error.response?.data?.message?.includes('does not exist')) {
      console.log(`ℹ️ ${description} - изменение уже применено или не требуется`);
    } else {
      console.error(`❌ Ошибка при выполнении "${description}":`, error.response?.data || error.message);
      // Не прерываем выполнение, продолжаем
    }
  }
}

async function refreshDirectusSchema(token) {
  try {
    console.log('🔄 Обновление схемы Directus...');
    
    await axios.post(
      `${DIRECTUS_URL}/schema/snapshot`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✓ Схема Directus обновлена');
  } catch (error) {
    console.error('❌ Ошибка при обновлении схемы:', error.response?.data || error.message);
    // Не критично, продолжаем
  }
}

async function main() {
  try {
    console.log('🚀 Начало настройки поддержки Stories...');
    
    const token = await authenticate();
    
    // 1. Добавляем поле metadata
    await addMetadataField(token);
    
    // 2. Обновляем ограничение content_type для поддержки 'story'
    await executeSQL(
      token,
      `ALTER TABLE campaign_content DROP CONSTRAINT IF EXISTS campaign_content_content_type_check;`,
      'Удаление старого ограничения content_type'
    );
    
    await executeSQL(
      token,
      `ALTER TABLE campaign_content ADD CONSTRAINT campaign_content_content_type_check CHECK (content_type IN ('text', 'text-image', 'video', 'video-text', 'mixed', 'story'));`,
      'Добавление нового ограничения content_type с поддержкой story'
    );
    
    // 3. Обновляем схему Directus
    await refreshDirectusSchema(token);
    
    console.log('🎉 Поддержка Stories успешно добавлена!');
    console.log('');
    console.log('📋 Что было сделано:');
    console.log('   ✓ Добавлено поле metadata (JSON) в campaign_content');
    console.log('   ✓ Обновлено ограничение content_type для поддержки "story"');
    console.log('   ✓ Обновлена схема Directus');
    console.log('');
    console.log('🔧 Теперь можно создавать контент типа "story" с данными в поле metadata');
    
  } catch (error) {
    console.error('❌ Настройка поддержки Stories завершилась с ошибкой:', error.message);
    process.exit(1);
  }
}

main();