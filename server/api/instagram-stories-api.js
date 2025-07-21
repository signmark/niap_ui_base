const express = require('express');
const router = express.Router();
const { IgApiClient } = require('instagram-private-api');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createStoriesImage, saveImageToTempFile } = require('../utils/image-generator.cjs');

// Конфигурация прокси (используем несколько портов для повторных попыток)
const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  ports: [10001, 10002, 10007, 10006], // Быстрые порты согласно тестам
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D'
};

console.log(`[Instagram Stories API] Использую прокси: ${PROXY_CONFIG.host} (порты: ${PROXY_CONFIG.ports.join(', ')})`);

/**
 * Создает Instagram клиент с прокси
 */
function createInstagramClient(portIndex = 0) {
  const ig = new IgApiClient();
  
  // Выбираем порт для данной попытки
  const port = PROXY_CONFIG.ports[portIndex % PROXY_CONFIG.ports.length];
  
  // Настраиваем прокси
  const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${port}`;
  const agent = new SocksProxyAgent(proxyUrl);
  
  ig.request.defaults.agent = agent;
  ig.request.defaults.timeout = 60000; // Сокращаем таймаут для быстрых повторных попыток
  
  return { ig, port };
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

// Система контроля времени между публикациями
const publicationTimestamps = new Map(); // username -> timestamp последней публикации

/**
 * Проверяет и обеспечивает минимальную задержку между публикациями
 */
async function enforcePublicationDelay(username, minDelayMinutes = 5) {
  const now = Date.now();
  const lastPublication = publicationTimestamps.get(username);
  
  if (lastPublication) {
    const timeSinceLastPublication = now - lastPublication;
    const minDelayMs = minDelayMinutes * 60 * 1000;
    
    if (timeSinceLastPublication < minDelayMs) {
      const waitTime = minDelayMs - timeSinceLastPublication;
      console.log(`[Stories Delay] Последняя публикация была ${Math.round(timeSinceLastPublication / 1000)} сек назад`);
      console.log(`[Stories Delay] Ждем ${Math.round(waitTime / 1000)} секунд перед следующей публикацией...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Обновляем время последней публикации
  publicationTimestamps.set(username, now);
}

/**
 * Публикует простую Stories с генерированным изображением с повторными попытками
 */
