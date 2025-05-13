/**
 * Тестовый маршрут для проверки статуса шедулера и просмотра запланированного контента
 */
import express from 'express';
import { publishScheduler } from '../services/publish-scheduler';
import axios from 'axios';

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
      
      // Получаем данные из директуса напрямую как это делает шедулер
      const baseDirectusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Запрос для контента со статусом scheduled
      const scheduledFilter = {
        status: { _eq: 'scheduled' },
      };
      
      // Запрос для контента со статусом draft и платформами в статусе pending
      const pendingFilter = {
        status: { _eq: 'draft' },
        _and: [
          { socialPlatforms: { _nnull: true } }
        ]
      };
      
      const [scheduledResponse, pendingResponse] = await Promise.all([
        axios.get(`${baseDirectusUrl}/items/campaign_content`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            'filter': JSON.stringify(scheduledFilter),
            'sort': '-date_created',
            'limit': 100,
            'fields': ['*', 'user.email', 'campaign.id', 'campaign.name', 'campaign.socialMediaSettings']
          }
        }),
        axios.get(`${baseDirectusUrl}/items/campaign_content`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            'filter': JSON.stringify(pendingFilter),
            'sort': '-date_created',
            'limit': 100,
            'fields': ['*', 'user.email', 'campaign.id', 'campaign.name', 'campaign.socialMediaSettings']
          }
        })
      ]);
      
      const formatContent = (content: any) => ({
        id: content.id,
        title: content.title,
        status: content.status,
        campaignId: content.campaign?.id,
        campaignName: content.campaign?.name,
        socialPlatforms: content.social_platforms || {},
        scheduledAt: content.scheduled_at,
        dateCreated: content.date_created,
        platformDetails: Object.entries(content.social_platforms || {}).map(([platform, data]: [string, any]) => ({
          platform,
          status: data.status,
          selected: data.selected,
          scheduledAt: data.scheduledAt,
          publishedAt: data.publishedAt,
          error: data.error,
          pending: data.status === 'pending'
        }))
      });
      
      // Получить информацию о шедулере (его публичные свойства)
      const schedulerState = {
        disablePublishing: publishScheduler.disablePublishing,
        processingJobs: false
      };
      
      // Проверка чтобы определить, наступило ли время публикации
      const currentDate = new Date();
      const scheduledContentItems = scheduledResponse.data.data || [];
      const pendingContentItems = pendingResponse.data.data || [];
      
      const contentReadyToPublish = scheduledContentItems.filter((content: any) => {
        try {
          const socialPlatforms = content.social_platforms || {};
          
          // Проверяем, есть ли хотя бы одна платформа, которая готова к публикации
          return Object.entries(socialPlatforms).some(([platform, data]: [string, any]) => {
            if (data.status === 'pending' && data.scheduledAt) {
              const scheduledTime = new Date(data.scheduledAt);
              return scheduledTime <= currentDate;
            }
            return false;
          });
        } catch (e) {
          return false;
        }
      });
      
      // Результаты теста
      const result = {
        success: true,
        scheduler: schedulerState,
        currentTime: currentDate.toISOString(),
        contentStats: {
          scheduledCount: scheduledContentItems.length,
          pendingCount: pendingContentItems.filter((content: any) => {
            try {
              const socialPlatforms = content.social_platforms || {};
              return Object.values(socialPlatforms).some((data: any) => data.status === 'pending');
            } catch (e) {
              return false;
            }
          }).length,
          readyToPublishCount: contentReadyToPublish.length
        },
        scheduledContent: scheduledContentItems.map(formatContent),
        pendingContent: pendingContentItems
          .filter((content: any) => {
            try {
              const socialPlatforms = content.social_platforms || {};
              return Object.values(socialPlatforms).some((data: any) => data.status === 'pending');
            } catch (e) {
              return false;
            }
          })
          .map(formatContent),
        readyToPublish: contentReadyToPublish.map(formatContent)
      };
      
      res.json(result);
    } catch (error: any) {
      console.error('Ошибка при получении статуса шедулера:', error);
      res.status(500).json({
        success: false,
        message: `Ошибка при получении статуса шедулера: ${error.message}`,
        stack: error.stack
      });
    }
  });
  
  console.log('Тестовый маршрут для проверки статуса шедулера зарегистрирован');
}