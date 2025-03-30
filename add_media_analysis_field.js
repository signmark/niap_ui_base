import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

async function addMediaAnalysisField() {
  try {
    console.log('Starting to add media_analysis field to campaign_trend_topics collection...');
    
    // 1. Authenticate with Directus
    console.log('Authenticating with Directus...');
    const authResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });

    const token = authResponse.data.data.access_token;
    console.log('Successfully authenticated with Directus');

    // 2. Add new field to campaign_trend_topics collection
    console.log('Adding media_analysis field to campaign_trend_topics collection...');
    try {
      const response = await axios.post(
        `${DIRECTUS_URL}/fields/campaign_trend_topics`,
        {
          field: 'media_analysis',
          type: 'json',
          schema: {
            name: 'media_analysis',
            table: 'campaign_trend_topics',
            data_type: 'json',
            is_nullable: true
          },
          meta: {
            interface: 'input-code',
            special: ['json'],
            options: {
              language: 'json',
              template: JSON.stringify({
                description: null,
                objects: [],
                colors: [],
                mood: null,
                imageUrl: null
              }, null, 2)
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Field added successfully:', response.data);
    } catch (error) {
      console.error('Error adding field via API:', error.response?.data || error.message);
      // В случае ошибки пробуем альтернативный метод - прямой SQL запрос
      console.log('Trying alternative method...');
      await addFieldViaSQL(token);
    }
  } catch (error) {
    console.error('Authentication Error:', error.response?.data || error.message);
  }
}

async function addFieldViaSQL(token) {
  try {
    console.log('Adding field via SQL query...');
    // Выполнить SQL запрос через API
    const response = await axios.post(
      `${DIRECTUS_URL}/utils/run-query`,
      {
        query: 'ALTER TABLE campaign_trend_topics ADD COLUMN IF NOT EXISTS media_analysis JSONB DEFAULT \'{}\''
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Field added successfully via SQL:', response.data);
  } catch (error) {
    console.error('Error with SQL method:', error.response?.data || error.message);
  }
}

addMediaAnalysisField();