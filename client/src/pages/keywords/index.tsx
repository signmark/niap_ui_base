import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { add } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns');
      return response.data?.data || [];
    }
  });

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const response = await directusApi.get('/items/user_keywords', {
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(searchQuery.trim())}`);
      if (!response.ok) {
        throw new Error("Ошибка при поиске ключевых слов");
      }

      const data = await response.json();
      if (!data?.data?.keywords?.length) {
        add({ description: "Не найдено ключевых слов" });
        return;
      }

      const formattedResults = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: parseInt(kw.trend),
        competition: parseInt(kw.competition),
        selected: false
      }));

      setSearchResults(formattedResults);
      add({ description: `Найдено ${formattedResults.length} ключевых слов` });
    } catch (error) {
      console.error("Search error:", error);
      add({
        variant: "destructive",
        description: "Не удалось выполнить поиск"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeywordToggle = (index: number) => {
    setSearchResults(prev =>
      prev.map((kw, i) => i === index ? { ...kw, selected: !kw.selected } : kw)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSearchResults(prev => prev.map(kw => ({ ...kw, selected: checked })));
  };

  const handleSaveSelected = async () => {
    if (!selectedCampaign) {
      add({
        variant: "destructive",
        description: "Выберите кампанию"
      });
      return;
    }

    const selectedKeywords = searchResults.filter(kw => kw.selected);
    if (!selectedKeywords.length) {
      add({
        variant: "destructive",
        description: "Выберите ключевые слова"
      });
      return;
    }

    try {
      const now = new Date().toISOString();

      for (const keyword of selectedKeywords) {
        const data = {
          keyword: keyword.keyword,
          campaign_id: selectedCampaign,
          trend_score: keyword.trend,
          mentions_count: keyword.competition,
          date_created: now,
          last_checked: now
        };

        await directusApi.post('items/user_keywords', data);
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", selectedCampaign] });
      setSearchResults([]);
      add({ description: "Ключевые слова добавлены" });
    } catch (error) {
      console.error('Error saving keywords:', error);
      add({
        variant: "destructive",
        description: "Не удалось сохранить ключевые слова"
      });
    }
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
        onDelete={async (id) => {
          try {
            await directusApi.delete(`items/user_keywords/${id}`);
            queryClient.invalidateQueries({ queryKey: ["campaign_keywords", selectedCampaign] });
            add({ description: "Ключевое слово удалено" });
          } catch {
            add({
              variant: "destructive",
              description: "Не удалось удалить ключевое слово"
            });
          }
        }}
        onKeywordToggle={handleKeywordToggle}
        onSelectAll={handleSelectAll}
        onSaveSelected={handleSaveSelected}
      />
    </div>
  );
}