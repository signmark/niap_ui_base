import { Router, Request, Response } from 'express';
// Пока будем использовать простую аутентификацию через заголовки
// import { authenticateUser } from '../middleware/auth';

const router = Router();

interface AICommand {
  command: string;
  campaignId: string;
}

interface AIAction {
  type: 'create_post' | 'schedule_post' | 'publish_now' | 'generate_image' | 'analyze_trends';
  label: string;
  data: any;
  status: 'pending' | 'completed' | 'failed';
}

interface AIResponse {
  success: boolean;
  response?: string;
  actions?: AIAction[];
  error?: string;
}

// Обработка AI команд
router.post('/process-command', async (req: Request, res: Response) => {
  try {
    const { command, campaignId }: AICommand = req.body;
    const userId = (req as any).user?.id;

    console.log(`🤖 [AI-ASSISTANT] Обработка команды от пользователя ${userId}: "${command}"`);

    if (!command || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Команда и ID кампании обязательны'
      });
    }

    // Анализируем команду с помощью AI
    const analysisResult = await analyzeCommand(command, campaignId, userId);
    
    console.log(`🤖 [AI-ASSISTANT] Результат анализа:`, analysisResult);

    res.json(analysisResult);

  } catch (error) {
    console.error('🤖 [AI-ASSISTANT] Ошибка обработки команды:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера при обработке команды'
    });
  }
});

// Анализ команды и определение действий
async function analyzeCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  const lowerCommand = command.toLowerCase();
  
  // Определяем тип команды по ключевым словам
  if (lowerCommand.includes('создай') || lowerCommand.includes('напиши') || lowerCommand.includes('сделай пост')) {
    return await handleCreatePostCommand(command, campaignId, userId);
  }
  
  if (lowerCommand.includes('запланируй') || lowerCommand.includes('назначь') || lowerCommand.includes('запланировать')) {
    return await handleScheduleCommand(command, campaignId, userId);
  }
  
  if (lowerCommand.includes('опубликуй') || lowerCommand.includes('публикуй') || lowerCommand.includes('отправь сейчас')) {
    return await handlePublishCommand(command, campaignId, userId);
  }
  
  if (lowerCommand.includes('изображение') || lowerCommand.includes('картинк') || lowerCommand.includes('фото') || lowerCommand.includes('генерируй')) {
    return await handleImageCommand(command, campaignId, userId);
  }
  
  if (lowerCommand.includes('анализ') || lowerCommand.includes('тренд') || lowerCommand.includes('статистик')) {
    return await handleAnalysisCommand(command, campaignId, userId);
  }

  // Если команда не распознана, используем AI для анализа
  return await handleGeneralCommand(command, campaignId, userId);
}

