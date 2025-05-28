import axios from 'axios';
import { directusAuthManager } from './directus-auth-manager';

/**
 * Сервис для работы с данными кампании
 * Предоставляет централизованный доступ к информации о кампаниям и анкетам
 */
export class CampaignDataService {
  private directusApi = axios.create({
    baseURL: 'https://directus.nplanner.ru',
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
      
      // Получаем действительный токен авторизации
      let authToken = token;
      if (!authToken) {
        authToken = await directusAuthManager.getAuthToken(userId);
        if (!authToken) {
          console.log('[campaign-data] Не удалось получить токен авторизации');
          return null;
        }
      }
      
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
      const response = await this.directusApi.get(`/items/campaigns/${campaignId}`, {
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
      const response = await this.directusApi.get('/items/campaign_questionnaires', {
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
      const campaignContext = await this.getCampaignContext(userId, campaignId, token);
      
      if (!campaignContext) {
        console.log('[campaign-data] Контекст кампании недоступен, используем исходный промпт');
        return originalPrompt;
      }

      const enrichedPrompt = `${originalPrompt}\n\nВАЖНО: Используй только предоставленную информацию о компании:${campaignContext}\n\nОБЯЗАТЕЛЬНО: Если в контексте указан сайт кампании, используй ТОЛЬКО эту ссылку в посте. Не придумывай другие ссылки.`;
      
      console.log('[campaign-data] Промпт успешно обогащен данными кампании');
      return enrichedPrompt;
    } catch (error) {
      console.error('[campaign-data] Ошибка при обогащении промпта:', error);
      return originalPrompt;
    }
  }
}