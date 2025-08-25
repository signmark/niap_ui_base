import { generateStoriesImage, uploadImageToImgbb } from './storiesImageUtils';
import { generateStoriesVideo, uploadVideoToS3 } from './storiesVideoUtils';

export interface PublishWithImageGenerationOptions {
  contentId: string;
  platforms: string[];
  story: any;
}

export const publishWithImageGeneration = async (options: PublishWithImageGenerationOptions): Promise<any> => {
  const { contentId, platforms, story } = options;
  
  console.log('[PUBLISH-WITH-IMAGE] Начинаем публикацию с генерацией изображения:', { contentId, platforms, story });
  console.log('[PUBLISH-WITH-IMAGE] Story object keys:', Object.keys(story));
  console.log('[PUBLISH-WITH-IMAGE] Story metadata:', story.metadata);
  
  // Парсим metadata для получения textOverlays
  let textOverlays = story.textOverlays;
  if (!textOverlays && story.metadata) {
    try {
      const metadata = typeof story.metadata === 'string' ? JSON.parse(story.metadata) : story.metadata;
      textOverlays = metadata.textOverlays;
      console.log('[PUBLISH-WITH-IMAGE] Извлечены textOverlays из metadata:', textOverlays);
    } catch (e) {
      console.log('[PUBLISH-WITH-IMAGE] Ошибка парсинга metadata:', e);
    }
  }
  
  console.log('[PUBLISH-WITH-IMAGE] Final textOverlays:', textOverlays);
  console.log('[PUBLISH-WITH-IMAGE] textOverlays length:', textOverlays?.length);
  
  try {
    // Step 1: Generate media (image or video) if story has text overlays
    let generatedImageUrl = null;
    let generatedVideoUrl = null;
    
    if (textOverlays && textOverlays.length > 0) {
      console.log('[PUBLISH-WITH-MEDIA] Найдены textOverlays, проверяем тип медиа:', story.mediaType || 'image');
      
      const isVideo = story.mediaType === 'video' && story.backgroundVideoUrl;
      
      // Сначала проверяем, есть ли уже сгенерированный контент в additional_media
      if (story.additional_media) {
        try {
          const additionalMedia = typeof story.additional_media === 'string' ? 
            JSON.parse(story.additional_media) : story.additional_media;
          
          if (isVideo) {
            const generatedVideo = additionalMedia.find((media: any) => media.type === 'generated_video');
            if (generatedVideo && generatedVideo.url) {
              console.log('[PUBLISH-WITH-MEDIA] Используем ранее сгенерированное видео:', generatedVideo.url);
              generatedVideoUrl = generatedVideo.url;
            }
          } else {
            const generatedImage = additionalMedia.find((media: any) => media.type === 'generated_image');
            if (generatedImage && generatedImage.url) {
              console.log('[PUBLISH-WITH-MEDIA] Используем ранее сгенерированное изображение:', generatedImage.url);
              generatedImageUrl = generatedImage.url;
            }
          }
        } catch (e) {
          console.log('[PUBLISH-WITH-MEDIA] Ошибка парсинга additional_media:', e);
        }
      }
      
      // Если нет готового контента, генерируем новый
      if (isVideo && !generatedVideoUrl) {
        console.log('[PUBLISH-WITH-MEDIA] Генерируем новое видео с текстом...');
        
        // Создаем объект story с textOverlays для генерации видео
        const storyForVideoGeneration = {
          backgroundVideoUrl: story.backgroundVideoUrl,
          textOverlays
        };
        
        console.log('[PUBLISH-WITH-MEDIA] Story для генерации видео:', storyForVideoGeneration);
        
        // Generate video with text overlays
        const processedVideoUrl = await generateStoriesVideo(storyForVideoGeneration);
        console.log('[PUBLISH-WITH-MEDIA] Видео обработано:', processedVideoUrl);
        
        // Upload to S3
        console.log('[PUBLISH-WITH-MEDIA] Загружаем видео в S3...');
        generatedVideoUrl = await uploadVideoToS3(processedVideoUrl);
        
        console.log('[PUBLISH-WITH-MEDIA] Видео загружено в S3:', generatedVideoUrl);
        
      } else if (!isVideo && !generatedImageUrl) {
        console.log('[PUBLISH-WITH-MEDIA] Генерируем новое изображение...');
        
        // Создаем объект story с textOverlays для генерации изображения
        const storyForGeneration = {
          ...story,
          textOverlays
        };
        
        console.log('[PUBLISH-WITH-MEDIA] Story для генерации изображения:', storyForGeneration);
        
        // Generate image using canvas
        const base64Image = await generateStoriesImage(storyForGeneration);
        console.log('[PUBLISH-WITH-MEDIA] Изображение сгенерировано, размер base64:', base64Image.length);
        
        // Upload to ImgBB
        console.log('[PUBLISH-WITH-MEDIA] Загружаем изображение на ImgBB...');
        generatedImageUrl = await uploadImageToImgbb(base64Image, story.title || 'Generated Story');
        
        console.log('[PUBLISH-WITH-MEDIA] Изображение загружено:', generatedImageUrl);
      }
      
      // Step 2: Update story with generated media URL in additional_media
      const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (authToken && (generatedImageUrl || generatedVideoUrl)) {
        try {
          const additionalMedia = [];
          
          if (generatedImageUrl) {
            additionalMedia.push({
              type: 'generated_image',
              url: generatedImageUrl,
              generated_at: new Date().toISOString(),
              purpose: 'stories_publication'
            });
          }
          
          if (generatedVideoUrl) {
            additionalMedia.push({
              type: 'generated_video',
              url: generatedVideoUrl,
              generated_at: new Date().toISOString(),
              purpose: 'stories_publication'
            });
          }
          
          await fetch(`/api/stories/simple/${contentId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              additional_media: JSON.stringify(additionalMedia)
            })
          });
          
          console.log('[PUBLISH-WITH-MEDIA] additional_media обновлено');
        } catch (updateError) {
          console.warn('[PUBLISH-WITH-MEDIA] Не удалось обновить additional_media:', updateError);
        }
      }
    } else {
      console.log('[PUBLISH-WITH-IMAGE] Нет textOverlays для генерации изображения');
      console.log('[PUBLISH-WITH-IMAGE] story.textOverlays:', story.textOverlays);
      console.log('[PUBLISH-WITH-IMAGE] parsed textOverlays:', textOverlays);
    }
    
    // Step 3: Proceed with normal publication  
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!authToken) {
      throw new Error('Токен авторизации не найден');
    }
    
    console.log('[PUBLISH-WITH-MEDIA] Отправляем на публикацию с generatedImageUrl:', generatedImageUrl);
    console.log('[PUBLISH-WITH-MEDIA] Отправляем на публикацию с generatedVideoUrl:', generatedVideoUrl);
    
    const publishResponse = await fetch('/api/stories/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        contentId,
        platforms,
        generatedImageUrl,
        generatedVideoUrl,
        useGeneratedImage: !!generatedImageUrl,
        useGeneratedVideo: !!generatedVideoUrl,
        mediaType: story.mediaType || 'image'
      })
    });
    
    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      throw new Error(`Ошибка публикации: ${publishResponse.status} ${publishResponse.statusText} - ${errorText}`);
    }
    
    const publishResult = await publishResponse.json();
    
    console.log('[PUBLISH-WITH-IMAGE] Результат публикации:', publishResult);
    
    return {
      ...publishResult,
      generatedImageUrl,
      generatedVideoUrl,
      imageGenerated: !!generatedImageUrl,
      videoGenerated: !!generatedVideoUrl,
      mediaType: story.mediaType || 'image'
    };
    
  } catch (error) {
    console.error('[PUBLISH-WITH-IMAGE] Ошибка:', error);
    throw error;
  }
};