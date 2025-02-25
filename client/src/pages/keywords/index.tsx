import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, KeywordSearchResult } from "@shared/schema";
import { useAuthStore } from "@/lib/store";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchResults, setSearchResults] = useState<KeywordSearchResult[]>([]);
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  // Получаем список кампаний пользователя
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await apiRequest('/api/campaigns');
      return response;
    }
  });

  // Получаем существующие ключевые слова кампании
  const { data: existingKeywords, isLoading: isLoadingKeywords, refetch: refetchKeywords } = useQuery({
    queryKey: ["/api/keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const response = await apiRequest(`/api/campaigns/${selectedCampaign}/keywords`);
      return response;
    },
    enabled: !!selectedCampaign && selectedCampaign !== "loading" && selectedCampaign !== "empty"
  });

  // Поиск ключевых слов
  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (keyword: string) => {
      const response = await apiRequest(`/api/wordstat/${encodeURIComponent(keyword)}`);
      if (!response?.data?.keywords) throw new Error("Не удалось найти ключевые слова");
      return response;
    },
    onSuccess: (data) => {
      if (data?.data?.keywords && Array.isArray(data.data.keywords)) {
        const formattedKeywords: KeywordSearchResult[] = data.data.keywords.map((item: any) => ({
          keyword: item.keyword,
          trendScore: item.trend || 0,
          mentionsCount: item.competition || 0
        }));
        setSearchResults(formattedKeywords);
        toast({ description: "Ключевые слова найдены" });
      } else {
        setSearchResults([]);
        toast({ description: "Ключевые слова не найдены", variant: "destructive" });
      }
    },
    onError: () => {
      toast({
        description: "Не удалось найти ключевые слова",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchTerm || !selectedCampaign) return;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Ключевые слова</h1>
        <p className="text-muted-foreground mt-2">
          Выберите кампанию и найдите релевантные ключевые слова
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-4">
            <Select 
              value={selectedCampaign} 
              onValueChange={(value) => {
                setSelectedCampaign(value);
                setSearchResults([]);
              }}
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
          </div>

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
              disabled={isSearching || !searchTerm || !isValidCampaignSelected}
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

      <KeywordTable 
        keywords={searchResults}
        existingKeywords={existingKeywords || []}
        isLoading={isLoadingKeywords || isSearching}
        campaignId={selectedCampaign}
        onKeywordsUpdated={refetchKeywords}
      />
    </div>
  );
}