import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCampaignStore } from "@/lib/campaignStore";
import { Loader2 } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description?: string;
}

export function CampaignSelector() {
  const { selectedCampaign, setSelectedCampaign } = useCampaignStore();
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Получаем список всех кампаний
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/campaigns'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/campaigns');
        if (!response.ok) {
          throw new Error('Не удалось загрузить кампании');
        }
        const data = await response.json();
        console.log("Loaded campaigns:", data);
        return data;
      } catch (error) {
        console.error("Error loading campaigns:", error);
        throw error;
      }
    }
  });

  // При первой загрузке, если кампания не выбрана, выбираем первую из списка
  useEffect(() => {
    if (campaigns?.data?.length > 0 && !selectedCampaign && isFirstLoad) {
      setSelectedCampaign(campaigns.data[0]);
      setIsFirstLoad(false);
    }
  }, [campaigns, selectedCampaign, setSelectedCampaign, isFirstLoad]);

  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaigns?.data?.find((c: Campaign) => c.id === campaignId);
    if (campaign) {
      setSelectedCampaign(campaign);
    }
  };

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
            value={selectedCampaign?.id || ''}
            onValueChange={handleCampaignChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {campaigns?.data?.map((campaign: Campaign) => (
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