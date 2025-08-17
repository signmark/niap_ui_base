/**
 * Simple test for autonomous content generation functionality
 * This script validates that the core AI content generation works
 */

import { GeminiVertexService } from './services/gemini-vertex';
import { directusCrud } from './services/directus/index';
import logger from './utils/logger';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export async function testAutonomousContentGeneration(campaignId: string): Promise<TestResult> {
  try {
    logger.info(`[AutonomousTest] Starting content generation test for campaign: ${campaignId}`);

    // 1. Test Gemini AI content generation
    const gemini = new GeminiVertexService();
    
    const testPrompt = `
Создай короткий пост для социальных сетей на тему "Автоматизация контента с помощью ИИ".

Требования:
- Длина: 150-200 символов
- Тон: дружелюбный и профессиональный
- Добавь 2-3 хэштега
- Язык: русский

Верни результат в JSON формате:
{
  "title": "Заголовок поста",
  "content": "Основной текст",
  "hashtags": ["#хештег1", "#хештег2"]
}
`;

    logger.info(`[AutonomousTest] Generating content with Gemini...`);
    const aiResponse = await gemini.generateContent(testPrompt);
    
    if (!aiResponse) {
      throw new Error('Gemini не вернул ответ');
    }

    logger.info(`[AutonomousTest] AI response received: ${aiResponse.substring(0, 100)}...`);

    // 2. Parse AI response
    let parsedContent;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback parsing
        parsedContent = {
          title: 'Автоматически созданный пост',
          content: aiResponse.substring(0, 200),
          hashtags: ['#автопост', '#ии']
        };
      }
    } catch (parseError) {
      logger.warn(`[AutonomousTest] JSON parsing failed, using fallback`);
      parsedContent = {
        title: 'Автоматически созданный пост',
        content: aiResponse.substring(0, 200),
        hashtags: ['#автопост', '#ии']
      };
    }

    logger.info(`[AutonomousTest] Content parsed successfully:`, parsedContent);

    // 3. Test campaign access
    const systemToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!systemToken) {
      throw new Error('System token not available');
    }

    const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    logger.info(`[AutonomousTest] Campaign accessed: ${campaign.name || 'Unnamed Campaign'}`);

    // 4. Create test publication (scheduled for future)
    const scheduledTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now
    
    const publicationData = {
      campaign_id: campaignId,
      title: parsedContent.title,
      content: parsedContent.content,
      hashtags: Array.isArray(parsedContent.hashtags) ? parsedContent.hashtags.join(' ') : '',
      platforms: ['vk'],
      status: 'scheduled',
      scheduled_at: scheduledTime,
      created_by_bot: true,
      content_type: 'text'
    };

    const createdPublication = await directusCrud.createItem('publications', publicationData, { authToken: systemToken });
    
    if (!createdPublication) {
      throw new Error('Failed to create test publication');
    }

    logger.info(`[AutonomousTest] Test publication created: ${createdPublication.id}`);

    // 5. Return success result
    return {
      success: true,
      message: 'Autonomous content generation test completed successfully',
      data: {
        campaignId,
        campaignName: campaign.name,
        generatedContent: parsedContent,
        publicationId: createdPublication.id,
        scheduledTime,
        aiResponse: aiResponse.substring(0, 500) + '...'
      }
    };

  } catch (error: any) {
    logger.error(`[AutonomousTest] Test failed:`, error);
    return {
      success: false,
      message: 'Autonomous content generation test failed',
      error: error.message || 'Unknown error'
    };
  }
}

export async function quickContentGenerationDemo(): Promise<TestResult> {
  try {
    logger.info(`[AutonomousDemo] Starting quick content generation demo`);

    const gemini = new GeminiVertexService();
    
    const demoPrompt = `
Создай креативный пост для социальных сетей на тему "Будущее искусственного интеллекта".

Требования:
- Интересный и увлекательный контент
- 180-250 символов
- Добавь вопрос для вовлечения аудитории
- 3 актуальных хэштега
- Тон: позитивный и вдохновляющий

Формат ответа - обычный текст с хэштегами в конце.
`;

    const result = await gemini.generateContent(demoPrompt);
    
    if (!result) {
      throw new Error('AI не сгенерировал контент');
    }

    return {
      success: true,
      message: 'Quick content generation demo completed',
      data: {
        prompt: demoPrompt.substring(0, 200) + '...',
        generatedContent: result,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error: any) {
    logger.error(`[AutonomousDemo] Demo failed:`, error);
    return {
      success: false,
      message: 'Quick content generation demo failed',
      error: error.message || 'Unknown error'
    };
  }
}