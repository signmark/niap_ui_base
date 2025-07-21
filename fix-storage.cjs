const fs = require('fs');

// Читаем файл и находим проблемную функцию
const content = fs.readFileSync('server/storage.ts', 'utf8');

// Находим начало функции getCampaignContentById
const startPattern = 'async getCampaignContentById(id: string, authToken?: string): Promise<CampaignContent | undefined> {';
const startIndex = content.indexOf(startPattern);

if (startIndex === -1) {
  console.log('Не найдена функция getCampaignContentById');
  process.exit(1);
}

// Находим следующую функцию
const nextFunctionPattern = 'async createCampaignContent(';
const nextIndex = content.indexOf(nextFunctionPattern);

if (nextIndex === -1) {
  console.log('Не найдена следующая функция');
  process.exit(1);
}

// Выводим проблемную часть
const problemSection = content.substring(startIndex, nextIndex);
console.log('Проблемная секция:');
console.log(problemSection.substring(0, 500) + '...');

// Заменяем функцию getCampaignContentById на упрощенную версию
const simplifiedFunction = `async getCampaignContentById(id: string, authToken?: string): Promise<CampaignContent | undefined> {
    try {
      console.log(\`[getCampaignContentById] Получение контента с ID: \${id}\`);
      
      // Используем переданный токен или системный токен
      const token = authToken || process.env.DIRECTUS_TOKEN;
      
      const response = await directusApi.get(\`/items/campaign_content/\${id}\`, { 
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      
      if (!response?.data?.data) {
        console.log(\`❌ Контент с ID \${id} не найден\`);
        return undefined;
      }
      
      console.log('✅ Контент найден успешно');
      const item = response.data.data;
      
      return {
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        contentType: item.content_type,
        status: item.status,
        postType: item.post_type,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        prompt: item.prompt || "",
        keywords: item.keywords,
        title: item.title,
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms || {},
        publishedPlatforms: item.published_platforms || [],
        additionalImages: item.additional_images || [],
        additionalMedia: item.additional_media,
        metadata: item.metadata
      };
    } catch (error: any) {
      console.error(\`Ошибка при получении контента с ID \${id}:\`, error.message);
      return undefined;
    }
  }

  `;

// Заменяем проблемную функцию
const before = content.substring(0, content.indexOf('async getCampaignContentById'));
const after = content.substring(nextIndex);

const newContent = before + simplifiedFunction + after;

// Записываем исправленный файл
fs.writeFileSync('server/storage.ts', newContent);

console.log('✅ Файл storage.ts исправлен!');