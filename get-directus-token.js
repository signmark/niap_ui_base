// Скрипт для получения токена авторизации Directus
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;

async function getDirectusToken() {
  try {
    if (!DIRECTUS_EMAIL || !DIRECTUS_PASSWORD) {
      console.error('⚠️ Не найдены учетные данные Directus в переменных окружения DIRECTUS_EMAIL и DIRECTUS_PASSWORD');
      process.exit(1);
    }

    console.log(`Авторизация в Directus (${DIRECTUS_URL})...`);
    
    const authResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });

    const { data } = authResponse;
    
    if (data.data && data.data.access_token) {
      console.log('✅ Успешная авторизация в Directus!');
      
      // Сохраняем токен в .env файл
      const tokenLine = `DIRECTUS_TOKEN=${data.data.access_token}`;
      
      // Проверяем, существует ли .env файл
      let envContent = '';
      try {
        envContent = fs.readFileSync('.env', 'utf8');
      } catch (err) {
        // Файл не существует, создаем новый
        envContent = '';
      }
      
      // Проверяем, содержит ли файл уже строку с DIRECTUS_TOKEN
      if (envContent.includes('DIRECTUS_TOKEN=')) {
        // Заменяем существующий токен
        envContent = envContent.replace(/DIRECTUS_TOKEN=.*/g, tokenLine);
      } else {
        // Добавляем новый токен в конец файла
        envContent += `\n${tokenLine}`;
      }
      
      // Записываем файл
      fs.writeFileSync('.env', envContent);
      
      console.log(`✅ Токен сохранен в .env файл`);
      console.log(`Токен: ${data.data.access_token.substring(0, 20)}...`);
      
      return data.data.access_token;
    } else {
      console.error('❌ Ошибка авторизации: Токен не получен в ответе');
      console.error('Данные ответа:', JSON.stringify(data));
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка авторизации в Directus:', error.message);
    if (error.response) {
      console.error('Данные ответа:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

// Запускаем функцию получения токена
getDirectusToken()
  .then(token => {
    if (token) {
      console.log('Авторизация выполнена успешно');
    } else {
      console.error('Не удалось получить токен');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Произошла ошибка:', err);
    process.exit(1);
  });