import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для работы с кампаниями
 */
export function registerCampaignRoutes(router: Router) {
  log('Регистрация маршрутов кампаний...', 'campaign-routes');

  /**
   * Получение списка кампаний
   * GET /api/campaigns
   */
  router.get('/campaigns', async (req: Request, res: Response) => {
    try {
      // В реальном приложении здесь будет получение userId из сессии
      // В данном случае используем userId из запроса
      const userId = (req as any).userId;
      
      console.log(`Fetching campaigns for user: ${userId}`);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Необходимо авторизоваться'
        });
      }
      
      try {
        const campaigns = await storage.getCampaigns(userId);
        
        // Если кампании есть - возвращаем их
        if (campaigns && campaigns.length > 0) {
          console.log(`Found ${campaigns.length} campaigns for user ${userId}`);
          return res.json({
            success: true,
            data: campaigns
          });
        }
        
        // Если кампаний нет - возвращаем демо-кампанию
        console.log(`No campaigns found for user ${userId}, returning demo campaign`);
        
        return res.json({
          success: true,
          data: [{
            id: 1,
            userId: userId,
            directusId: "demo-campaign",
            name: "Демо-кампания",
            description: "Автоматически созданная кампания для тестирования",
            createdAt: new Date()
          }]
        });
      } catch (error) {
        console.error('Ошибка при получении списка кампаний из storage:', error);
        
        // В случае ошибки также возвращаем демо-кампанию
        return res.json({
          success: true,
          data: [{
            id: 1,
            userId: userId,
            directusId: "demo-campaign",
            name: "Демо-кампания",
            description: "Автоматически созданная кампания для тестирования",
            createdAt: new Date()
          }]
        });
      }
    } catch (error) {
      console.error('Ошибка при получении списка кампаний:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении списка кампаний'
      });
    }
  });

  /**
   * Получение данных конкретной кампании
   * GET /api/campaigns/:id
   */
  router.get('/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      if (isNaN(campaignId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID кампании'
        });
      }
      
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Кампания не найдена'
        });
      }
      
      return res.json({
        success: true,
        data: campaign
      });
    } catch (error) {
      console.error('Ошибка при получении данных кампании:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении данных кампании'
      });
    }
  });

  log('Маршруты кампаний зарегистрированы', 'campaign-routes');
}