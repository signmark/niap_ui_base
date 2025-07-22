const sharp = require('sharp');
const axios = require('axios');

class ImageSearchService {
  constructor() {
    // Unsplash API (не требует ключа для базового доступа)
    this.unsplashBaseUrl = 'https://source.unsplash.com';
    
    // Backup URLs для разных тем
    this.backupUrls = {
      business: 'https://source.unsplash.com/1080x1080/?business',
      technology: 'https://source.unsplash.com/1080x1080/?technology',
      marketing: 'https://source.unsplash.com/1080x1080/?marketing',
      social: 'https://source.unsplash.com/1080x1080/?social',
      nature: 'https://source.unsplash.com/1080x1080/?nature',
      lifestyle: 'https://source.unsplash.com/1080x1080/?lifestyle',
      food: 'https://source.unsplash.com/1080x1080/?food',
      travel: 'https://source.unsplash.com/1080x1080/?travel',
      fitness: 'https://source.unsplash.com/1080x1080/?fitness',
      fashion: 'https://source.unsplash.com/1080x1080/?fashion'
    };
  }

  /**
   * Извлекает ключевые слова из контента для поиска изображений
   */
  extractKeywords(content) {
    console.log('[Image Search] Анализируем контент для извлечения ключевых слов');
    
    // Простое извлечение ключевых слов из контента
    const russianKeywords = {
      'бизнес': 'business',
      'технологии': 'technology', 
      'маркетинг': 'marketing',
      'соцсети': 'social',
      'природа': 'nature',
      'стиль': 'lifestyle',
      'еда': 'food',
      'путешествия': 'travel',
      'фитнес': 'fitness',
      'мода': 'fashion',
      'дизайн': 'design',
      'искусство': 'art',
      'музыка': 'music',
      'спорт': 'sport',
      'здоровье': 'health'
    };

    const lowerContent = content.toLowerCase();
    
    // Ищем русские ключевые слова и переводим их в английские
    for (const [russian, english] of Object.entries(russianKeywords)) {
      if (lowerContent.includes(russian)) {
        console.log(`[Image Search] Найдено ключевое слово: ${russian} -> ${english}`);
        return english;
      }
    }

    // Ищем хэштеги
    const hashtags = content.match(/#[\w]+/g);
    if (hashtags && hashtags.length > 0) {
      const hashtag = hashtags[0].replace('#', '').toLowerCase();
      console.log(`[Image Search] Используем хэштег: ${hashtag}`);
      return hashtag;
    }

    // По умолчанию используем business
    console.log('[Image Search] Используем тему по умолчанию: business');
    return 'business';
  }

  /**
   * Получает URL изображения на основе контента
   */
  async getImageUrl(content, keywords = []) {
    try {
      console.log('[Image Search] Поиск подходящего изображения...');
      
      // Извлекаем ключевые слова из контента
      let searchTerm = this.extractKeywords(content);
      
      // Если есть переданные ключевые слова, используем первое подходящее
      if (keywords && keywords.length > 0) {
        const keyword = keywords[0].toLowerCase();
        if (this.backupUrls[keyword]) {
          searchTerm = keyword;
        }
      }

      // Создаем URL для поиска изображения
      const imageUrl = `${this.unsplashBaseUrl}/1080x1080/?${searchTerm}&${Date.now()}`;
      
      console.log(`[Image Search] Сгенерирован URL: ${imageUrl}`);
      
      // Проверяем доступность изображения
      const response = await axios.head(imageUrl, { 
        timeout: 10000,
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        console.log('[Image Search] ✅ Изображение найдено и доступно');
        return imageUrl;
      }
      
      throw new Error('Изображение недоступно');
      
    } catch (error) {
      console.log(`[Image Search] ⚠️ Ошибка поиска: ${error.message}`);
      
      // Используем резервное изображение
      const fallbackUrl = this.backupUrls.business;
      console.log(`[Image Search] Используем резервное изображение: ${fallbackUrl}`);
      return fallbackUrl;
    }
  }

  /**
   * Загружает и сжимает изображение
   */
  async downloadAndCompressImage(imageUrl, maxSize = 300000) { // 300KB max
    try {
      console.log(`[Image Search] Загружаем изображение: ${imageUrl}`);
      
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024, // 5MB max
      });
      
      console.log(`[Image Search] Изображение загружено: ${response.data.length} байт`);
      
      // Сжимаем изображение с помощью Sharp
      let quality = 80;
      let compressedBuffer;
      
      do {
        compressedBuffer = await sharp(response.data)
          .resize(1080, 1080, { 
            fit: 'cover',
            position: 'center' 
          })
          .jpeg({ 
            quality: quality,
            progressive: true,
            mozjpeg: true 
          })
          .toBuffer();
          
        console.log(`[Image Search] Сжато с качеством ${quality}: ${compressedBuffer.length} байт`);
        
        if (compressedBuffer.length <= maxSize) {
          break;
        }
        
        quality -= 10;
        
      } while (quality >= 20);
      
      if (compressedBuffer.length > maxSize) {
        // Дополнительное сжатие до 800x800
        compressedBuffer = await sharp(response.data)
          .resize(800, 800, { 
            fit: 'cover',
            position: 'center' 
          })
          .jpeg({ 
            quality: 60,
            progressive: true,
            mozjpeg: true 
          })
          .toBuffer();
          
        console.log(`[Image Search] Дополнительное сжатие до 800x800: ${compressedBuffer.length} байт`);
      }
      
      console.log(`[Image Search] ✅ Финальный размер: ${compressedBuffer.length} байт`);
      return compressedBuffer;
      
    } catch (error) {
      console.log(`[Image Search] ❌ Ошибка загрузки/сжатия: ${error.message}`);
      
      // Создаем простое цветное изображение как fallback
      const fallbackImage = await sharp({
        create: {
          width: 1080,
          height: 1080,
          channels: 3,
          background: { r: 70, g: 130, b: 180 } // Стальной синий цвет
        }
      })
      .png()
      .toBuffer();
      
      console.log(`[Image Search] Создано резервное изображение: ${fallbackImage.length} байт`);
      return fallbackImage;
    }
  }

  /**
   * Полный цикл: поиск + загрузка + сжатие
   */
  async findAndPrepareImage(content, keywords = []) {
    try {
      console.log('[Image Search] 🔍 Начинаем полный цикл обработки изображения');
      
      // Шаг 1: Получаем URL изображения
      const imageUrl = await this.getImageUrl(content, keywords);
      
      // Шаг 2: Загружаем и сжимаем
      const compressedImage = await this.downloadAndCompressImage(imageUrl);
      
      // Шаг 3: Возвращаем готовые данные
      return {
        success: true,
        imageBuffer: compressedImage,
        originalUrl: imageUrl,
        size: compressedImage.length
      };
      
    } catch (error) {
      console.log(`[Image Search] ❌ Критическая ошибка: ${error.message}`);
      
      // Возвращаем минимальное изображение в случае полного провала
      const minimalImage = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r: 100, g: 100, b: 100 }
        }
      })
      .png()
      .toBuffer();
      
      return {
        success: false,
        imageBuffer: minimalImage,
        originalUrl: null,
        size: minimalImage.length,
        error: error.message
      };
    }
  }
}

module.exports = new ImageSearchService();