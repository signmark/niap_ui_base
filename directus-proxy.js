// Простой прокси-сервер для доступа к файлам Directus
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3333;

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;

// Директория для временного хранения файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Токен Directus
let directusToken = null;

// Функция для получения токена Directus
async function getDirectusToken() {
  try {
    if (!DIRECTUS_EMAIL || !DIRECTUS_PASSWORD) {
      throw new Error('Учетные данные Directus не найдены в переменных окружения');
    }

    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });

    if (response.data && response.data.data && response.data.data.access_token) {
      return response.data.data.access_token;
    } else {
      throw new Error('Токен не получен в ответе');
    }
  } catch (error) {
    console.error('Ошибка при получении токена Directus:', error.message);
    if (error.response) {
      console.error('Данные ответа:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// Инициализация токена при запуске
async function initializeToken() {
  try {
    directusToken = await getDirectusToken();
    console.log(`Токен Directus получен: ${directusToken.substring(0, 20)}...`);
    
    // Обновляем токен каждый час
    setInterval(async () => {
      try {
        directusToken = await getDirectusToken();
        console.log(`Токен Directus обновлен: ${directusToken.substring(0, 20)}...`);
      } catch (error) {
        console.error('Ошибка при обновлении токена:', error.message);
      }
    }, 60 * 60 * 1000); // 1 час
  } catch (error) {
    console.error('Ошибка при инициализации токена:', error.message);
  }
}

// Прокси для доступа к файлам
app.get('/proxy/assets/:fileId', async (req, res) => {
  try {
    if (!directusToken) {
      // Если токен еще не получен, получаем его
      try {
        directusToken = await getDirectusToken();
      } catch (error) {
        return res.status(500).json({ error: 'Ошибка авторизации в Directus' });
      }
    }

    const fileId = req.params.fileId;
    const directusUrl = `${DIRECTUS_URL}/assets/${fileId}`;
    
    console.log(`Запрос файла: ${directusUrl}`);

    // Скачиваем файл с заголовком авторизации
    const response = await axios.get(directusUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });

    // Определяем тип контента
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Сохраняем файл локально для дальнейшего использования
    const tempFilePath = path.join(TEMP_DIR, `${fileId}_${Date.now()}`);
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    console.log(`Файл сохранен локально: ${tempFilePath}`);
    
    // Отправляем файл
    res.setHeader('Content-Type', contentType);
    res.send(response.data);
    
    // Удаляем временный файл через 5 минут
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Удален временный файл: ${tempFilePath}`);
        }
      } catch (error) {
        console.error(`Ошибка удаления временного файла: ${error.message}`);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error(`Ошибка при проксировании файла: ${error.message}`);
    if (error.response) {
      const statusCode = error.response.status;
      console.error(`Статус код: ${statusCode}`);
      if (statusCode === 403) {
        // Если ошибка авторизации, пробуем обновить токен
        try {
          directusToken = await getDirectusToken();
          return res.status(500).json({ error: 'Ошибка доступа, повторите запрос' });
        } catch (authError) {
          return res.status(500).json({ error: 'Ошибка авторизации' });
        }
      }
    }
    res.status(500).json({ error: 'Ошибка доступа к файлу' });
  }
});

// Маршрут для проверки, жив ли сервер
app.get('/health', (req, res) => {
  res.json({ status: 'ok', token: directusToken ? 'available' : 'not available' });
});

// Запускаем сервер
app.listen(PORT, async () => {
  console.log(`Прокси-сервер запущен на порту ${PORT}`);
  await initializeToken();
});