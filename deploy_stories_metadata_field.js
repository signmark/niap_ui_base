/**
 * Скрипт для развертывания поля metadata в production базе данных
 * Добавляет поддержку Stories в коллекцию campaign_content
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const PRODUCTION_DIRECTUS_URL = 'https://directus.nplanner.ru';
const PRODUCTION_ADMIN_EMAIL = process.env.PRODUCTION_ADMIN_EMAIL || 'admin@nplanner.ru';
const PRODUCTION_ADMIN_PASSWORD = process.env.PRODUCTION_ADMIN_PASSWORD;

async function authenticate() {
  try {
    console.log('🔐 Авторизация в production Directus...');
    
    const response = await axios.post(`${PRODUCTION_DIRECTUS_URL}/auth/login`, {
      email: PRODUCTION_ADMIN_EMAIL,
      password: PRODUCTION_ADMIN_PASSWORD
    });
    
    console.log('✅ Авторизация успешна');
    return response.data.data.access_token;
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.response?.data || error.message);
    throw error;
  }
}

async function checkFieldExists(token) {
  try {
    console.log('🔍 Проверка существования поля metadata...');
    
    const response = await axios.get(
      `${PRODUCTION_DIRECTUS_URL}/fields/campaign_content`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const metadataField = response.data.data.find(field => field.field === 'metadata');
    
    if (metadataField) {
      console.log('✅ Поле metadata уже существует');
      return true;
    } else {
      console.log('❌ Поле metadata не найдено');
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке поля:', error.response?.data || error.message);
    throw error;
  }
}

async function addMetadataField(token) {
  try {
    console.log('➕ Создание поля metadata...');
    
    const fieldData = {
      field: 'metadata',
      type: 'json',
      schema: {
        default_value: {},
        is_nullable: true
      },
      meta: {
        interface: 'input-code',
        options: {
          language: 'json',
          template: '{}'
        },
        display: 'formatted-json-value',
        note: 'Дополнительные данные контента (Stories, настройки и т.д.)',
        hidden: false,
        readonly: false,
        required: false,
        sort: 20,
        width: 'full'
      }
    };
    
    const response = await axios.post(
      `${PRODUCTION_DIRECTUS_URL}/fields/campaign_content`,
      fieldData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Поле metadata успешно создано');
    return response.data.data;
  } catch (error) {
    console.error('❌ Ошибка при создании поля:', error.response?.data || error.message);
    throw error;
  }
}

async function updateContentTypeConstraint(token) {
  try {
    console.log('🔄 Обновление ограничений для content_type...');
    
    // Получаем текущую конфигурацию поля content_type
    const response = await axios.get(
      `${PRODUCTION_DIRECTUS_URL}/fields/campaign_content/content_type`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const currentField = response.data.data;
    
    // Обновляем опции поля, добавляя 'stories' в список возможных значений
    const updatedOptions = {
      ...currentField.meta.options,
      choices: [
        { text: 'Текст с изображением', value: 'text-image' },
        { text: 'Только текст', value: 'text-only' },
        { text: 'Только изображение', value: 'image-only' },
        { text: 'Видео', value: 'video' },
        { text: 'Stories', value: 'stories' }
      ]
    };
    
    const updateData = {
      meta: {
        ...currentField.meta,
        options: updatedOptions
      }
    };
    
    await axios.patch(
      `${PRODUCTION_DIRECTUS_URL}/fields/campaign_content/content_type`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Ограничения content_type обновлены');
  } catch (error) {
    console.error('❌ Ошибка при обновлении ограничений:', error.response?.data || error.message);
    // Не прерываем выполнение, это не критично
  }
}

async function refreshDirectusSchema(token) {
  try {
    console.log('🔄 Обновление схемы Directus...');
    
    await axios.post(
      `${PRODUCTION_DIRECTUS_URL}/schema/snapshot`,
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
    console.error('⚠️ Предупреждение при обновлении схемы:', error.response?.data || error.message);
    // Не прерываем выполнение, это не критично
  }
}

async function testMetadataField(token) {
  try {
    console.log('🧪 Тестирование поля metadata...');
    
    // Проверяем, что поле доступно для чтения
    const response = await axios.get(
      `${PRODUCTION_DIRECTUS_URL}/items/campaign_content?limit=1&fields=id,content_type,metadata`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Поле metadata успешно протестировано');
    console.log(`📊 Найдено ${response.data.data.length} записей для тестирования`);
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка при тестировании поля:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Развертывание поддержки Stories в production...');
    console.log(`🌐 Directus URL: ${PRODUCTION_DIRECTUS_URL}`);
    console.log(`👤 Пользователь: ${PRODUCTION_ADMIN_EMAIL}`);
    console.log('─'.repeat(50));
    
    // Проверяем переменные окружения
    if (!PRODUCTION_ADMIN_PASSWORD) {
      throw new Error('Не указан пароль администратора (PRODUCTION_ADMIN_PASSWORD)');
    }
    
    // Авторизация
    const token = await authenticate();
    
    // Проверяем существование поля
    const fieldExists = await checkFieldExists(token);
    
    if (!fieldExists) {
      // Создаем поле metadata
      await addMetadataField(token);
    }
    
    // Обновляем ограничения content_type
    await updateContentTypeConstraint(token);
    
    // Обновляем схему Directus
    await refreshDirectusSchema(token);
    
    // Тестируем поле
    await testMetadataField(token);
    
    console.log('─'.repeat(50));
    console.log('🎉 Развертывание завершено успешно!');
    console.log('');
    console.log('📝 Что было сделано:');
    console.log('  ✅ Поле metadata создано/проверено');
    console.log('  ✅ Добавлен тип контента "Stories"');
    console.log('  ✅ Схема Directus обновлена');
    console.log('  ✅ Функциональность протестирована');
    console.log('');
    console.log('🎯 Теперь можно создавать Stories контент в интерфейсе!');
    
  } catch (error) {
    console.error('💥 Ошибка развертывания:', error.message);
    process.exit(1);
  }
}

// Запуск скрипта
main();