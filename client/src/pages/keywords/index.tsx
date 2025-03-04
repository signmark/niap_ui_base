import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";

export default function Keywords() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]); 
  const [isSearching, setIsSearching] = useState(false);
  const { add: toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return await response.json();
    }
  });

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
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
    enabled: !!selectedCampaign
  });

  const { mutate: deleteKeyword } = useMutation({
    mutationFn: async (keywordId: string) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      await directusApi.delete(`/items/user_keywords/${keywordId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", selectedCampaign] });
      toast({
        description: "Ключевое слово удалено"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Не удалось удалить ключевое слово"
      });
    }
  });

  const { mutate: addKeyword } = useMutation({
    mutationFn: async (keyword: any) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      await directusApi.post('/items/user_keywords', {
        campaign_id: selectedCampaign,
        keyword: keyword.keyword,
        trend_score: keyword.trend,
        mentions_count: 0
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", selectedCampaign] });
      toast({
        description: "Ключевое слово добавлено"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Не удалось добавить ключевое слово"
      });
    }
  });

  const { mutate: searchKeywords } = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Ошибка при поиске ключевых слов");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      console.log("Search response:", data);
      if (!data?.content?.includingPhrases?.items) {
        throw new Error("Некорректный формат данных от API");
      }

      const keywords = data.content.includingPhrases.items.map((item: any) => ({
        keyword: item.phrase,
        trend: parseInt(item.number.replace(/,/g, ''), 10) || 0
      }));

      setSearchResults(keywords);
      setIsSearching(false);
      toast({
        description: "Найдены ключевые слова"
      });
    },
    onError: (error: Error) => {
      console.error("Search error:", error);
      setIsSearching(false);
      toast({
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    searchKeywords(searchQuery);
  };

  return (
    <div className="space-y-4 p-6">
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
                    value={String(campaign.id)}
                  >
                    {campaign.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCampaign && (
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-2">
              <Input
                placeholder="Введите запрос для поиска ключевых слов"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
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
      )}

      <KeywordTable
        keywords={keywords}
        searchResults={searchResults}
        isLoading={isLoadingCampaigns || isLoadingKeywords || isSearching}
        onDelete={deleteKeyword}
        onAdd={addKeyword}
      />
    </div>
  );
}