// Обработка команды создания поста
async function handleCreatePostCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка команды создания поста`);
  
  // Извлекаем тему поста из команды
  const topic = extractTopicFromCommand(command);
  const platforms = extractPlatformsFromCommand(command);
  
  // Генерируем контент с помощью AI
  try {
    const aiContent = await generatePostContent(topic, platforms);
    
    const action: AIAction = {
      type: 'create_post',
      label: `Создать пост: "${topic}"`,
      data: {
        content: aiContent.text,
        image_url: aiContent.imagePrompt ? undefined : null,
        platforms: platforms.length > 0 ? platforms : ['instagram', 'vk', 'facebook'],
        status: 'draft'
      },
      status: 'pending'
    };

    return {
      success: true,
      response: `Готово! Я создаю пост на тему "${topic}" для платформ: ${platforms.length > 0 ? platforms.join(', ') : 'Instagram, VK, Facebook'}.\n\nТекст поста:\n${aiContent.text}${aiContent.imagePrompt ? `\n\nТакже сгенерирую изображение: ${aiContent.imagePrompt}` : ''}`,
      actions: [action]
    };
  } catch (error) {
    console.error('Ошибка генерации контента:', error);
    return {
      success: false,
      error: 'Не удалось сгенерировать контент для поста'
    };
  }
}

// Обработка команды планирования
async function handleScheduleCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка команды планирования`);
  
  const topic = extractTopicFromCommand(command);
  const scheduledDate = extractDateFromCommand(command);
  const platforms = extractPlatformsFromCommand(command);
  
  if (!scheduledDate) {
    return {
      success: false,
      error: 'Не удалось определить дату и время для планирования. Укажите когда опубликовать пост (например: "завтра в 10 утра", "через 2 часа", "в понедельник")'
    };
  }

  try {
    const aiContent = await generatePostContent(topic, platforms);
    
    const action: AIAction = {
      type: 'schedule_post',
      label: `Запланировать на ${scheduledDate.toLocaleString('ru-RU')}`,
      data: {
        content: aiContent.text,
        scheduledDate: scheduledDate.toISOString(),
        platforms: platforms.length > 0 ? platforms : ['instagram', 'vk', 'facebook']
      },
      status: 'pending'
    };

    return {
      success: true,
      response: `Отлично! Планирую пост на тему "${topic}" на ${scheduledDate.toLocaleString('ru-RU')} для платформ: ${platforms.length > 0 ? platforms.join(', ') : 'Instagram, VK, Facebook'}.\n\nТекст поста:\n${aiContent.text}`,
      actions: [action]
    };
  } catch (error) {
    console.error('Ошибка планирования поста:', error);
    return {
      success: false,
      error: 'Не удалось запланировать пост'
    };
  }
}

// Обработка команды публикации
async function handlePublishCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка команды публикации`);
  
  const topic = extractTopicFromCommand(command);
  const platforms = extractPlatformsFromCommand(command);
  
  try {
    const aiContent = await generatePostContent(topic, platforms);
    
    const action: AIAction = {
      type: 'publish_now',
      label: `Опубликовать сейчас`,
      data: {
        content: aiContent.text,
        platforms: platforms.length > 0 ? platforms : ['instagram', 'vk', 'facebook'],
        publishNow: true
      },
      status: 'pending'
    };

    return {
      success: true,
      response: `Публикую пост на тему "${topic}" прямо сейчас в ${platforms.length > 0 ? platforms.join(', ') : 'Instagram, VK, Facebook'}!\n\nТекст поста:\n${aiContent.text}`,
      actions: [action]
    };
  } catch (error) {
    console.error('Ошибка публикации поста:', error);
    return {
      success: false,
      error: 'Не удалось опубликовать пост'
    };
  }
}

// Обработка команды генерации изображения
async function handleImageCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка команды генерации изображения`);
  
  const imagePrompt = extractImagePromptFromCommand(command);
  
  const action: AIAction = {
    type: 'generate_image',
    label: `Сгенерировать изображение`,
    data: {
      prompt: imagePrompt,
      style: 'professional',
      size: '1024x1024'
    },
    status: 'pending'
  };

  return {
    success: true,
    response: `Генерирую изображение по запросу: "${imagePrompt}". Это займет несколько секунд...`,
    actions: [action]
  };
}

// Обработка команды анализа
async function handleAnalysisCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка команды анализа`);
  
  return {
    success: true,
    response: `Анализирую текущие тренды и статистику для вашей кампании. Это займет немного времени...`,
    actions: [{
      type: 'analyze_trends',
      label: 'Анализ трендов',
      data: { campaignId },
      status: 'pending'
    }]
  };
}

// Обработка общих команд через AI
async function handleGeneralCommand(command: string, campaignId: string, userId: string): Promise<AIResponse> {
  console.log(`🤖 [AI-ASSISTANT] Обработка общей команды через AI`);
  
  // Здесь можно интегрировать с внешним AI API (GPT, Gemini и т.д.)
  // Пока возвращаем базовый ответ
  return {
    success: true,
    response: `Я понимаю что вы хотите: "${command}". Пока я учусь понимать такие команды лучше. Попробуйте переформулировать используя ключевые слова:\n\n• "Создай пост про..."\n• "Запланируй на..."\n• "Опубликуй сейчас..."\n• "Сгенерируй изображение..."\n\nИли скажите более конкретно что нужно сделать.`
  };
}

// Генерация контента поста с помощью AI
async function generatePostContent(topic: string, platforms: string[]): Promise<{text: string, imagePrompt?: string}> {
  // Здесь можно интегрировать с Gemini API или другим AI
  // Пока возвращаем базовый контент
  
  const templates = {
    instagram: `🎯 ${topic}

