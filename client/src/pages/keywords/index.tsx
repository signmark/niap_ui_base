import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
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
      console.log('Searching sources for keywords:', keywords);
      const response = await fetch(`/api/sources/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ keywords })
      });

      if (!response.ok) {
        throw new Error("Ошибка при поиске источников");
      }

      const data = await response.json();
      console.log('Search response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Search sources response:', data);

      // Проверяем наличие источников в ответе
      if (data.sources) {
        // Создаем один результат со всеми найденными источниками
        const result = {
          keyword: "Все найденные источники",
          trend: 0,
          competition: 0,
          sources: data.sources.sort((a: any, b: any) => (b.followers || 0) - (a.followers || 0))
        };

        console.log('Setting search results:', result);
        setSearchResults([result]);

        toast({
          description: `Найдено ${data.sources.length} источников`
        });
      } else {
        setSearchResults([]);
        toast({
          description: "Источники не найдены",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      console.error('Search sources error:', error);
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
  };

  const handleSearch = () => {
    if (!selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty") {
      toast({
        description: "Выберите кампанию для поиска источников",
        variant: "destructive"
      });
      return;
    }

    const keywords = existingKeywords?.map(k => k.keyword) || [];
    if (keywords.length > 0) {
      console.log(`Starting search for ${keywords.length} keywords from campaign`);
      searchSources(keywords);
    } else {
      toast({
        description: "В кампании нет ключевых слов для поиска",
        variant: "destructive"
      });
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
          <div className="flex gap-4 items-center">
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
                      value={String(campaign.id)}
                    >
                      {campaign.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSearch}
              disabled={isSearching || !selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty"}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Найти источники
                </>
              )}
            </Button>
          </div>
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