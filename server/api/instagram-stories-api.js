const express = require('express');
const router = express.Router();
const { IgApiClient } = require('instagram-private-api');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Конфигурация прокси
const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  port: Math.floor(Math.random() * 10) + 10000, // 10000-10009
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D'
};

console.log(`[Instagram Stories API] Использую прокси: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);

/**
 * Создает Instagram клиент с прокси
 */
function createInstagramClient() {
  const ig = new IgApiClient();
  
  // Настраиваем прокси
  const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
  const agent = new SocksProxyAgent(proxyUrl);
  
  ig.request.defaults.agent = agent;
  ig.request.defaults.timeout = 30000;
  
  return ig;
}

/**
 * Скачивает изображение по URL и возвращает Buffer
 */
async function downloadImage(imageUrl) {
  try {
    console.log(`[Stories] Скачиваем изображение: ${imageUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    const buffer = Buffer.from(response.data);
    console.log(`[Stories] Изображение скачано, размер: ${buffer.length} байт`);
    
    return buffer;
  } catch (error) {
    console.error(`[Stories] Ошибка скачивания изображения: ${error.message}`);
    throw error;
  }
}

/**
 * Публикует простую Stories (только изображение + текст)
 */
router.post('/publish-simple', async (req, res) => {
  try {
    const { username, password, imagePath, caption } = req.body;
    
    if (!username || !password || !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные параметры: username, password, imagePath'
      });
    }
    
    console.log(`[Stories Simple] Публикация простой Stories для ${username}`);
    
    const ig = createInstagramClient();
    
    // Авторизуемся
    ig.state.generateDevice(username);
    await ig.account.login(username, password);
    
    console.log(`[Stories Simple] Авторизация успешна`);
    
    // Получаем изображение
    let imageBuffer;
    if (imagePath.startsWith('http')) {
      imageBuffer = await downloadImage(imagePath);
    } else {
      const fullPath = path.resolve(imagePath);
      imageBuffer = fs.readFileSync(fullPath);
    }
    
    // Публикуем Stories
    const storyResult = await ig.publish.story({
      file: imageBuffer
    });
    
    console.log(`[Stories Simple] Stories опубликована успешно:`, storyResult);
    
    const storyId = storyResult.media?.id || 'unknown';
    const storyUrl = `https://instagram.com/stories/${username}/story_${storyId}`;
    
    res.json({
      success: true,
      message: 'Простая Stories успешно опубликована',
      storyId: storyId,
      storyUrl: storyUrl,
      publishedAt: new Date().toISOString(),
      result: storyResult
    });
    
  } catch (error) {
    console.error(`[Stories Simple] Ошибка публикации:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Публикует Stories с интерактивными элементами
 */
router.post('/publish', async (req, res) => {
  try {
    const { username, password, imagePath, caption, interactive } = req.body;
    
    if (!username || !password || !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные параметры: username, password, imagePath'
      });
    }
    
    console.log(`[Stories Interactive] Публикация интерактивной Stories для ${username}`);
    console.log(`[Stories Interactive] Интерактивные элементы:`, interactive);
    
    const ig = createInstagramClient();
    
    // Авторизуемся
    ig.state.generateDevice(username);
    await ig.account.login(username, password);
    
    console.log(`[Stories Interactive] Авторизация успешна`);
    
    // Получаем изображение
    let imageBuffer;
    if (imagePath.startsWith('http')) {
      imageBuffer = await downloadImage(imagePath);
    } else {
      const fullPath = path.resolve(imagePath);
      imageBuffer = fs.readFileSync(fullPath);
    }
    
    // Готовим интерактивные элементы (стикеры)
    let stickers = [];
    
    if (interactive && Array.isArray(interactive)) {
      for (const element of interactive) {
        if (element.type === 'poll') {
          stickers.push({
            type: 'poll',
            question: element.question || 'Ваше мнение?',
            tallies: [
              { text: element.option1 || 'Да', count: 0 },
              { text: element.option2 || 'Нет', count: 0 }
            ],
            x: element.x || 0.5,
            y: element.y || 0.5,
            width: element.width || 0.4,
            height: element.height || 0.2
          });
        } else if (element.type === 'slider') {
          stickers.push({
            type: 'slider',
            question: element.question || 'Оцените от 0 до 100',
            emoji: element.emoji || '🔥',
            x: element.x || 0.5,
            y: element.y || 0.7,
            width: element.width || 0.6,
            height: element.height || 0.15
          });
        } else if (element.type === 'question') {
          stickers.push({
            type: 'question',
            question: element.question || 'Задайте свой вопрос',
            backgroundColor: element.backgroundColor || '#FF6B6B',
            x: element.x || 0.5,
            y: element.y || 0.3,
            width: element.width || 0.8,
            height: element.height || 0.2
          });
        }
      }
    }
    
    console.log(`[Stories Interactive] Подготовлено ${stickers.length} интерактивных элементов`);
    
    // Публикуем Stories с интерактивными элементами
    const publishOptions = {
      file: imageBuffer
    };
    
    // Если есть стикеры, добавляем их
    if (stickers.length > 0) {
      publishOptions.stickers = stickers;
    }
    
    const storyResult = await ig.publish.story(publishOptions);
    
    console.log(`[Stories Interactive] Stories с интерактивными элементами опубликована:`, storyResult);
    
    const storyId = storyResult.media?.id || 'unknown';
    const storyUrl = `https://instagram.com/stories/${username}/story_${storyId}`;
    
    res.json({
      success: true,
      message: 'Интерактивная Stories успешно опубликована',
      storyId: storyId,
      storyUrl: storyUrl,
      publishedAt: new Date().toISOString(),
      interactive: interactive,
      stickersCount: stickers.length,
      result: storyResult
    });
    
  } catch (error) {
    console.error(`[Stories Interactive] Ошибка публикации:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Тестовый эндпоинт для быстрой проверки Stories
 */
router.post('/test', async (req, res) => {
  try {
    console.log(`[Stories Test] Запуск тестовой публикации Stories`);
    
    // Тестовые данные для darkhorse_fashion
    const testData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      imagePath: 'https://picsum.photos/1080/1920', // Случайное изображение для Stories
      caption: 'Тестовая Stories из API',
      interactive: [
        {
          type: 'poll',
          question: 'Нравится новая коллекция?',
          option1: 'Да, супер!',
          option2: 'Не очень',
          x: 0.5,
          y: 0.3,
          width: 0.7,
          height: 0.2
        },
        {
          type: 'slider',
          question: 'Оцените дизайн',
          emoji: '⭐',
          x: 0.5,
          y: 0.6,
          width: 0.8,
          height: 0.15
        }
      ]
    };
    
    // Отправляем запрос на наш же эндпоинт для публикации
    const response = await axios.post('http://localhost:5000/api/instagram-stories/publish', testData, {
      timeout: 60000
    });
    
    console.log(`[Stories Test] Результат тестовой публикации:`, response.data);
    
    res.json({
      success: true,
      message: 'Тестовая Stories успешно опубликована',
      result: response.data
    });
    
  } catch (error) {
    console.error(`[Stories Test] Ошибка тестовой публикации:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

module.exports = router;