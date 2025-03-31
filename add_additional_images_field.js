/**
 * Скрипт для добавления поля additional_images в коллекцию campaign_content в Directus
 * Данный скрипт добавляет поддержку хранения дополнительных изображений для постов
 */

import axios from 'axios';
import { config } from 'dotenv';
config();

// Настройки подключения к Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

async function addAdditionalImagesField() {
  console.log('Starting addition of the additional_images field to campaign_content collection...');
  
  // Получение токена администратора
  let adminToken;
  try {
    const authResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    adminToken = authResponse.data.data.access_token;
    console.log('Successfully authenticated as admin');
  } catch (error) {
    console.error('Failed to authenticate:', error.response?.data || error.message);
    return;
  }

  // Проверка наличия поля additional_images в коллекции campaign_content
  try {
    const fieldsResponse = await axios.get(
      `${DIRECTUS_URL}/fields/campaign_content`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const existingFields = fieldsResponse.data.data;
    const additionalImagesField = existingFields.find(field => field.field === 'additional_images');

    if (additionalImagesField) {
      console.log('Field additional_images already exists in campaign_content collection');
      return;
    }

    // Добавление поля additional_images
    await axios.post(
      `${DIRECTUS_URL}/fields/campaign_content`,
      {
        field: 'additional_images',
        type: 'json',
        schema: {
          name: 'additional_images',
          comment: 'Массив URL-адресов дополнительных изображений',
          default_value: '[]'
        },
        meta: {
          interface: 'list',
          special: ['cast-json'],
          display: 'related-values',
          options: {
            template: '{{value}}',
            fields: [
              {
                field: 'value',
                name: 'URL изображения',
                type: 'string',
                meta: {
                  interface: 'input',
                  width: 'full'
                }
              }
            ]
          },
          width: 'full',
          group: 'content',
          translation: 'Дополнительные изображения'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    console.log('Successfully added additional_images field to campaign_content collection');
  } catch (error) {
    console.error('Failed to add field:', error.response?.data || error.message);
    
    // Если ошибка связана с тем, что поле уже существует на уровне БД, но не в схеме Directus
    if (error.response?.data?.errors?.[0]?.extensions?.code === 'COLUMN_EXISTS') {
      console.log('Field already exists in the database. Adding it to Directus schema...');
      await addFieldViaSQL(adminToken);
    }
  }
}

async function addFieldViaSQL(adminToken) {
  try {
    // Использование SQL-операции для добавления поля в схему Directus
    const sqlQuery = `
      INSERT INTO directus_fields (collection, field, special, interface, options, display, width, group, translation)
      VALUES (
        'campaign_content',
        'additional_images',
        '["cast-json"]',
        'list',
        '{"template":"{{value}}","fields":[{"field":"value","name":"URL изображения","type":"string","meta":{"interface":"input","width":"full"}}]}',
        'related-values',
        'full',
        'content',
        '{"ru-RU":"Дополнительные изображения","en-US":"Additional Images"}'
      )
      ON CONFLICT DO NOTHING;
    `;

    await axios.post(
      `${DIRECTUS_URL}/operations/sql`,
      { query: sqlQuery },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    console.log('Successfully added field to Directus schema via SQL');
  } catch (error) {
    console.error('Failed to add field via SQL:', error.response?.data || error.message);
  }
}

// Запуск скрипта
addAdditionalImagesField()
  .then(() => {
    console.log('Script completed');
  })
  .catch(error => {
    console.error('Script failed:', error);
  });