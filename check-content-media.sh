#!/bin/bash

# Скрипт для проверки медиа-полей контента перед публикацией сторис
CONTENT_ID="244c9fbd-dfab-445c-bc5d-dff085eb482d"
API_URL="http://localhost:5000/api/test/media-check"
LOG_FILE="media_check_$(date +%Y%m%d_%H%M%S).log"

echo "===== ПРОВЕРКА МЕДИА-ПОЛЕЙ КОНТЕНТА =====" | tee -a "$LOG_FILE"
echo "Дата и время: $(date)" | tee -a "$LOG_FILE"
echo "Проверка контента ID: $CONTENT_ID" | tee -a "$LOG_FILE"
echo "Лог-файл: $LOG_FILE" | tee -a "$LOG_FILE"
echo "--------------------------------" | tee -a "$LOG_FILE"

# Сначала создадим временный endpoint для проверки
echo "
// Временный маршрут для проверки медиа-контента
app.post('/api/test/media-check', async (req: Request, res: Response) => {
  const { contentId } = req.body;

  if (!contentId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Необходимо указать contentId' 
    });
  }

  log(\`[Media Check] Проверка медиа-полей для контента: \${contentId}\`, 'media-check');

  try {
    // Получаем системный токен
    const systemToken = await getSystemToken();
    
    if (!systemToken) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить системный токен'
      });
    }

    // Получаем данные контента из Directus
    const content = await fetchContent(contentId, systemToken);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Не удалось найти контент'
      });
    }

    // Собираем все медиа-поля для анализа
    const mediaFields = {
      id: content.id,
      campaignId: content.campaignId,
      title: content.title?.substring(0, 50) + (content.title?.length > 50 ? '...' : ''),
      contentType: content.contentType,
      status: content.status,
      
      // Основные URL
      imageUrl: content.imageUrl,
      videoUrl: content.videoUrl,
      
      // Проверка AdditionalImages (camelCase)
      hasAdditionalImages: !!content.additionalImages,
      additionalImagesType: content.additionalImages ? typeof content.additionalImages : null,
      isAdditionalImagesArray: Array.isArray(content.additionalImages),
      additionalImagesLength: Array.isArray(content.additionalImages) ? content.additionalImages.length : 0,
      
      // Первые элементы AdditionalImages
      firstAdditionalImageItem: Array.isArray(content.additionalImages) && content.additionalImages.length > 0 
        ? {
            type: typeof content.additionalImages[0],
            isString: typeof content.additionalImages[0] === 'string',
            isObject: typeof content.additionalImages[0] === 'object',
            hasURL: typeof content.additionalImages[0] === 'object' && !!content.additionalImages[0]?.url,
            hasFile: typeof content.additionalImages[0] === 'object' && !!content.additionalImages[0]?.file,
            value: content.additionalImages[0]
          } 
        : null,
      
      // Проверка AdditionalMedia (camelCase)
      hasAdditionalMedia: !!content.additionalMedia,
      additionalMediaType: content.additionalMedia ? typeof content.additionalMedia : null,
      isAdditionalMediaArray: Array.isArray(content.additionalMedia),
      additionalMediaLength: Array.isArray(content.additionalMedia) ? content.additionalMedia.length : 0,
      
      // Первые элементы AdditionalMedia
      firstAdditionalMediaItem: Array.isArray(content.additionalMedia) && content.additionalMedia.length > 0 
        ? {
            type: typeof content.additionalMedia[0],
            isString: typeof content.additionalMedia[0] === 'string',
            isObject: typeof content.additionalMedia[0] === 'object',
            hasURL: typeof content.additionalMedia[0] === 'object' && !!content.additionalMedia[0]?.url,
            hasFile: typeof content.additionalMedia[0] === 'object' && !!content.additionalMedia[0]?.file,
            value: content.additionalMedia[0]
          } 
        : null,
      
      // Проверка additional_images (snake_case)
      hasAdditionalImagesSnake: !!content.additional_images,
      additionalImagesSnakeType: content.additional_images ? typeof content.additional_images : null,
      isAdditionalImagesSnakeArray: Array.isArray(content.additional_images),
      additionalImagesSnakeLength: Array.isArray(content.additional_images) ? content.additional_images.length : 0,
      
      // Первые элементы additional_images
      firstAdditionalImageSnakeItem: Array.isArray(content.additional_images) && content.additional_images.length > 0 
        ? {
            type: typeof content.additional_images[0],
            isString: typeof content.additional_images[0] === 'string',
            isObject: typeof content.additional_images[0] === 'object',
            hasURL: typeof content.additional_images[0] === 'object' && !!content.additional_images[0]?.url,
            hasFile: typeof content.additional_images[0] === 'object' && !!content.additional_images[0]?.file,
            value: content.additional_images[0]
          } 
        : null,
      
      // Весь объект content.social_platforms
      socialPlatforms: content.socialPlatforms,
      
      // Анализ метаданных
      metadata: content.metadata || {}
    };

    log(\`[Media Check] Анализ медиа для контента \${contentId}:\n\${JSON.stringify(mediaFields, null, 2)}\`, 'media-check');

    return res.json({
      success: true,
      mediaFields: mediaFields
    });
  } catch (error: any) {
    log(\`[Media Check] Ошибка при проверке медиа: \${error.message}\`, 'media-check');
    
    return res.status(500).json({
      success: false,
      error: \`Ошибка при проверке медиа: \${error.message}\`
    });
  }
});
" | tee -a media-check-route.txt

echo "Этот код нужно добавить в server/api/test-instagram-route.ts" | tee -a "$LOG_FILE"
echo "Пока этот endpoint не реализован на сервере, давайте посмотрим сам контент" | tee -a "$LOG_FILE"

echo -e "\nИспользуем существующий endpoint для просмотра медиа-полей..." | tee -a "$LOG_FILE"

response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"contentId\": \"$CONTENT_ID\"}" \
  --max-time 30 \
  "http://localhost:5000/api/test/instagram-stories")

result=$?

echo -e "\n=== РЕЗУЛЬТАТ ЗАПРОСА ===" | tee -a "$LOG_FILE"
if [ $result -eq 0 ]; then
  echo "Запрос успешно выполнен (код: $result)" | tee -a "$LOG_FILE"
  
  # Извлекаем информацию о медиа полях
  if [[ "$response" == *"Медиа для сторис"* ]]; then
    echo -e "\n=== МЕДИА-ПОЛЯ ===" | tee -a "$LOG_FILE"
    echo "$response" | grep -o '"mediaFields":.*}' | cut -d':' -f2- | python -m json.tool | tee -a "$LOG_FILE"
  elif [[ "$response" == *"mediaFields"* ]]; then
    echo -e "\n=== МЕДИА-ПОЛЯ ===" | tee -a "$LOG_FILE"
    echo "$response" | grep -o '"mediaFields":.*}' | cut -d':' -f2- | python -m json.tool | tee -a "$LOG_FILE" 
  else
    echo "Информация о медиа полях не найдена в ответе" | tee -a "$LOG_FILE"
    echo -e "\n=== ПОЛНЫЙ ОТВЕТ ===" | tee -a "$LOG_FILE"
    echo "$response" | python -m json.tool | tee -a "$LOG_FILE"
  fi
else
  echo "Ошибка при выполнении запроса. Код: $result" | tee -a "$LOG_FILE"
  if [ $result -eq 28 ]; then
    echo "Превышен таймаут (30 секунд)" | tee -a "$LOG_FILE"
  fi
fi

echo -e "\n=== ПРОВЕРКА ЗАВЕРШЕНА ===" | tee -a "$LOG_FILE"
echo "Результаты сохранены в файл: $LOG_FILE" | tee -a "$LOG_FILE"