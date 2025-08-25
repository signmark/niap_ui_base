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
  
  return new Promise((resolve, reject) => {
    try {
      // Создаем canvas в браузере
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Не удалось создать контекст canvas');
      }

      // Уменьшенные размеры для меньшего файла (сохраняем пропорции 9:16)
      const width = 540;  // Половина от 1080
      const height = 960; // Половина от 1920
      canvas.width = width;
      canvas.height = height;
      
      console.log('[GENERATE-STORIES-IMAGE] Canvas создан:', { width, height });

      const drawTextOverlays = () => {
        console.log('[GENERATE-STORIES-IMAGE] Рисуем текстовые элементы:', story.textOverlays);
        
        // Добавляем текстовые элементы
        if (story.textOverlays && story.textOverlays.length > 0) {
          for (const overlay of story.textOverlays) {
            console.log('[GENERATE-STORIES-IMAGE] Обрабатываем overlay:', overlay);
            // Масштабируем координаты с редактора (350x620) до финального размера (1080x1920)
            const scaleX = width / 350;
            const scaleY = height / 620;
            
            const x = (overlay.x || 50) * scaleX;
            const y = (overlay.y || 50) * scaleY;
            const fontSize = (overlay.fontSize || 24) * scaleY;
            
            ctx.save();
            
            // Поворот текста
            if (overlay.rotation) {
              ctx.translate(x, y);
              ctx.rotate((overlay.rotation * Math.PI) / 180);
              ctx.translate(-x, -y);
            }
            
            // Фон для текста (если не прозрачный)
            if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
              ctx.font = `${overlay.fontWeight || 'bold'} ${fontSize}px ${overlay.fontFamily || 'Arial'}`;
              const textMetrics = ctx.measureText(overlay.text || 'Текст');
              const textWidth = textMetrics.width;
              const textHeight = fontSize;
              
              ctx.fillStyle = overlay.backgroundColor;
              ctx.fillRect(
                x - textWidth / 2 - 10,
                y - textHeight / 2 - 5,
                textWidth + 20,
                textHeight + 10
              );
            }
            
            // Настройки текста
            ctx.font = `${overlay.fontWeight || 'bold'} ${fontSize}px ${overlay.fontFamily || 'Arial'}`;
            ctx.fillStyle = overlay.color || '#ffffff';
            ctx.textAlign = overlay.textAlign as CanvasTextAlign || 'center';
            ctx.textBaseline = 'middle';
            
            // Добавляем тень для лучшей читаемости
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
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
        resolve(base64Image);
      };

      // Заливаем фон
      const backgroundUrl = story.backgroundImageUrl || story.image_url;
      if (backgroundUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            // Масштабируем изображение чтобы покрыть весь canvas
            const scale = Math.max(width / img.width, height / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (width - scaledWidth) / 2;
            const y = (height - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            drawTextOverlays();
          } catch (error) {
            console.warn('Ошибка отрисовки фонового изображения, используем градиент');
            // Градиентный фон как fallback
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            drawTextOverlays();
          }
        };
        
        img.onerror = () => {
          console.warn('Ошибка загрузки фонового изображения, используем градиент');
          // Градиентный фон как fallback
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
          drawTextOverlays();
        };
        
        img.src = backgroundUrl;
      } else {
        // Градиентный фон по умолчанию
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        drawTextOverlays();
      }
      
    } catch (error) {
      reject(error);
    }
  });
};

export const uploadImageToImgbb = async (base64Image: string, title: string = 'story'): Promise<string> => {
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Токен авторизации не найден');
    }

    // Удаляем префикс data:image/png;base64, из base64 строки
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const response = await fetch('/api/imgur/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64Data,
        type: 'base64',
        title: `Generated Stories Image - ${title}`,
        description: `Auto-generated image for Stories: ${title}`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data?.link) {
      console.log('[STORIES-IMAGE-UPLOAD] Изображение загружено:', result.data.link);
      return result.data.link;
    } else {
      throw new Error(result.error || 'Ошибка загрузки изображения');
    }
    
  } catch (error) {
    console.error('[STORIES-IMAGE-UPLOAD] Ошибка загрузки:', error);
    throw error;
  }
};