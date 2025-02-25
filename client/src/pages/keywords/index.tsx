import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordList } from "@/components/KeywordList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { useAuthStore } from "@/lib/store";

export default function Keywords() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const userId = useAuthStore((state) => state.userId);

  // Получаем список кампаний пользователя
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await apiRequest('/api/campaigns');
      return response;
    }
  });

  // Валидируем выбранную кампанию
  const isValidCampaignSelected = selectedCampaign && 
    selectedCampaign !== "loading" && 
    selectedCampaign !== "empty";

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Ключевые слова</h1>
        <p className="text-muted-foreground mt-2">
          Выберите кампанию для управления ключевыми словами
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Select 
            value={selectedCampaign} 
            onValueChange={setSelectedCampaign}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCampaigns ? (
                <SelectItem value="loading">Загрузка...</SelectItem>
              ) : !campaigns || campaigns.length === 0 ? (
                <SelectItem value="empty">Нет доступных кампаний</SelectItem>
              ) : (
                campaigns.map((campaign: Campaign) => (
                  <SelectItem 
                    key={campaign.id} 
                    value={campaign.id.toString()}
                  >
                    {campaign.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isValidCampaignSelected && (
        <KeywordList campaignId={selectedCampaign} />
      )}
    </div>
  );
}