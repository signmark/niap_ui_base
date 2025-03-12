import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";
import { useCampaignStore } from "@/lib/campaignStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WebsiteKeywordAnalyzer } from "@/components/WebsiteKeywordAnalyzer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Keywords() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCampaign } = useCampaignStore();
  // Используем глобальное состояние кампании
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns');
      return response.data?.data || [];
    }
  });

  // Получаем ID выбранной кампании из глобального хранилища
  const campaignId = selectedCampaign?.id || "";

  // Используем useEffect для обработки изменений глобальной кампании
  useEffect(() => {
    if (selectedCampaign) {
      console.log("Используем глобально выбранную кампанию:", selectedCampaign.name);
    }
  }, [selectedCampaign]);

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        }
      });
      return response.data?.data || [];
    },
    enabled: !!campaignId
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      // Добавляем случайный параметр для предотвращения кеширования
      const nocache = Date.now();
      const response = await fetch(`/api/wordstat/${encodeURIComponent(searchQuery.trim())}?nocache=${nocache}`);
      if (!response.ok) {
        throw new Error("Ошибка при поиске ключевых слов");
      }

      const data = await response.json();
      if (!data?.data?.keywords?.length) {
        toast({ 
          title: "Результаты",
          description: "Не найдено ключевых слов" 
        });
        return;
      }

      const formattedResults = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: parseInt(kw.trend),
        competition: parseInt(kw.competition),
        selected: false
      }));

      setSearchResults(formattedResults);
      setSearchQuery(""); // Очищаем поле поиска после получения результатов
      toast({ 
        title: "Успешно",
        description: `Найдено ${formattedResults.length} ключевых слов` 
      });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
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
    if (!selectedCampaign || !campaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите кампанию"
      });
      return;
    }

    const selectedKeywords = searchResults.filter(kw => kw.selected);
    if (!selectedKeywords.length) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите ключевые слова"
      });
      return;
    }

    try {
      const now = new Date().toISOString();

      for (const keyword of selectedKeywords) {
        const data = {
          keyword: keyword.keyword,
          campaign_id: campaignId,
          trend_score: keyword.trend,
          mentions_count: keyword.competition,
          date_created: now,
          last_checked: now
        };

        await directusApi.post('items/user_keywords', data);
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
      setSearchResults([]);
      toast({ 
        title: "Успешно",
        description: "Ключевые слова добавлены" 
      });
    } catch (error) {
      console.error('Error saving keywords:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить ключевые слова"
      });
    }
  };

  // Получаем setSelectedCampaign из глобального хранилища
  const { setSelectedCampaign } = useCampaignStore();

  // Функция для обновления выбранной кампании
  const handleCampaignSelect = (campaignId: string) => {
    const campaign = campaigns?.find((c: Campaign) => String(c.id) === campaignId);
    if (campaign) {
      setSelectedCampaign(campaign);
    }
  };

  // Функция для обработки выбранных ключевых слов из анализатора сайта
  const handleWebsiteKeywordsSelected = async (selectedKeywords: string[]) => {
    if (!selectedCampaign || !campaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Сначала выберите кампанию"
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      
      // Добавляем выбранные ключевые слова в кампанию
      for (const keyword of selectedKeywords) {
        // Используем значения по умолчанию для trend_score и mentions_count
        const data = {
          keyword: keyword,
          campaign_id: campaignId,
          trend_score: 500, // Усредненное значение
          mentions_count: 50, // Усредненное значение
          date_created: now,
          last_checked: now
        };

        await directusApi.post('items/user_keywords', data);
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
      toast({ 
        title: "Успешно",
        description: `${selectedKeywords.length} ключевых слов добавлено в кампанию` 
      });
    } catch (error) {
      console.error('Error saving website keywords:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить ключевые слова"
      });
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Ключевые слова</h1>
        <p className="text-muted-foreground mt-2">
          {selectedCampaign 
            ? `Ключевые слова для кампании "${selectedCampaign.name}"` 
            : "Выберите кампанию для управления ключевыми словами"}
        </p>
      </div>

      {!selectedCampaign && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="mb-4">Пожалуйста, выберите кампанию в селекторе в верхней части страницы</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCampaign && (
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="search">Поиск ключевых слов</TabsTrigger>
            <TabsTrigger value="website">Анализ сайта</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search">
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
          </TabsContent>
          
          <TabsContent value="website">
            <WebsiteKeywordAnalyzer 
              campaignId={campaignId} 
              onKeywordsSelected={handleWebsiteKeywordsSelected}
            />
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Ключевые слова кампании</h2>
          <KeywordTable
            keywords={keywords}
            searchResults={searchResults}
            isLoading={isLoadingCampaigns || isLoadingKeywords || isSearching}
            onDelete={async (id) => {
              try {
                await directusApi.delete(`items/user_keywords/${id}`);
                queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
                toast({ 
                  title: "Успешно",
                  description: "Ключевое слово удалено" 
                });
              } catch {
                toast({
                  variant: "destructive",
                  title: "Ошибка",
                  description: "Не удалось удалить ключевое слово"
                });
              }
            }}
            onKeywordToggle={handleKeywordToggle}
            onSelectAll={handleSelectAll}
            onSaveSelected={handleSaveSelected}
          />
        </CardContent>
      </Card>
    </div>
  );
}