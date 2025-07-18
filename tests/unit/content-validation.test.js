/**
 * Тесты валидации контента - критично для качества публикаций
 */

describe('Content Validation Tests', () => {
  test('должен валидировать контент по типам', () => {
    function validateContentByType(content, contentType) {
      const errors = [];
      
      if (!content || typeof content !== 'object') {
        errors.push('Контент должен быть объектом');
        return { isValid: false, errors };
      }
      
      // Базовая валидация для всех типов
      if (!content.content || content.content.trim().length === 0) {
        errors.push('Текст контента обязателен');
      }
      
      switch (contentType) {
        case 'text':
          if (content.content && content.content.length > 2000) {
            errors.push('Текстовый пост не должен превышать 2000 символов');
          }
          break;
          
        case 'text_with_image':
          if (!content.imageUrl) {
            errors.push('Для контента с изображением требуется imageUrl');
          }
          if (content.content && content.content.length > 1500) {
            errors.push('Текст с изображением не должен превышать 1500 символов');
          }
          break;
          
        case 'video':
          if (!content.videoUrl) {
            errors.push('Для видео контента требуется videoUrl');
          }
          if (content.content && content.content.length > 500) {
            errors.push('Описание видео не должно превышать 500 символов');
          }
          // YouTube требует thumbnail
          if (content.platforms && content.platforms.includes('youtube') && !content.videoThumbnail) {
            errors.push('Для YouTube требуется thumbnail видео');
          }
          break;
          
        case 'stories':
          if (content.content && content.content.length > 200) {
            errors.push('Текст для Stories не должен превышать 200 символов');
          }
          if (!content.metadata || !content.metadata.slides) {
            errors.push('Для Stories требуются данные слайдов');
          }
          break;
          
        default:
          errors.push(`Неподдерживаемый тип контента: ${contentType}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // Валидный текстовый контент
    const validText = {
      content: 'Отличный пост о здоровье',
      contentType: 'text'
    };
    expect(validateContentByType(validText, 'text').isValid).toBe(true);

    // Валидный контент с изображением
    const validImageContent = {
      content: 'Пост с картинкой',
      imageUrl: 'https://example.com/image.jpg'
    };
    expect(validateContentByType(validImageContent, 'text_with_image').isValid).toBe(true);

    // Невалидный видео контент без URL
    const invalidVideo = {
      content: 'Описание видео'
    };
    const videoResult = validateContentByType(invalidVideo, 'video');
    expect(videoResult.isValid).toBe(false);
    expect(videoResult.errors).toContain('Для видео контента требуется videoUrl');

    // Stories без метаданных
    const invalidStories = {
      content: 'Текст для Stories'
    };
    const storiesResult = validateContentByType(invalidStories, 'stories');
    expect(storiesResult.isValid).toBe(false);
    expect(storiesResult.errors).toContain('Для Stories требуются данные слайдов');
  });

  test('должен валидировать требования платформ', () => {
    function validatePlatformRequirements(content, selectedPlatforms) {
      const errors = [];
      const warnings = [];
      
      const platformRequirements = {
        'youtube': {
          requiredFields: ['videoUrl'],
          recommendedFields: ['videoThumbnail'],
          contentTypes: ['video'],
          maxContentLength: 5000
        },
        'instagram': {
          requiredFields: ['imageUrl'],
          recommendedFields: [],
          contentTypes: ['text_with_image', 'stories'],
          maxContentLength: 2200
        },
        'vk': {
          requiredFields: [],
          recommendedFields: ['imageUrl'],
          contentTypes: ['text', 'text_with_image', 'video'],
          maxContentLength: 65000
        },
        'facebook': {
          requiredFields: [],
          recommendedFields: ['imageUrl'],
          contentTypes: ['text', 'text_with_image', 'video'],
          maxContentLength: 63206
        },
        'telegram': {
          requiredFields: [],
          recommendedFields: [],
          contentTypes: ['text', 'text_with_image', 'video'],
          maxContentLength: 4096
        }
      };
      
      selectedPlatforms.forEach(platform => {
        const requirements = platformRequirements[platform];
        if (!requirements) {
          errors.push(`Неподдерживаемая платформа: ${platform}`);
          return;
        }
        
        // Проверяем поддержку типа контента
        if (!requirements.contentTypes.includes(content.contentType)) {
          errors.push(`${platform} не поддерживает тип контента ${content.contentType}`);
        }
        
        // Проверяем обязательные поля
        requirements.requiredFields.forEach(field => {
          if (!content[field]) {
            errors.push(`${platform} требует поле ${field}`);
          }
        });
        
        // Проверяем рекомендованные поля
        requirements.recommendedFields.forEach(field => {
          if (!content[field]) {
            warnings.push(`${platform} рекомендует поле ${field} для лучшего качества`);
          }
        });
        
        // Проверяем длину контента
        if (content.content && content.content.length > requirements.maxContentLength) {
          errors.push(`Контент слишком длинный для ${platform} (макс. ${requirements.maxContentLength} символов)`);
        }
      });
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    }

    const videoContent = {
      content: 'Описание видео',
      contentType: 'video',
      videoUrl: 'https://example.com/video.mp4',
      videoThumbnail: 'https://example.com/thumb.jpg'
    };

    // YouTube с видео - должно пройти
    const youtubeResult = validatePlatformRequirements(videoContent, ['youtube']);
    expect(youtubeResult.isValid).toBe(true);

    // Instagram с видео - должно не пройти
    const instagramVideoResult = validatePlatformRequirements(videoContent, ['instagram']);
    expect(instagramVideoResult.isValid).toBe(false);
    expect(instagramVideoResult.errors).toContain('instagram не поддерживает тип контента video');

    // VK без изображения - должно пройти с предупреждением
    const textContent = {
      content: 'Простой текст',
      contentType: 'text'
    };
    const vkResult = validatePlatformRequirements(textContent, ['vk']);
    expect(vkResult.isValid).toBe(true);
    expect(vkResult.warnings).toContain('vk рекомендует поле imageUrl для лучшего качества');
  });

  test('должен очищать и форматировать контент', () => {
    function sanitizeContent(content, platform) {
      let sanitized = { ...content };
      
      // Очищаем HTML теги
      if (sanitized.content) {
        sanitized.content = sanitized.content
          .replace(/<[^>]+>/g, '') // Удаляем HTML теги
          .replace(/&nbsp;/g, ' ') // Заменяем неразрывные пробелы
          .replace(/&amp;/g, '&') // Декодируем HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
      }
      
      // Платформо-специфичная обработка
      switch (platform) {
        case 'telegram':
          // Telegram поддерживает Markdown
          break;
          
        case 'vk':
          // VK поддерживает ограниченную разметку
          if (sanitized.content) {
            sanitized.content = sanitized.content.replace(/\*\*(.*?)\*\*/g, '$1'); // Убираем жирный текст
          }
          break;
          
        case 'instagram':
          // Instagram требует хештеги в конце
          if (sanitized.content && sanitized.hashtags) {
            sanitized.content = `${sanitized.content}\n\n${sanitized.hashtags}`;
          }
          break;
          
        case 'youtube':
          // YouTube поддерживает временные метки
          break;
      }
      
      return sanitized;
    }

    const htmlContent = {
      content: '<p>Привет <strong>мир</strong>!</p>&nbsp;Тест&amp;проверка',
      hashtags: '#тест #контент'
    };

    // Общая очистка
    const cleaned = sanitizeContent(htmlContent, 'vk');
    expect(cleaned.content).toBe('Привет мир! Тест&проверка');
    expect(cleaned.content).not.toContain('<p>');
    expect(cleaned.content).not.toContain('&nbsp;');

    // Instagram специфичная обработка
    const instagramCleaned = sanitizeContent(htmlContent, 'instagram');
    expect(instagramCleaned.content).toContain('#тест #контент');
  });

  test('должен проверять медиа файлы', () => {
    function validateMediaFiles(content) {
      const errors = [];
      const warnings = [];
      
      // Проверяем изображения
      if (content.imageUrl) {
        const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const hasValidExtension = validImageExtensions.some(ext => 
          content.imageUrl.toLowerCase().includes(ext)
        );
        
        if (!hasValidExtension) {
          warnings.push('Изображение может не поддерживаться всеми платформами');
        }
        
        // Проверяем что это URL
        if (!content.imageUrl.startsWith('http')) {
          errors.push('imageUrl должен быть полным URL');
        }
      }
      
      // Проверяем видео
      if (content.videoUrl) {
        const validVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
        const hasValidExtension = validVideoExtensions.some(ext => 
          content.videoUrl.toLowerCase().includes(ext)
        );
        
        if (!hasValidExtension) {
          warnings.push('Видео может не поддерживаться всеми платформами');
        }
        
        if (!content.videoUrl.startsWith('http')) {
          errors.push('videoUrl должен быть полным URL');
        }
        
        // Проверяем thumbnail для видео
        if (!content.videoThumbnail) {
          warnings.push('Рекомендуется добавить thumbnail для видео');
        }
      }
      
      // Проверяем дополнительные изображения для Stories
      if (content.additional_images && Array.isArray(content.additional_images)) {
        content.additional_images.forEach((url, index) => {
          if (!url.startsWith('http')) {
            errors.push(`additional_images[${index}] должен быть полным URL`);
          }
        });
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    }

    // Валидное изображение
    const validImage = {
      imageUrl: 'https://example.com/image.jpg'
    };
    expect(validateMediaFiles(validImage).isValid).toBe(true);

    // Невалидный URL изображения
    const invalidImage = {
      imageUrl: 'local-file.jpg'
    };
    const imageResult = validateMediaFiles(invalidImage);
    expect(imageResult.isValid).toBe(false);
    expect(imageResult.errors).toContain('imageUrl должен быть полным URL');

    // Видео без thumbnail
    const videoWithoutThumb = {
      videoUrl: 'https://example.com/video.mp4'
    };
    const videoResult = validateMediaFiles(videoWithoutThumb);
    expect(videoResult.isValid).toBe(true);
    expect(videoResult.warnings).toContain('Рекомендуется добавить thumbnail для видео');
  });

  test('должен валидировать метаданные Stories', () => {
    function validateStoriesMetadata(metadata) {
      const errors = [];
      
      if (!metadata || typeof metadata !== 'object') {
        errors.push('Метаданные Stories обязательны');
        return { isValid: false, errors };
      }
      
      // Проверяем слайды
      if (!metadata.slides || !Array.isArray(metadata.slides)) {
        errors.push('Stories должны содержать массив слайдов');
      } else {
        if (metadata.slides.length === 0) {
          errors.push('Stories должны содержать минимум 1 слайд');
        }
        
        if (metadata.slides.length > 10) {
          errors.push('Stories не могут содержать более 10 слайдов');
        }
        
        // Проверяем каждый слайд
        metadata.slides.forEach((slide, index) => {
          if (!slide.id) {
            errors.push(`Слайд ${index + 1} должен иметь ID`);
          }
          
          if (!slide.elements || !Array.isArray(slide.elements)) {
            errors.push(`Слайд ${index + 1} должен содержать массив элементов`);
          }
          
          // Проверяем элементы слайда
          if (slide.elements) {
            slide.elements.forEach((element, elemIndex) => {
              if (!element.id || !element.type) {
                errors.push(`Элемент ${elemIndex + 1} слайда ${index + 1} должен иметь ID и тип`);
              }
              
              if (!['text', 'image', 'video', 'sticker'].includes(element.type)) {
                errors.push(`Неподдерживаемый тип элемента: ${element.type}`);
              }
              
              if (element.type === 'text' && !element.content) {
                errors.push(`Текстовый элемент должен иметь контент`);
              }
            });
          }
        });
      }
      
      // Проверяем настройки Stories
      if (metadata.storySettings) {
        if (metadata.storySettings.duration && 
            (metadata.storySettings.duration < 1000 || metadata.storySettings.duration > 15000)) {
          errors.push('Длительность слайда должна быть от 1 до 15 секунд');
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // Валидные метаданные Stories
    const validMetadata = {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'element-1',
              type: 'text',
              content: 'Привет!',
              position: { x: 100, y: 100 }
            }
          ]
        }
      ],
      storySettings: {
        duration: 5000,
        transitions: 'fade'
      }
    };
    expect(validateStoriesMetadata(validMetadata).isValid).toBe(true);

    // Пустые метаданные
    const emptyMetadata = {};
    const emptyResult = validateStoriesMetadata(emptyMetadata);
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors).toContain('Stories должны содержать массив слайдов');

    // Слишком много слайдов
    const tooManySlides = {
      slides: Array(12).fill({ id: 'slide', elements: [] })
    };
    const tooManyResult = validateStoriesMetadata(tooManySlides);
    expect(tooManyResult.isValid).toBe(false);
    expect(tooManyResult.errors).toContain('Stories не могут содержать более 10 слайдов');
  });
});