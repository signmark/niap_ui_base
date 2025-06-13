import axios from 'axios';
import { directusAuthManager } from './directus-auth-manager';

/**
 * Сервис для работы с данными кампании
 * Предоставляет централизованный доступ к информации о кампаниям и анкетам
 */
export class CampaignDataService {
  private directusApi = axios.create({
    baseURL: process.env.DIRECTUS_URL,
    timeout: 10000
  });

  /**
   * Получает обогащенный контекст кампании для AI промптов
   * @param userId ID пользователя
   * @param campaignId ID кампании (опционально, если не указан - найдет активную)
   * @param token Токен авторизации
   * @returns Форматированная строка с данными кампании
   */
  async getCampaignContext(userId: string, campaignId?: string, token?: string): Promise<string | null> {
    try {
      console.log('[campaign-data] Получение контекста кампании для пользователя:', userId);
      
      // Используем переданный токен напрямую
      if (!token) {
        console.log('[campaign-data] Токен авторизации не передан');
        return null;
      }
      const authToken = token;
      
      let targetCampaignId = campaignId;
      
      // Если ID кампании не указан, найдем активную кампанию пользователя
      if (!targetCampaignId) {
        targetCampaignId = await this.getActiveCampaignId(userId, authToken);
        if (!targetCampaignId) {
          console.log('[campaign-data] Активная кампания не найдена');
          return null;
        }
      }

      // Получаем данные кампании
      const campaignData = await this.getCampaignData(targetCampaignId, authToken);
      if (!campaignData) {
        console.log('[campaign-data] Данные кампании не найдены');
        return null;
      }

      // Получаем данные анкеты
      const questionnaireData = await this.getQuestionnaireData(targetCampaignId, authToken);
      
      // Форматируем контекст для AI
      const context = this.formatCampaignContext(campaignData, questionnaireData);
      console.log('[campaign-data] Контекст кампании успешно сформирован');
      
      return context;
    } catch (error) {
      console.error('[campaign-data] Ошибка при получении контекста кампании:', error);
      return null;
    }
  }

  /**
   * Находит активную кампанию пользователя
   */
  private async getActiveCampaignId(userId: string, token?: string): Promise<string | null> {
    try {
      const campaignsResponse = await this.directusApi.get('/items/user_campaigns', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: {
            user_id: { _eq: userId }
          },
          limit: 1
        }
      });

      const campaigns = campaignsResponse.data?.data;
      if (campaigns && campaigns.length > 0) {
        return campaigns[0].campaign_id;
      }
      
