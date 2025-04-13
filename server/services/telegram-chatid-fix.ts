/**
 * Сервис для исправления chatId в настройках Telegram для всех кампаний
 * Меняет старый chatId "-1001955550242" на новый "-1002302366310"
 */

import log from '../utils/logger';
import { storage } from '../storage';

// Константы
const OLD_CHAT_ID = '-1001955550242';
const NEW_CHAT_ID = '-1002302366310';

export class TelegramChatIdFixService {

  /**
   * Обновляет chatId в настройках Telegram для всех кампаний
   * @returns {Promise<{updated: number, skipped: number, failed: number, errors: any[]}>} Результаты обновления
   */
  async updateAllCampaigns(): Promise<{
    updated: number;
    skipped: number;
    failed: number;
    errors: any[];
  }> {
    try {
      log('Запуск процесса обновления chatId в настройках Telegram...', 'telegram-fix');

      // Получение списка кампаний
      const campaigns = await storage.getAllCampaigns();
      log(`Получено ${campaigns.length} кампаний`, 'telegram-fix');

      // Счетчики для статистики
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const errors: any[] = [];

      // Обработка каждой кампании
      for (const campaign of campaigns) {
        try {
          let needsUpdate = false;
          const updateData: any = {};
          
          // Проверка settings
          if (campaign.settings?.telegram?.chatId === OLD_CHAT_ID) {
            log(`Кампания "${campaign.name}" (${campaign.id}) содержит устаревший chatId в settings`, 'telegram-fix');
            const settings = JSON.parse(JSON.stringify(campaign.settings));
            settings.telegram.chatId = NEW_CHAT_ID;
            updateData.settings = settings;
            needsUpdate = true;
          }

          // Проверка socialMediaSettings
          if (campaign.socialMediaSettings?.telegram?.chatId === OLD_CHAT_ID) {
            log(`Кампания "${campaign.name}" (${campaign.id}) содержит устаревший chatId в socialMediaSettings`, 'telegram-fix');
            const socialMediaSettings = JSON.parse(JSON.stringify(campaign.socialMediaSettings));
            socialMediaSettings.telegram.chatId = NEW_CHAT_ID;
            updateData.socialMediaSettings = socialMediaSettings;
            needsUpdate = true;
          }

          // Если требуется обновление, выполняем его
          if (needsUpdate) {
            try {
              await storage.updateCampaign(campaign.id, updateData);
              log(`Кампания "${campaign.name}" (${campaign.id}) успешно обновлена`, 'telegram-fix');
              updated++;
            } catch (updateError: any) {
              log(`Ошибка при обновлении кампании "${campaign.name}" (${campaign.id}): ${updateError.message}`, 'telegram-fix', 'error');
              errors.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                error: updateError.message
              });
              failed++;
            }
          } else {
            skipped++;
          }
        } catch (campaignError: any) {
          log(`Ошибка при обработке кампании ${campaign.id}: ${campaignError.message}`, 'telegram-fix', 'error');
          errors.push({
            campaignId: campaign.id,
            error: campaignError.message
          });
          failed++;
        }
      }

      // Итоговая статистика
      log(`Обработка завершена. Обновлено: ${updated}, пропущено: ${skipped}, неудачно: ${failed}`, 'telegram-fix');
      
      return {
        updated,
        skipped,
        failed,
        errors
      };
    } catch (error: any) {
      log(`Ошибка при обновлении chatId: ${error.message}`, 'telegram-fix', 'error');
      throw error;
    }
  }
}

// Экспорт инстанса сервиса
export const telegramChatIdFixService = new TelegramChatIdFixService();