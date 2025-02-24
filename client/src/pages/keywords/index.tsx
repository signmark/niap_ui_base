import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import type { Keyword, KeywordSearchResult, WordStatResponse } from "@shared/schema";
import { useAuthStore } from "@/lib/store";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchResults, setSearchResults] = useState<KeywordSearchResult[]>([]);
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  // Получаем список кампаний пользователя
  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns", userId],
    queryFn: async () => {
      const response = await directusApi.get("/items/user_campaigns", {
        params: {
          filter: {
            user_id: {
              _eq: userId
            }
          }
        }
      });
      return response.data?.data || [];
    }
  });

  // Получаем существующие ключевые слова кампании
  const { data: existingKeywords, isLoading: isLoadingKeywords, refetch: refetchKeywords } = useQuery({
    queryKey: ["/api/keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const response = await directusApi.get("/items/user_keywords", {
        params: {
          filter: {
            campaign_id: {
              _eq: selectedCampaign
            }
          }
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaign
  });

  // Поиск ключевых слов
  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (keyword: string) => {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(keyword)}`);
      if (!response.ok) throw new Error("Не удалось найти ключевые слова");
      const data = await response.json() as WordStatResponse;
      return data;
    },
    onSuccess: (data) => {
      if (data?.data?.keywords && Array.isArray(data.data.keywords)) {
        const formattedKeywords: KeywordSearchResult[] = data.data.keywords.map((item) => ({
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
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
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
              disabled={isSearching || !searchTerm || !selectedCampaign}
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