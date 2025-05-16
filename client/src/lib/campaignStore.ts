import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { queryClient } from '@/lib/queryClient';

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
  
  // Список ID удаленных кампаний
  deletedCampaignIds: string[];
  
  // Функции для изменения состояния
  setSelectedCampaign: (campaignIdOrObj: string | Campaign | null, name?: string) => void;
  clearSelectedCampaign: () => void;
  markCampaignAsDeleted: (id: string) => void; // Новая функция для отметки удаленных кампаний
  isDeleted: (id: string) => boolean; // Проверка, была ли кампания удалена
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      // Начальные значения
      selectedCampaign: null,
      selectedCampaignId: localStorage.getItem('selected_campaign_id') || null,
      selectedCampaignName: localStorage.getItem('selected_campaign_name') || null,
      deletedCampaignIds: [], // Инициализируем пустым массивом
      
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
          
          // Проверяем, не удалена ли кампания
          const { isDeleted } = get();
          if (isDeleted(campaign.id)) {
            console.log(`Попытка выбрать удаленную кампанию: ${campaign.id}`);
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
          
          // Проверяем, не удалена ли кампания
          const { isDeleted } = get();
          if (isDeleted(id)) {
            console.log(`Попытка выбрать удаленную кампанию: ${id}`);
            return;
          }
          
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
      },
      
      // Новая функция для отметки кампании как удаленной
      markCampaignAsDeleted: (id: string) => {
        console.log(`Кампания ${id} помечена как удаленная`);
        const { deletedCampaignIds, selectedCampaignId } = get();
        
        // Добавляем ID в список удаленных
        const newDeletedIds = [...deletedCampaignIds, id];
        set({ deletedCampaignIds: newDeletedIds });
        
        // Если удаленная кампания была выбрана, сбрасываем выбор
        if (selectedCampaignId === id) {
          console.log('Сброс выбранной кампании, так как она была удалена');
          localStorage.removeItem('selected_campaign_id');
          localStorage.removeItem('selected_campaign_name');
          set({
            selectedCampaign: null,
            selectedCampaignId: null,
            selectedCampaignName: null
          });
        }
        
        // Обновляем данные в кэше запросов React Query
        try {
          const userId = localStorage.getItem('user_id');
          
          // Попытка обновить кэш запросов
          queryClient.setQueryData(['/api/campaigns', userId], (oldData: any) => {
            if (!oldData || !oldData.data) return oldData;
            
            console.log('Удаляем кампанию из кэша React Query:', id);
            return {
              ...oldData,
              data: oldData.data.filter((campaign: any) => campaign.id !== id)
            };
          });
          
          // Также обновляем альтернативный ключ запроса без userId
          queryClient.setQueryData(['/api/campaigns'], (oldData: any) => {
            if (!oldData || !oldData.data) return oldData;
            
            return {
              ...oldData,
              data: oldData.data.filter((campaign: any) => campaign.id !== id)
            };
          });
        } catch (err) {
          console.error('Ошибка при обновлении кэша React Query:', err);
        }
      },
      
      // Функция для проверки, удалена ли кампания
      isDeleted: (id: string) => {
        return get().deletedCampaignIds.includes(id);
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