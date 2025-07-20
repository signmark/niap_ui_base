/**
 * Instagram Direct Service
 * Альтернативный сервис для прямых вызовов Instagram API
 * Используется в social-publishing-router.ts для интеграции с планировщиком
 */

const instagramPrivateService = require('./instagram-private-service');

/**
 * Публикация через Instagram Direct API
 * Унифицированный интерфейс для использования в планировщике
 */
async function publishViaInstagramDirectAPI(content, campaignSettings) {
  try {
    console.log('[Instagram Direct] Начинаем публикацию через Direct API');
    console.log('[Instagram Direct] Контент:', {
      id: content.id,
      contentType: content.contentType,
      hasImage: !!content.imageUrl,
      hasVideo: !!content.videoUrl,
      platform: 'instagram'
    });

    // Извлекаем учетные данные Instagram из настроек кампании
    const instagramSettings = campaignSettings?.instagram;
    
    if (!instagramSettings || !instagramSettings.username || !instagramSettings.password) {
      throw new Error('Instagram учетные данные не найдены в настройках кампании');
    }

    const { username, password } = instagramSettings;
    
    console.log(`[Instagram Direct] Используем аккаунт: ${username}`);

    // Определяем тип публикации
    if (content.contentType === 'stories' || content.contentType === 'instagram_stories') {
      return await publishInstagramStory(content, username, password);
    } else {
      return await publishInstagramPost(content, username, password);
    }

  } catch (error) {
    console.error('[Instagram Direct] Ошибка публикации:', error.message);
    
    return {
      success: false,
      status: 'failed',
      error: error.message,
      platform: 'instagram',
      publishedAt: new Date().toISOString()
    };
  }
}

/**
 * Публикация обычного поста Instagram
 */
async function publishInstagramPost(content, username, password) {
  try {
    console.log('[Instagram Direct] Публикация обычного поста');

    // Проверяем наличие изображения
    if (!content.imageUrl) {
      throw new Error('Для публикации в Instagram требуется изображение');
    }

    // Загружаем изображение
    const imageData = await downloadImage(content.imageUrl);
    
    // Формируем подпись поста
    const caption = formatInstagramCaption(content);

    // Публикуем через Instagram Private Service
    const result = await instagramPrivateService.publishPhoto(username, password, imageData, caption);

    console.log('[Instagram Direct] Результат публикации поста:', result.success ? 'Успех' : 'Ошибка');

    return result;

  } catch (error) {
    console.error('[Instagram Direct] Ошибка публикации поста:', error.message);
    
    return {
      success: false,
      status: 'failed',
      error: error.message,
      platform: 'instagram',
      publishedAt: new Date().toISOString()
    };
  }
}

/**
 * Публикация Instagram Stories
 */
async function publishInstagramStory(content, username, password) {
  try {
    console.log('[Instagram Direct] Публикация Instagram Stories');

    // Проверяем наличие изображения для Stories
    if (!content.imageUrl) {
      throw new Error('Для публикации Stories требуется изображение');
    }

    // Загружаем изображение
    const imageData = await downloadImage(content.imageUrl);
    
    // Извлекаем интерактивные элементы из метаданных Stories
    const interactive = extractInteractiveElements(content);

    // Публикуем через Instagram Private Service
    const result = await instagramPrivateService.publishStory(username, password, imageData, interactive);

    console.log('[Instagram Direct] Результат публикации Stories:', result.success ? 'Успех' : 'Ошибка');

    return result;

  } catch (error) {
    console.error('[Instagram Direct] Ошибка публикации Stories:', error.message);
    
    return {
      success: false,
      status: 'failed',
      error: error.message,
      platform: 'instagram_stories',
      publishedAt: new Date().toISOString()
    };
  }
}

/**
 * Загружает изображение по URL и возвращает base64
 */
