import { useQuery } from '@tanstack/react-query';
import { Campaign } from '@shared/schema';

/**
 * Хук для получения списка кампаний пользователя
 */
export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Не удалось загрузить список кампаний');
      }
      const data = await response.json();
      return data.data;
    },
  });
}