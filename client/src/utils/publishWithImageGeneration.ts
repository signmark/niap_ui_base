import { generateStoriesImage, uploadImageToImgbb } from './storiesImageUtils';

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
    // Step 1: Generate image if story has text overlays
    let generatedImageUrl = null;
    
    if (textOverlays && textOverlays.length > 0) {
      console.log('[PUBLISH-WITH-IMAGE] Найдены textOverlays, проверяем additional_media...');
      
      // Сначала проверяем, есть ли уже сгенерированное изображение в additional_media
      if (story.additional_media) {
        try {
          const additionalMedia = typeof story.additional_media === 'string' ? 
            JSON.parse(story.additional_media) : story.additional_media;
          
          const generatedImage = additionalMedia.find((media: any) => media.type === 'generated_image');
          if (generatedImage && generatedImage.url) {
            console.log('[PUBLISH-WITH-IMAGE] Используем ранее сгенерированное изображение:', generatedImage.url);
            generatedImageUrl = generatedImage.url;
          }
        } catch (e) {
          console.log('[PUBLISH-WITH-IMAGE] Ошибка парсинга additional_media:', e);
        }
      }
      
      // Если нет готового изображения, генерируем новое
      if (!generatedImageUrl) {
        console.log('[PUBLISH-WITH-IMAGE] Генерируем новое изображение...');
        
        // Создаем объект story с textOverlays для генерации
        const storyForGeneration = {
          ...story,
          textOverlays
        };
        
        console.log('[PUBLISH-WITH-IMAGE] Story для генерации:', storyForGeneration);
        
        // Generate image using canvas
        const base64Image = await generateStoriesImage(storyForGeneration);
        console.log('[PUBLISH-WITH-IMAGE] Изображение сгенерировано, размер base64:', base64Image.length);
        
        // Upload to ImgBB
        console.log('[PUBLISH-WITH-IMAGE] Загружаем изображение на ImgBB...');
        generatedImageUrl = await uploadImageToImgbb(base64Image, story.title || 'Generated Story');
        
        console.log('[PUBLISH-WITH-IMAGE] Изображение загружено:', generatedImageUrl);
      }
      
      // Step 2: Update story with generated image URL in additional_media
      const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (authToken) {
        try {
          const additionalMedia = [{
            type: 'generated_image',
            url: generatedImageUrl,
            generated_at: new Date().toISOString(),
            purpose: 'stories_publication'
          }];
          
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
          
          console.log('[PUBLISH-WITH-IMAGE] additional_media обновлено');
        } catch (updateError) {
          console.warn('[PUBLISH-WITH-IMAGE] Не удалось обновить additional_media:', updateError);
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
    
    console.log('[PUBLISH-WITH-IMAGE] Отправляем на публикацию с generatedImageUrl:', generatedImageUrl);
    
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
        useGeneratedImage: !!generatedImageUrl
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
      imageGenerated: !!generatedImageUrl
    };
    
  } catch (error) {
    console.error('[PUBLISH-WITH-IMAGE] Ошибка:', error);
    throw error;
  }
};