async function downloadImage(imageUrl) {
  try {
    console.log(`[Instagram Direct] Загрузка изображения: ${imageUrl.substring(0, 100)}...`);

    // Если это уже base64 data URL, возвращаем как есть
    if (imageUrl.startsWith('data:image/')) {
      console.log('[Instagram Direct] Изображение уже в формате base64');
      return imageUrl;
    }

    // Если это локальный файл
    if (imageUrl.startsWith('/') || imageUrl.startsWith('./')) {
      const fs = require('fs');
      const path = require('path');
      
      const fullPath = path.resolve(imageUrl);
      if (fs.existsSync(fullPath)) {
        const imageBuffer = fs.readFileSync(fullPath);
        const base64 = imageBuffer.toString('base64');
        console.log(`[Instagram Direct] Локальный файл загружен: ${imageBuffer.length} байт`);
        return `data:image/jpeg;base64,${base64}`;
      }
    }

    // Загружаем по HTTP URL
    const axios = require('axios');
    
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 секунд
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const imageBuffer = Buffer.from(response.data);
    const base64 = imageBuffer.toString('base64');
    
    console.log(`[Instagram Direct] HTTP изображение загружено: ${imageBuffer.length} байт`);
    
    // Определяем MIME тип из заголовков
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;

  } catch (error) {
    console.error('[Instagram Direct] Ошибка загрузки изображения:', error.message);
    throw new Error(`Не удалось загрузить изображение: ${error.message}`);
  }
}

/**
 * Форматирует подпись для Instagram поста
 */
function formatInstagramCaption(content) {
  let caption = '';
  
  // Добавляем основной текст
  if (content.content) {
    caption += content.content;
  }
  
  // Добавляем хештеги из keywords
  if (content.keywords && Array.isArray(content.keywords)) {
    const hashtags = content.keywords
      .filter(keyword => keyword && keyword.trim())
      .map(keyword => {
        // Очищаем ключевое слово и делаем хештег
        const cleanKeyword = keyword.trim().replace(/[^а-яё\w\s]/gi, '').replace(/\s+/g, '');
        return cleanKeyword ? `#${cleanKeyword}` : '';
      })
      .filter(hashtag => hashtag)
      .slice(0, 20); // Instagram лимит на хештеги
    
    if (hashtags.length > 0) {
      caption += '\n\n' + hashtags.join(' ');
    }
  }
  
  // Обрезаем до лимита Instagram (2200 символов)
  if (caption.length > 2200) {
    caption = caption.substring(0, 2197) + '...';
  }
  
  return caption;
}

/**
 * Извлекает интерактивные элементы из метаданных Stories
 */
function extractInteractiveElements(content) {
  try {
    // Проверяем, есть ли метаданные Stories
    if (!content.metadata || !content.metadata.stories) {
      return null;
    }

    const storiesData = content.metadata.stories;
    const interactive = {};

    // Извлекаем опрос
    if (storiesData.poll) {
      interactive.poll = {
        question: storiesData.poll.question || 'Ваше мнение?',
        option1: storiesData.poll.option1 || 'Да',
        option2: storiesData.poll.option2 || 'Нет'
      };
    }

    // Извлекаем слайдер
    if (storiesData.slider) {
      interactive.slider = {
        question: storiesData.slider.question || 'Оцените',
        emoji: storiesData.slider.emoji || '❤️'
      };
    }

    // Извлекаем вопрос
    if (storiesData.question) {
      interactive.question = {
        text: storiesData.question.text || 'Задайте вопрос'
      };
    }

    return Object.keys(interactive).length > 0 ? interactive : null;

  } catch (error) {
    console.error('[Instagram Direct] Ошибка извлечения интерактивных элементов:', error.message);
    return null;
  }
}

/**
 * Проверка статуса Instagram аккаунта
 */
async function checkInstagramAccount(username, password) {
  try {
    return await instagramPrivateService.checkStatus(username, password);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  publishViaInstagramDirectAPI,
  publishInstagramPost,
  publishInstagramStory,
  checkInstagramAccount,
  downloadImage,
  formatInstagramCaption,
  extractInteractiveElements
};