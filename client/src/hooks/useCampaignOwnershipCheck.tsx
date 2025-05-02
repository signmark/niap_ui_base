import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';
import { directusApi } from '@/lib/directus';

/**
 * Хук для проверки принадлежности выбранной кампании текущему пользователю
 * @returns {void}
 */
function useCampaignOwnershipCheck() {
  const { selectedCampaignId, selectedCampaignName, clearSelectedCampaign } = useCampaignStore();
  const userId = useAuthStore(state => state.userId);
  const { toast } = useToast();

  useEffect(() => {
    const checkCampaignOwnership = async () => {
      if (selectedCampaignId && userId) {
        console.log("Проверка принадлежности кампании пользователю:", {campaignId: selectedCampaignId, userId});
        
        try {
          const response = await directusApi.get('/items/user_campaigns', {
            params: {
              filter: {
                id: { _eq: selectedCampaignId },
                user_id: { _eq: userId }
              }
            }
          });
          
          const campaignExists = response.data?.data && response.data.data.length > 0;
          
          if (!campaignExists) {
            console.log("Кампания не принадлежит текущему пользователю, сбрасываем выбор");
            toast({
              title: "Доступ ограничен",
              description: "Выбранная кампания недоступна или принадлежит другому пользователю",
              variant: "destructive"
            });
            clearSelectedCampaign();
          } else {
            console.log("Кампания принадлежит текущему пользователю:", selectedCampaignName);
          }
        } catch (error) {
          console.error("Ошибка при проверке кампании:", error);
          clearSelectedCampaign();
        }
      }
    };
    
    checkCampaignOwnership();
  }, [selectedCampaignId, userId, selectedCampaignName, clearSelectedCampaign, toast]);

  return null;
}

export default useCampaignOwnershipCheck;