async function publishStoriesWithRetry(username, password, storyText, storyBgColor, storyTextColor, maxAttempts = 3) {
  let lastError = null;
  
  // Обеспечиваем задержку между публикациями
  await enforcePublicationDelay(username, 3); // 3 минуты между публикациями
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`[Stories Retry] Попытка ${attempt + 1}/${maxAttempts} с портом ${PROXY_CONFIG.ports[attempt % PROXY_CONFIG.ports.length]}`);
      
      const { ig, port } = createInstagramClient(attempt);
      
      // Авторизуемся
      ig.state.generateDevice(username);
      await ig.account.login(username, password);
      
      console.log(`[Stories Retry] Авторизация успешна через порт ${port}`);
      
      // Дополнительная задержка перед загрузкой для имитации человеческого поведения
      const humanDelay = 2000 + Math.random() * 3000; // 2-5 секунд
      console.log(`[Stories Retry] Имитация человеческого поведения: ждем ${Math.round(humanDelay)} мс`);
      await new Promise(resolve => setTimeout(resolve, humanDelay));
      
      // Создаем изображение с текстом
      const imageBuffer = await createStoriesImage(
        storyText, 
        storyBgColor, 
        storyTextColor
      );
      
      console.log(`[Stories Retry] Изображение создано: ${imageBuffer.length} байт`);
      
      // Публикуем Stories
      const storyResult = await ig.publish.story({
        file: imageBuffer
      });
      
      console.log(`[Stories Retry] SUCCESS на попытке ${attempt + 1} через порт ${port}:`, storyResult);
      
      const storyId = storyResult.media?.id || 'unknown';
      const storyUrl = `https://instagram.com/stories/${username}/story_${storyId}`;
      
      return {
        success: true,
        message: `Stories успешно опубликована через порт ${port} на попытке ${attempt + 1}`,
        storyId: storyId,
        storyUrl: storyUrl,
        publishedAt: new Date().toISOString(),
        text: storyText,
        colors: { background: storyBgColor, text: storyTextColor },
        port: port,
        attempt: attempt + 1,
        result: storyResult
      };
      
    } catch (error) {
      lastError = error;
      console.error(`[Stories Retry] Попытка ${attempt + 1} неудачна: ${error.message}`);
      
      // Если это feedback_required, добавляем дополнительную задержку
      if (error.message.includes('feedback_required')) {
        console.log(`[Stories Retry] Обнаружена потребность в дополнительной верификации - увеличиваем задержку`);
        if (attempt < maxAttempts - 1) {
          const extendedDelay = 30000 + Math.random() * 15000; // 30-45 секунд
          console.log(`[Stories Retry] Расширенная задержка: ${Math.round(extendedDelay / 1000)} секунд`);
          await new Promise(resolve => setTimeout(resolve, extendedDelay));
        }
      } else {
        // Обычная задержка для других ошибок
        if (attempt < maxAttempts - 1) {
          console.log(`[Stories Retry] Ждем 5 секунд перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }
  
  throw lastError;
}

/**
 * Публикует простую Stories с генерированным изображением
 */
router.post('/publish-simple', async (req, res) => {
  try {
    const { username, password, text, backgroundColor, textColor, caption, slides } = req.body;
    
    // Поддерживаем как старый формат (text), так и новый (slides)
    let storyText, storyBgColor, storyTextColor;
    
    if (slides && Array.isArray(slides) && slides.length > 0) {
      // Новый формат - используем первый слайд
      const firstSlide = slides[0];
      storyText = firstSlide.text;
      storyBgColor = firstSlide.backgroundColor || '#6366f1';
      storyTextColor = firstSlide.textColor || '#FFFFFF';
    } else {
      // Старый формат
      storyText = text;
      storyBgColor = backgroundColor || '#6366f1';
      storyTextColor = textColor || '#FFFFFF';
    }
    
    if (!username || !password || !storyText) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные параметры: username, password и текст (в поле text или slides[0].text)'
      });
    }
    
    console.log(`[Stories Simple] Публикация простой Stories для ${username} с текстом "${storyText}"`);
    console.log(`[Stories Simple] Цвета: фон ${storyBgColor}, текст ${storyTextColor}`);
    
    // Используем функцию с повторными попытками
    const result = await publishStoriesWithRetry(username, password, storyText, storyBgColor, storyTextColor);
    
    res.json(result);
    
  } catch (error) {
    console.error(`[Stories Simple] Все попытки исчерпаны:`, error);
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
 * Публикует интерактивные Stories с несколькими слайдами на основе пользовательских данных
 */
router.post('/publish-interactive', async (req, res) => {
  try {
    const { username, password, slides } = req.body;
    
    if (!username || !password || !slides || !Array.isArray(slides)) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные параметры: username, password, slides (массив)'
      });
    }
    
    console.log(`[Stories Interactive] Публикация пользовательских Stories для ${username}`);
    console.log(`[Stories Interactive] Количество слайдов: ${slides.length}`);
    
    const ig = createInstagramClient();
    
    // Авторизуемся
    ig.state.generateDevice(username);
    await ig.account.login(username, password);
    
    console.log(`[Stories Interactive] Авторизация успешна`);
    
    const publishedStories = [];
    
    // Публикуем каждый слайд как отдельную Stories
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`[Stories Interactive] Обрабатываем слайд ${i + 1}/${slides.length}:`, slide);
      
      try {
        // Извлекаем данные слайда
        const backgroundColor = slide.background?.value || '#6366f1';
        let slideText = '';
        
        // Собираем весь текст со слайда
        if (slide.elements && Array.isArray(slide.elements)) {
          slide.elements.forEach(element => {
            if (element.type === 'text' && element.content && element.content.text) {
              slideText = element.content.text;
            }
          });
        }
        
        // Если нет текста, используем порядковый номер
        if (!slideText) {
          slideText = `Слайд ${i + 1}`;
        }
        
        console.log(`[Stories Interactive] Слайд ${i + 1}: создаем изображение с текстом "${slideText}" на фоне ${backgroundColor}`);
        
        // Создаем изображение с текстом на цветном фоне
        const imageBuffer = await createStoriesImage(slideText, backgroundColor, '#FFFFFF');
        
        console.log(`[Stories Interactive] Слайд ${i + 1}: изображение создано (${imageBuffer.length} байт)`);
        
        // Публикуем Stories
        const publishOptions = {
          file: imageBuffer
        };
        
        const storyResult = await ig.publish.story(publishOptions);
        
        const storyId = storyResult.media?.id || 'unknown';
        const storyUrl = `https://instagram.com/stories/${username}/${storyId}`;
        
        publishedStories.push({
          slideIndex: i,
          slideId: slide.id,
          storyId: storyId,
          storyUrl: storyUrl,
          elements: slide.elements?.length || 0
        });
        
        console.log(`[Stories Interactive] Слайд ${i + 1} опубликован: ${storyId}`);
        
        // Пауза между публикациями
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (slideError) {
        console.error(`[Stories Interactive] Ошибка публикации слайда ${i + 1}:`, slideError);
        publishedStories.push({
          slideIndex: i,
          slideId: slide.id,
          error: slideError.message
        });
      }
    }
    
    console.log(`[Stories Interactive] Завершено. Опубликовано ${publishedStories.filter(s => !s.error).length} из ${slides.length} слайдов`);
    
    res.json({
      success: true,
      message: `Интерактивные Stories опубликованы: ${publishedStories.filter(s => !s.error).length}/${slides.length} слайдов`,
      publishedStories: publishedStories,
      totalSlides: slides.length,
      successfulSlides: publishedStories.filter(s => !s.error).length,
      publishedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Stories Interactive] Ошибка публикации интерактивных Stories:`, error);
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