import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";

export default function Keywords() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { add: toast } = useToast();
  const queryClient = useQueryClient();

  // Получаем список кампаний пользователя
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await directusApi.get('/items/user_campaigns', {
        params: {
          fields: ['id', 'name', 'description']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    }
  });

  // Получаем существующие ключевые слова кампании
  const { data: existingKeywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty") return [];

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: selectedCampaign
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaign && selectedCampaign !== "loading" && selectedCampaign !== "empty"
  });

  // Поиск источников для всех ключевых слов кампании
  const { mutate: searchSources, isPending: isSearching } = useMutation({
    mutationFn: async (keywords: string[]) => {
      const response = await fetch(`/api/sources/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка при поиске источников");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // Map API response to the format KeywordTable expects
      const results = [{
        keyword: "Найденные источники",
        trend: 0,
        competition: 0,
        sources: data.sources || []
      }];

      setSearchResults(results);
      toast({
        description: data.sources?.length ? 
          `Найдено ${data.sources.length} источников` :
          "Источники не найдены"
      });
    },
    onError: (error: Error) => {
      setSearchResults([]);
      toast({
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
    setSearchResults([]);

    // Если выбрана кампания, запускаем поиск по всем её ключевым словам
    if (value && value !== "loading" && value !== "empty") {
      const keywords = existingKeywords?.map(k => k.keyword) || [];
      if (keywords.length > 0) {
        searchSources(keywords);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Источники</h1>
        <p className="text-muted-foreground mt-2">
          Выберите кампанию для поиска источников по её ключевым словам
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Select 
            value={selectedCampaign} 
            onValueChange={handleCampaignChange}
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
                    value={campaign.id}
                  >
                    {campaign.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <KeywordTable 
        keywords={searchResults}
        existingKeywords={existingKeywords || []}
        isLoading={isLoadingKeywords || isSearching}
        campaignId={selectedCampaign}
        onKeywordsUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaign] });
        }}
      />
    </div>
  );
}