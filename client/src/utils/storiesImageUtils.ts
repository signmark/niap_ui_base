// Утилиты для генерации изображений Stories
export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: string;
  backgroundColor: string;
  rotation?: number;
}

export interface StoryData {
  id?: string;
  title: string;
  textOverlays: TextOverlay[];
  backgroundImageUrl?: string | null;
  image_url?: string | null;
}

export const generateStoriesImage = async (story: StoryData): Promise<string> => {
  console.log('[GENERATE-STORIES-IMAGE] Начинаем генерацию изображения для story:', story);
  
  try {
    // Создаем canvas в браузере - ТОЧНО КАК В РЕДАКТОРЕ
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Не удалось создать контекст canvas');
    }

    // Размер как в редакторе для качества
    const width = 540;   // Средний размер для хорошего качества
    const height = 960;  // Соотношение 9:16 для Instagram Stories
    canvas.width = width;
    canvas.height = height;
    
    console.log('[GENERATE-STORIES-IMAGE] Canvas создан:', { width, height });

    // Заливаем фон - СНАЧАЛА ФОН КАК В РЕДАКТОРЕ
    if (story.backgroundImageUrl || story.image_url) {
      try {
        const imageUrl = story.backgroundImageUrl || story.image_url;
        if (!imageUrl) {
          throw new Error('No background image URL');
        }
        
        console.log('[GENERATE-STORIES-IMAGE] Загружаем фоновое изображение:', imageUrl);
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Используем прокси для всех внешних изображений (включая Beget S3 - у него нет CORS)
        let proxyUrl = imageUrl;
        const isSameDomain = imageUrl.includes(window.location.hostname);
        
        if (imageUrl.startsWith('http') && !isSameDomain) {
          proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
          console.log('[GENERATE-STORIES-IMAGE] Используем прокси для внешнего изображения:', proxyUrl);
        } else {
          console.log('[GENERATE-STORIES-IMAGE] Загружаем изображение напрямую (тот же домен):', imageUrl);
        }
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            console.log('[GENERATE-STORIES-IMAGE] Изображение загружено успешно');
            resolve();
          };
          img.onerror = (error) => {
            console.error('[GENERATE-STORIES-IMAGE] Ошибка загрузки изображения:', error);
            reject(error);
          };
          img.src = proxyUrl;
        });
        
        // Масштабируем изображение чтобы покрыть весь canvas - КАК В РЕДАКТОРЕ
        const scale = Math.max(width / img.width, height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (width - scaledWidth) / 2;
        const y = (height - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        console.log('[GENERATE-STORIES-IMAGE] Изображение нарисовано на canvas');
      } catch (error) {
        console.warn('[GENERATE-STORIES-IMAGE] Ошибка загрузки фонового изображения, используем градиент:', error);
        // Градиентный фон как fallback
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      console.log('[GENERATE-STORIES-IMAGE] Используем градиентный фон по умолчанию');
      // Градиентный фон по умолчанию
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Добавляем текстовые элементы - КАК В РЕДАКТОРЕ
    console.log('[GENERATE-STORIES-IMAGE] Рисуем текстовые элементы:', story.textOverlays);
    
    if (story.textOverlays && story.textOverlays.length > 0) {
      for (const overlay of story.textOverlays) {
        console.log('[GENERATE-STORIES-IMAGE] Обрабатываем overlay:', overlay);
        
        // Масштабируем координаты под новый размер canvas - КАК В РЕДАКТОРЕ
        // Превью: 280x497 -> Canvas: 540x960
        const scaleX = width / 280;  // Масштабирование по X: 540/280 = 1.93
        const scaleY = height / 497; // Масштабирование по Y: 960/497 = 1.93
        const textPaddingX = overlay.backgroundColor !== 'transparent' ? 8 * scaleX : 2 * scaleX;
        // Применяем тот же коэффициент 0.8 что и в превью
        const x = (overlay.x !== undefined ? overlay.x : 50) * 0.8 * scaleX + textPaddingX;
        const y = (overlay.y !== undefined ? overlay.y : 50) * 0.8 * scaleY;
        
        const fontSize = (overlay.fontSize || 24) * scaleX;
        
        ctx.save();
        
        // Поворот текста
        if (overlay.rotation) {
          ctx.translate(x, y);
          ctx.rotate((overlay.rotation * Math.PI) / 180);
          ctx.translate(-x, -y);
        }
        
        // Фон для текста (если не прозрачный) - КАК В РЕДАКТОРЕ
        if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
          ctx.font = `${overlay.fontWeight || 'bold'} ${fontSize}px ${overlay.fontFamily || 'Arial'}`;
          const textMetrics = ctx.measureText(overlay.text || 'Текст');
          const textWidth = textMetrics.width;
          const textHeight = fontSize;
          
          ctx.fillStyle = overlay.backgroundColor;
          ctx.fillRect(
            x - 8 * scaleX,                    // Масштабированный отступ слева
            y - 4 * scaleY,                    // Масштабированный отступ сверху (как в StoriesImageGenerator)
            textWidth + 16 * scaleX,           // Масштабированная ширина фона
            textHeight + 8 * scaleY            // Масштабированная высота фона (как в StoriesImageGenerator)
          );
        }
        
        // Настройки текста - КАК В РЕДАКТОРЕ
        ctx.font = `${overlay.fontWeight || 'bold'} ${fontSize}px ${overlay.fontFamily || 'Arial'}`;
        ctx.fillStyle = overlay.color || '#ffffff';
        ctx.textAlign = 'left';    // Текст начинается С координаты, не центрируется
        ctx.textBaseline = 'top';   // Текст начинается СВЕРХУ координаты
        
        // Добавляем тень для лучшей читаемости
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4 * scaleX;
        ctx.shadowOffsetX = 2 * scaleX;
        ctx.shadowOffsetY = 2 * scaleY;
        
        // Рисуем текст
        ctx.fillText(overlay.text || 'Текст', x, y);
        
        ctx.restore();
      }
    }

    // Конвертируем в base64 с максимальным сжатием
    let base64Image = canvas.toDataURL('image/jpeg', 0.3); // Максимальное сжатие 30%
    
    // Если слишком большое, еще больше сжимаем
    if (base64Image.length > 100000) { // 100KB limit для ImgBB
      base64Image = canvas.toDataURL('image/jpeg', 0.1); // Экстремальное сжатие 10%
      console.log('[GENERATE-STORIES-IMAGE] Изображение максимально сжато до:', base64Image.length);
    }
    
    console.log('[GENERATE-STORIES-IMAGE] Изображение готово, размер base64:', base64Image.length);
    return base64Image;
    
  } catch (error) {
    console.error('[GENERATE-STORIES-IMAGE] Ошибка генерации:', error);
    throw error;
  }
};

export const uploadImageToImgbb = async (base64Image: string, title: string = 'story'): Promise<string> => {
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Токен авторизации не найден');
    }

    // Удаляем префикс data:image/png;base64, из base64 строки
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const response = await fetch('/api/imgbb/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64Data,
        name: `story-${Date.now()}.jpg`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data?.url) {
      console.log('[STORIES-IMAGE-UPLOAD] Изображение загружено:', result.data.url);
      return result.data.url;
    } else {
      throw new Error(result.error || 'Ошибка загрузки изображения');
    }
    
  } catch (error) {
    console.error('[STORIES-IMAGE-UPLOAD] Ошибка загрузки:', error);
    throw error;
  }
};