✨ Интересный пост про ${topic.toLowerCase()}!

#smm #маркетинг #${topic.replace(/\s+/g, '')}`,
    vk: `${topic}

Делимся полезной информацией про ${topic.toLowerCase()}.

Что думаете об этом?`,
    facebook: `${topic}

Подробный пост о ${topic.toLowerCase()} для нашего сообщества.`
  };

  // Выбираем шаблон в зависимости от основной платформы
  const primaryPlatform = platforms[0] || 'instagram';
  const text = templates[primaryPlatform as keyof typeof templates] || templates.instagram;
  
  return {
    text,
    imagePrompt: `Professional image about ${topic}, modern style, high quality`
  };
}

// Извлечение темы из команды
function extractTopicFromCommand(command: string): string {
  // Простое извлечение темы по ключевым словам
  const patterns = [
    /про (.+)/i,
    /о (.+)/i,
    /на тему (.+)/i,
    /пост (.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Если не нашли - возвращаем всю команду как тему
  return command.replace(/(создай|напиши|сделай|пост)/gi, '').trim() || 'общая тема';
}

// Извлечение платформ из команды
function extractPlatformsFromCommand(command: string): string[] {
  const platforms: string[] = [];
  const lowerCommand = command.toLowerCase();
  
  if (lowerCommand.includes('instagram') || lowerCommand.includes('инстаграм')) {
    platforms.push('instagram');
  }
  if (lowerCommand.includes('vk') || lowerCommand.includes('вк') || lowerCommand.includes('вконтакте')) {
    platforms.push('vk');
  }
  if (lowerCommand.includes('facebook') || lowerCommand.includes('фейсбук')) {
    platforms.push('facebook');
  }
  if (lowerCommand.includes('telegram') || lowerCommand.includes('телеграм')) {
    platforms.push('telegram');
  }
  if (lowerCommand.includes('youtube') || lowerCommand.includes('ютуб')) {
    platforms.push('youtube');
  }
  
  return platforms;
}

// Извлечение даты из команды
function extractDateFromCommand(command: string): Date | null {
  const now = new Date();
  const lowerCommand = command.toLowerCase();
  
  // Завтра
  if (lowerCommand.includes('завтра')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Ищем время
    const timeMatch = command.match(/(\d{1,2}):?(\d{2})?\s*(утра|дня|вечера)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const period = timeMatch[3].toLowerCase();
      
      if (period === 'вечера' && hours < 12) hours += 12;
      if (period === 'утра' && hours === 12) hours = 0;
      
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // По умолчанию 9 утра
    }
    
    return tomorrow;
  }
  
  // Через X часов
  const hoursMatch = command.match(/через\s+(\d+)\s+час/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    const futureDate = new Date(now);
    futureDate.setHours(futureDate.getHours() + hours);
    return futureDate;
  }
  
  // Сегодня в X
  const todayTimeMatch = command.match(/сегодня\s+в\s+(\d{1,2}):?(\d{2})?/i);
  if (todayTimeMatch) {
    const hours = parseInt(todayTimeMatch[1]);
    const minutes = parseInt(todayTimeMatch[2] || '0');
    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    return today;
  }
  
  return null;
}

// Извлечение промпта для изображения
function extractImagePromptFromCommand(command: string): string {
  const patterns = [
    /изображение (.+)/i,
    /картинк.* (.+)/i,
    /фото (.+)/i,
    /генерируй (.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return command.replace(/(изображение|картинк|фото|генерируй)/gi, '').trim() || 'professional marketing image';
}

export default router;