      return null;
    } catch (error) {
      console.error('[campaign-data] Ошибка при поиске активной кампании:', error);
      return null;
    }
  }

  /**
   * Получает основные данные кампании
   */
  private async getCampaignData(campaignId: string, token?: string): Promise<any> {
    try {
      const response = await this.directusApi.get(`/items/user_campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data?.data;
    } catch (error) {
      console.error('[campaign-data] Ошибка при получении данных кампании:', error);
      return null;
    }
  }

  /**
   * Получает данные анкеты кампании
   */
  private async getQuestionnaireData(campaignId: string, token?: string): Promise<any> {
    try {
      const response = await this.directusApi.get('/items/business_questionnaire', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: {
            campaign_id: { _eq: campaignId }
          },
          limit: 1
        }
      });

      const questionnaires = response.data?.data;
      return questionnaires && questionnaires.length > 0 ? questionnaires[0] : null;
    } catch (error) {
      console.error('[campaign-data] Ошибка при получении данных анкеты:', error);
      return null;
    }
  }

  /**
   * Форматирует данные кампании в контекст для AI
   */
  private formatCampaignContext(campaignData: any, questionnaireData: any): string {
    let context = '';

    // Добавляем основную информацию о кампании
    if (campaignData) {
      if (campaignData.name) {
        context += `\n\nНазвание кампании: ${campaignData.name}`;
      }
      if (campaignData.website_link) {
        context += `\n\nОфициальный сайт компании: ${campaignData.website_link}`;
      }
    }

    // Добавляем данные из анкеты
    if (questionnaireData) {
      if (questionnaireData.company_name) {
        context += `\n\nНазвание компании: ${questionnaireData.company_name}`;
      }
      if (questionnaireData.contact_info) {
        context += `\n\nКонтактная информация: ${questionnaireData.contact_info}`;
      }
      if (questionnaireData.business_description) {
        context += `\n\nОписание бизнеса: ${questionnaireData.business_description}`;
      }
      if (questionnaireData.target_audience) {
        context += `\n\nЦелевая аудитория: ${questionnaireData.target_audience}`;
      }
      if (questionnaireData.products_services) {
        context += `\n\nТовары и услуги: ${questionnaireData.products_services}`;
      }
      if (questionnaireData.unique_selling_proposition) {
        context += `\n\nУникальное торговое предложение: ${questionnaireData.unique_selling_proposition}`;
      }
      if (questionnaireData.brand_tone) {
        context += `\n\nТон бренда: ${questionnaireData.brand_tone}`;
      }
      if (questionnaireData.content_goals) {
        context += `\n\nЦели контента: ${questionnaireData.content_goals}`;
      }
      if (questionnaireData.social_media_goals) {
        context += `\n\nЦели в социальных сетях: ${questionnaireData.social_media_goals}`;
      }
    }

    return context;
  }

  /**
   * Обогащает промпт данными кампании
   * @param originalPrompt Исходный промпт
   * @param userId ID пользователя
   * @param campaignId ID кампании (опционально)
   * @param token Токен авторизации
   * @returns Обогащенный промпт или исходный, если данные недоступны
   */
  async enrichPromptWithCampaignData(
    originalPrompt: string, 
    userId: string, 
    campaignId?: string, 
    token?: string
  ): Promise<string> {
    try {
      console.log('🎯 [PROMPT-ENRICHMENT] Начинаем обогащение промпта для пользователя:', userId);
      console.log('🎯 [PROMPT-ENRICHMENT] Исходный промпт:', originalPrompt);
      
      const campaignContext = await this.getCampaignContext(userId, campaignId, token);
      
      if (!campaignContext) {
        console.log('❌ [PROMPT-ENRICHMENT] Контекст кампании недоступен, используем исходный промпт');
        console.log('🚨 [FINAL-PROMPT] ПРОМПТ БЕЗ ДАННЫХ КАМПАНИИ:', originalPrompt);
        return originalPrompt;
      }

      console.log('✅ [PROMPT-ENRICHMENT] Контекст кампании получен!');
      console.log('📝 [CAMPAIGN-CONTEXT]:', campaignContext);

      const enrichedPrompt = `${originalPrompt}\n\nКРИТИЧЕСКИ ВАЖНО: Используй ИСКЛЮЧИТЕЛЬНО предоставленную информацию о компании:${campaignContext}\n\nСТРОГО ОБЯЗАТЕЛЬНО:\n1. Используй ТОЛЬКО название компании из предоставленных данных\n2. Используй ТОЛЬКО описание услуг из предоставленных данных\n3. ЗАПРЕЩЕНО придумывать ссылки на сайт - используй ТОЛЬКО ссылки из предоставленных данных кампании\n4. НЕ ВЫДУМЫВАЙ отзывы - создавай реалистичные на основе предоставленных услуг\n5. Все детали должны соответствовать ТОЛЬКО предоставленной информации о компании\n6. ВАЖНО: Предоставь ОДИН лучший по твоему мнению вариант, а НЕ несколько коротких вариантов\n7. Создай развернутый качественный контент, используя максимальную длину ответа`;
      
      console.log('🎉 [PROMPT-ENRICHMENT] Промпт успешно обогащен данными кампании');
      console.log('🚨 [FINAL-PROMPT] ФИНАЛЬНЫЙ ОБОГАЩЕННЫЙ ПРОМПТ:');
      console.log('='.repeat(50));
      console.log(enrichedPrompt);
      console.log('='.repeat(50));
      
      return enrichedPrompt;
    } catch (error) {
      console.error('💥 [PROMPT-ENRICHMENT] Ошибка при обогащении промпта:', error);
      console.log('🚨 [FINAL-PROMPT] ПРОМПТ С ОШИБКОЙ (используем исходный):', originalPrompt);
      return originalPrompt;
    }
  }
}