import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCampaignStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

// Интерфейс для кампании
export interface Campaign {
  id: string;
  name: string;
  description?: string;
}

export function CampaignSelector() {
  const { selectedCampaignId, selectedCampaignName, setSelectedCampaign } = useCampaignStore();
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  const userId = useAuthStore((state) => state.userId);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Получаем список всех кампаний
  const { data: campaignsResponse, isLoading, isError, error } = useQuery({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error('Отсутствует токен авторизации');
        }

        const response = await fetch('/api/campaigns', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': userId || ''
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Требуется авторизация. Пожалуйста, войдите снова.');
          }
          throw new Error(`Не удалось загрузить кампании (${response.status})`);
        }

        const data = await response.json();
        console.log("Campaigns loaded:", data.data ? data.data.length : 0);
        return data;
      } catch (error) {
        console.error("Error loading campaigns:", error);
        throw error;
      }
    },
    enabled: !!userId, // Запрос активен только если есть userId
    refetchOnWindowFocus: false,
    retry: 1
  });

  // При первой загрузке, проверяем:
  // 1. Если есть сохранённая кампания в сторе, пропускаем авто-выбор
  // 2. Если нет, выбираем первую из списка
  useEffect(() => {
    if (campaignsResponse?.data?.length > 0 && isFirstLoad) {
      // Если кампания уже выбрана в сторе, просто завершаем первичную загрузку
      if (selectedCampaignId) {
        console.log(`Используем глобально выбранную кампанию: "${selectedCampaignName}"`);
        setIsFirstLoad(false);
        return;
      }
      
      // Если нет, выбираем первую из списка
      const firstCampaign = campaignsResponse.data[0];
      console.log(`Auto-selected campaign: "${firstCampaign.name}"`);
      setSelectedCampaign(firstCampaign.id, firstCampaign.name);
      setIsFirstLoad(false);
    }
  }, [campaignsResponse, selectedCampaignId, selectedCampaignName, setSelectedCampaign, isFirstLoad]);

  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaignsResponse?.data?.find((c: Campaign) => c.id === campaignId);
    if (campaign) {
      console.log(`Manually selected campaign: "${campaign.name}"`);
      setSelectedCampaign(campaign.id, campaign.name);
    }
  };

  if (isError) {
    return (
      <div className="flex items-center text-red-500">
        <span className="text-sm">Ошибка: {error instanceof Error ? error.message : 'Не удалось загрузить кампании'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <span className="mr-2 text-sm font-medium">Кампания:</span>
      <div className="w-[250px]">
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Загрузка кампаний...</span>
          </div>
        ) : (
          <Select
            value={selectedCampaignId || undefined}
            onValueChange={handleCampaignChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {campaignsResponse?.data?.map((campaign: Campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}