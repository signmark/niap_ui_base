import { Router } from 'express';
import { publishScheduler } from '../services/publish-scheduler';
import { directusAuthManager } from '../services/directus-auth-manager';

const router = Router();

/**
 * Очистка всех кэшированных токенов и принудительное обновление
 */
router.post('/clear-cache/tokens', async (req, res) => {
  try {
    console.log('[clear-cache] Начало очистки всех кэшированных токенов');
    
    // Очищаем кэш в publish-scheduler
    if (publishScheduler && publishScheduler.clearTokenCache) {
      publishScheduler.clearTokenCache();
      console.log('[clear-cache] Кэш токенов очищен в publish-scheduler');
    }
    
    console.log('[clear-cache] Очистка кэша токенов завершена успешно');
    
    res.json({
      success: true,
      message: 'Кэш токенов успешно очищен'
    });
  } catch (error: any) {
    console.error('[clear-cache] Ошибка при очистке кэша:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при очистке кэша токенов',
      details: error.message
    });
  }
});

export default router;