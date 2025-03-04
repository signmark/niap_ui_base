import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
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

  // Поиск ключевых слов через API
  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/sources/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords: [query]
        })
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
        keyword: searchTerm,
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

  const handleSearch = () => {
    if (!searchTerm) return;
    searchKeywords(searchTerm);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Валидируем выбранную кампанию
  const isValidCampaignSelected = selectedCampaign && 
    selectedCampaign !== "loading" && 
    selectedCampaign !== "empty";

  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
    setSearchResults([]);
    setSearchTerm("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Ключевые слова</h1>
        <p className="text-muted-foreground mt-2">
          Найдите релевантные источники по ключевым словам
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Input
              placeholder="Введите ключевое слово для поиска"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchTerm}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Искать
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <Select 
              value={selectedCampaign} 
              onValueChange={handleCampaignChange}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Выберите кампанию для добавления" />
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
      )}

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