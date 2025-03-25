import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Campaign {
  id: string;
  name: string;
  description?: string;
}

interface CampaignState {
  // Старые поля для поддержки существующих компонентов
  selectedCampaign: Campaign | null;
  
  // Новые поля для более простого доступа
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  
  // Функции для изменения состояния
  setSelectedCampaign: (campaignIdOrObj: string | Campaign | null, name?: string) => void;
  clearSelectedCampaign: () => void;
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set) => ({
      // Начальные значения
      selectedCampaign: null,
      selectedCampaignId: localStorage.getItem('selected_campaign_id') || null,
      selectedCampaignName: localStorage.getItem('selected_campaign_name') || null,
      
      // Обновленная функция для поддержки обоих интерфейсов
      setSelectedCampaign: (campaignIdOrObj, name) => {
        // Если передали объект кампании (старый способ)
        if (typeof campaignIdOrObj === 'object') {
          const campaign = campaignIdOrObj;
          if (campaign === null) {
            // Очистка выбранной кампании
            localStorage.removeItem('selected_campaign_id');
            localStorage.removeItem('selected_campaign_name');
            set({ 
              selectedCampaign: null,
              selectedCampaignId: null, 
              selectedCampaignName: null 
            });
            return;
          }
          
          // Сохраняем данные кампании
          localStorage.setItem('selected_campaign_id', campaign.id);
          localStorage.setItem('selected_campaign_name', campaign.name);
          
          console.log(`Установлена активная кампания: id=${campaign.id}, name=${campaign.name}`);
          set({ 
            selectedCampaign: campaign,
            selectedCampaignId: campaign.id, 
            selectedCampaignName: campaign.name 
          });
        } 
        // Если передали id и name (новый способ)
        else if (typeof campaignIdOrObj === 'string' && name) {
          const id = campaignIdOrObj;
          // Сохраняем ID и название кампании
          localStorage.setItem('selected_campaign_id', id);
          localStorage.setItem('selected_campaign_name', name);
          
          console.log(`Установлена активная кампания: id=${id}, name=${name}`);
          set({ 
            selectedCampaign: { id, name },
            selectedCampaignId: id, 
            selectedCampaignName: name 
          });
        }
      },
      
      clearSelectedCampaign: () => {
        console.log('Очистка данных о выбранной кампании');
        localStorage.removeItem('selected_campaign_id');
        localStorage.removeItem('selected_campaign_name');
        set({ 
          selectedCampaign: null,
          selectedCampaignId: null, 
          selectedCampaignName: null 
        });
      }
    }),
    {
      name: 'campaign-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        selectedCampaign: state.selectedCampaign,
        selectedCampaignId: state.selectedCampaignId,
        selectedCampaignName: state.selectedCampaignName
      }),
    }
  )
);