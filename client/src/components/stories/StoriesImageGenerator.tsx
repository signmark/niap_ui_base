import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StoriesImageGeneratorProps {
  story: any;
  onImageGenerated?: (imageUrl: string) => void;
}

export const StoriesImageGenerator: React.FC<StoriesImageGeneratorProps> = ({ 
  story, 
  onImageGenerated 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const { toast } = useToast();

  const generateImage = async () => {
    console.log('[STORIES-IMAGE-GENERATOR] Начало генерации изображения');
    console.log('[STORIES-IMAGE-GENERATOR] Story:', story);
    console.log('[STORIES-IMAGE-GENERATOR] textOverlays:', story?.textOverlays);
    
    if (!story || !story.textOverlays?.length) {
      console.log('[STORIES-IMAGE-GENERATOR] Нет textOverlays для генерации');
      toast({
        title: "Ошибка",
        description: "Нет текстовых элементов для генерации",
        variant: "destructive"
      });
      return;
    }

    console.log('[STORIES-IMAGE-GENERATOR] Запускаем генерацию для', story.textOverlays.length, 'элементов');
    setIsGenerating(true);
    
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

      // Заливаем фон
      if (story.backgroundImageUrl || story.image_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = story.backgroundImageUrl || story.image_url;
          });
          
          // Масштабируем изображение чтобы покрыть весь canvas
          const scale = Math.max(width / img.width, height / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (width - scaledWidth) / 2;
          const y = (height - scaledHeight) / 2;
          
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        } catch (error) {
          console.warn('Ошибка загрузки фонового изображения, используем градиент');
          // Градиентный фон как fallback
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Градиентный фон по умолчанию
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      // Добавляем текстовые элементы
      for (const overlay of story.textOverlays) {
        // ПРАВИЛЬНАЯ ЛОГИКА: повторяем точно как в превью редактора
        // 1. Берем координаты из базы
        // 2. Умножаем на 0.8 (как в превью)  
        // 3. Масштабируем с размера превью (280x497) до canvas размера (540x960)
        
        console.log('[STORIES-IMAGE-GENERATOR] Исходные координаты из базы:', `x=${overlay.x}, y=${overlay.y}`);
        
        const PREVIEW_WIDTH = 280;
        const PREVIEW_HEIGHT = 497;
        
        // Используем координаты из превью с небольшой коррекцией X
        const previewX = (overlay.x || 50) * 0.8;
        const previewY = (overlay.y || 50) * 0.8;
        console.log('[STORIES-IMAGE-GENERATOR] Координаты в превью:', `x=${previewX}, y=${previewY}`);
        
        // Масштабируем с размера превью до canvas размера
        const scaleX = width / PREVIEW_WIDTH;   // 540/280 = 1.93
        const scaleY = height / PREVIEW_HEIGHT; // 960/497 = 1.93
        
        // Добавляем коррекцию X и Y для точного совпадения с редактором
        const x = (previewX + 60) * scaleX; // +60px компенсация отклонения влево
        const y = (previewY + 25) * scaleY; // +25px компенсация отклонения вниз
        
        const fontSize = (overlay.fontSize || 24) * scaleY;
        console.log('[STORIES-IMAGE-GENERATOR] Canvas размеры:', `width=${width}, height=${height}`);
        console.log('[STORIES-IMAGE-GENERATOR] Scale факторы:', `scaleX=${scaleX}, scaleY=${scaleY}`);
        
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

      // Конвертируем в base64 с максимальным сжатием для ImgBB
      let finalImage = canvas.toDataURL('image/jpeg', 0.3); // Максимальное сжатие 30%
      console.log('[STORIES-IMAGE-GENERATOR] Canvas создан, размер base64:', finalImage.length);
      
      // Если все еще большое, еще больше сжимаем
      if (finalImage.length > 100000) { // 100KB limit для ImgBB
        finalImage = canvas.toDataURL('image/jpeg', 0.1); // Экстремальное сжатие 10%
        console.log('[STORIES-IMAGE-GENERATOR] Изображение максимально сжато до:', finalImage.length);
      }
      
      // Загружаем на ImgBB и сохраняем в Stories
      try {
        console.log('[STORIES-IMAGE-GENERATOR] Загружаем на ImgBB...');
        const uploadResponse = await fetch('/api/imgbb/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            image: finalImage.split(',')[1], // убираем data:image/jpeg;base64,
            name: `story-${story.title || 'generated'}-${Date.now()}`
          })
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('[STORIES-IMAGE-GENERATOR] ImgBB response:', errorText);
          throw new Error(`ImgBB upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const imageUrl = uploadResult.data?.url;
        
        if (!imageUrl) {
          throw new Error('ImgBB не вернул URL изображения');
        }

        console.log('[STORIES-IMAGE-GENERATOR] Изображение загружено на ImgBB:', imageUrl);

        // Сохраняем сгенерированное изображение в additional_media Stories
        const additionalMedia = [{
          type: 'generated_image',
          url: imageUrl,
          generated_at: new Date().toISOString(),
          purpose: 'stories_publication'
        }];

        const updateResponse = await fetch(`/api/stories/simple/${story.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            additional_media: JSON.stringify(additionalMedia)
          })
        });

        if (updateResponse.ok) {
          console.log('[STORIES-IMAGE-GENERATOR] additional_media обновлено в Stories');
        }

        setGeneratedImage(imageUrl);
        onImageGenerated?.(imageUrl);
        
        toast({
          title: "Успешно",
          description: "Изображение сгенерировано и готово к публикации",
        });
      } catch (uploadError) {
        console.error('[STORIES-IMAGE-GENERATOR] Ошибка загрузки:', uploadError);
        
        // Показываем локальное изображение как fallback
        setGeneratedImage(finalImage);
        onImageGenerated?.(finalImage);
        
        toast({
          title: "Изображение создано локально",
          description: "Изображение готово, но не загружено на сервер. Попробуйте опубликовать.",
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error('[STORIES-IMAGE-GENERATOR] Ошибка генерации изображения:', error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : 'Произошла ошибка при генерации изображения',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `story-${story?.title || 'image'}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Скачивание",
      description: "Изображение сохранено",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={generateImage}
          disabled={isGenerating || !story?.textOverlays?.length}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {isGenerating ? 'Генерация...' : 'Сгенерировать изображение'}
        </Button>
        
        {generatedImage && (
          <Button
            onClick={downloadImage}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Скачать
          </Button>
        )}
      </div>

      {!story?.textOverlays?.length && (
        <p className="text-sm text-muted-foreground">
          Добавьте текстовые элементы для генерации изображения
        </p>
      )}

      {generatedImage && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Сгенерированное изображение:</h4>
          <div className="flex justify-center">
            <img 
              src={generatedImage} 
              alt="Сгенерированное изображение Stories"
              className="max-w-full h-auto max-h-96 rounded-lg shadow-lg"
              style={{ aspectRatio: '9/16' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};