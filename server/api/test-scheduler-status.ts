/**
 * Тестовый маршрут для проверки статуса шедулера и просмотра запланированного контента
 */
import express from 'express';
import { publishScheduler } from '../services/publish-scheduler';
import { storage } from '../storage';

export default function registerTestSchedulerRoutes(app: express.Express) {
  app.get('/api/test/scheduler-status', async (req, res) => {
    console.log('Запрошен статус шедулера');
    
    try {
      // Получаем токен администратора из шедулера
      const token = await publishScheduler.getSystemToken();
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Не удалось получить токен администратора',
        });
      }
      
      // Получаем список запланированного контента
      const scheduledContent = await storage.getCampaignContentList({ 
        filter: { status: { _eq: 'scheduled' } },
        sort: ['-date_created']
      }, token);
      
      // Результаты теста
      const result = {
        success: true,
        isRunning: publishScheduler.isRunning,
        checkIntervalMs: publishScheduler.checkIntervalMs,
        disablePublishing: publishScheduler.disablePublishing,
        verboseLogging: publishScheduler.verboseLogging,
        scheduledContent: scheduledContent.map(content => ({
          id: content.id,
          title: content.title,
          status: content.status,
          socialPlatforms: content.socialPlatforms,
          scheduledAt: content.scheduledAt,
          platformDetails: Object.entries(content.socialPlatforms || {}).map(([platform, data]) => ({
            platform,
            status: data.status,
            selected: data.selected,
            scheduledAt: data.scheduledAt,
            error: data.error
          }))
        }))
      };
      
      res.json(result);
    } catch (error: any) {
      console.error('Ошибка при получении статуса шедулера:', error);
      res.status(500).json({
        success: false,
        message: `Ошибка при получении статуса шедулера: ${error.message}`,
      });
    }
  });
  
  console.log('Тестовый маршрут для проверки статуса шедулера зарегистрирован');
}