import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";
import { useCampaignStore } from "@/lib/campaignStore"; // Используем общее хранилище
import { useAuthStore } from "@/lib/store"; // Импортируем хранилище авторизации
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WebsiteKeywordAnalyzer } from "@/components/WebsiteKeywordAnalyzer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Keywords() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Используем глобальное состояние кампании из общего хранилища
  const { selectedCampaignId, selectedCampaignName } = useCampaignStore();
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns');
      return response.data?.data || [];
    }
  });

  // Получаем ID выбранной кампании из глобального хранилища
  const campaignId = selectedCampaignId || "";
  const userId = useAuthStore(state => state.userId);
  const clearSelectedCampaign = useCampaignStore(state => state.clearSelectedCampaign);

  // Проверяем принадлежность кампании текущему пользователю
  useEffect(() => {
    const checkCampaignOwnership = async () => {
      if (selectedCampaignId && userId) {
        console.log("Проверка принадлежности кампании пользователю:", {campaignId: selectedCampaignId, userId});
        
        try {
          const response = await directusApi.get('/items/user_campaigns', {
            params: {
              filter: {
                id: { _eq: selectedCampaignId },
                user_id: { _eq: userId }
              }
            }
          });
          
          const campaignExists = response.data?.data && response.data.data.length > 0;
          
          if (!campaignExists) {

            toast({
              title: "Доступ ограничен",
              description: "Выбранная кампания недоступна или принадлежит другому пользователю",
              variant: "destructive"
            });
            clearSelectedCampaign();
          } else {
            console.log("Используем глобально выбранную кампанию:", selectedCampaignName);
          }
        } catch (error) {
          console.error("Ошибка при проверке кампании:", error);
          clearSelectedCampaign();
        }
      }
    };
    
    checkCampaignOwnership();
  }, [selectedCampaignId, userId, selectedCampaignName, clearSelectedCampaign]);

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const response = await directusApi.get('/items/campaign_keywords', {
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
    enabled: !!campaignId,
    // Добавляем параметр refetchOnMount, чтобы обновлять данные при переходе на страницу
    refetchOnMount: true,
    // Также добавляем небольшой интервал обновления данных
    staleTime: 10000 // 10 секунд
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      // Используем новый универсальный API endpoint для поиска ключевых слов
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch('/api/keywords/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keyword: searchQuery.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.key_missing) {
          toast({
            variant: "destructive",
            title: "Требуется API ключ",
            description: `API ключ ${data.service} не найден. Добавьте его в настройках профиля.`
          });
          return;
        }
        
        throw new Error(data.message || data.error || "Ошибка при поиске ключевых слов");
      }

      if (!data?.data?.keywords?.length) {
        toast({ 
          title: "Результаты",
          description: "Не найдено ключевых слов" 
        });
        return;
      }

      const formattedResults = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: parseInt(kw.trend) || 0,
        competition: parseInt(kw.competition || 0),
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
        description: error instanceof Error ? error.message : "Не удалось выполнить поиск"
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
    if (!selectedCampaignId || !campaignId) {
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
      let addedCount = 0;
      let skippedCount = 0;

      // Получаем существующие ключевые слова для проверки дубликатов
      const existingKeywordsResponse = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          fields: ['keyword']
        }
      });
      
      const existingKeywords = existingKeywordsResponse.data?.data || [];
      const existingKeywordsLower = existingKeywords.map(k => k.keyword.toLowerCase());

      for (const keyword of selectedKeywords) {
        // Проверка, существует ли ключевое слово (case-insensitive)
        if (existingKeywordsLower.includes(keyword.keyword.toLowerCase())) {
          console.log(`Ключевое слово "${keyword.keyword}" уже существует - пропускаем`);
          skippedCount++;
          continue;
        }

        const data = {
          keyword: keyword.keyword,
          campaign_id: campaignId,
          trend_score: keyword.trend,
          mentions_count: keyword.competition,
          date_created: now,
          last_checked: now
        };

        try {
          console.log(`[KEYWORDS-SEARCH] Сохраняем ключевое слово "${keyword.keyword}" в кампанию ${campaignId}:`, data);
          console.log(`[KEYWORDS-SEARCH] Используемый токен:`, localStorage.getItem('auth_token')?.substring(0, 20) + '...');
          const response = await directusApi.post('items/campaign_keywords', data);
          console.log(`[KEYWORDS-SEARCH] Успешно добавлено ключевое слово "${keyword.keyword}", ответ:`, response.data);
          addedCount++;
        } catch (err) {
          console.log(`[KEYWORDS-SEARCH] ПОЛНАЯ ОШИБКА для "${keyword.keyword}":`, {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            config: {
              url: err.config?.url,
              method: err.config?.method,
              headers: err.config?.headers
            }
          });
          
          // Проверяем, связана ли ошибка с дубликатом
          const errorMessage = err.response?.data?.errors?.[0]?.message || '';
          if (errorMessage.includes('Дубликат ключевого слова') || 
              errorMessage.includes('duplicate') || 
              errorMessage.includes('unique')) {
            console.log(`Ключевое слово "${keyword.keyword}" вызвало ошибку дубликата - пропускаем`);
            skippedCount++;
          } else {
            // Если это другая ошибка, пробрасываем её выше
            throw err;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
      setSearchResults([]);
      
      // Показываем более информативное сообщение
      let description = `Добавлено ${addedCount} ключевых слов`;
      if (skippedCount > 0) {
        description += `, пропущено ${skippedCount} дубликатов`;
      }
      
      toast({ 
        title: "Успешно",
        description: description
      });
    } catch (error) {
      console.error('Error saving keywords:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить некоторые ключевые слова"
      });
    }
  };

  // Получаем функцию выбора кампании из глобального хранилища
  const { setSelectedCampaign } = useCampaignStore();

  // Функция для обновления выбранной кампании
  const handleCampaignSelect = (campaignId: string) => {
    const campaign = campaigns?.find((c: Campaign) => String(c.id) === campaignId);
    if (campaign) {
      setSelectedCampaign(campaign.id, campaign.name);
    }
  };

  // Функция для обработки выбранных ключевых слов из анализатора сайта
  const handleWebsiteKeywordsSelected = async (selectedKeywords: any[]) => {
    if (!selectedCampaignId || !campaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Сначала выберите кампанию"
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Получаем существующие ключевые слова для проверки дубликатов
      const existingKeywordsResponse = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          fields: ['keyword']
        }
      });
      
      const existingKeywords = existingKeywordsResponse.data?.data || [];
      const existingKeywordsLower = existingKeywords.map(k => k.keyword.toLowerCase());
      
      // Добавляем выбранные ключевые слова в кампанию
      for (const keywordObj of selectedKeywords) {
        const keyword = typeof keywordObj === 'string' ? keywordObj : keywordObj.keyword;
        
        // Проверка, существует ли ключевое слово (case-insensitive)
        if (existingKeywordsLower.includes(keyword.toLowerCase())) {
          console.log(`Ключевое слово "${keyword}" уже существует - пропускаем`);
          skippedCount++;
          continue;
        }
        
        // Используем реальные значения метрик из анализа сайта
        const data = {
          keyword: keyword,
          campaign_id: campaignId,
          trend_score: typeof keywordObj === 'string' ? 500 : keywordObj.trend,
          mentions_count: typeof keywordObj === 'string' ? 50 : keywordObj.competition,
          date_created: now,
          last_checked: now
        };

        try {
          await directusApi.post('items/campaign_keywords', data);
          addedCount++;
        } catch (err) {
          // Проверяем, связана ли ошибка с дубликатом
          const errorMessage = err.response?.data?.errors?.[0]?.message || '';
          if (errorMessage.includes('Дубликат ключевого слова') || 
              errorMessage.includes('duplicate') || 
              errorMessage.includes('unique') || 
              errorMessage.includes('already exists')) {
            console.log(`Ключевое слово "${keyword}" вызвало ошибку дубликата - пропускаем`);
            skippedCount++;
          } else {
            // Если это другая ошибка, логируем ее и продолжаем с остальными ключевыми словами
            console.error(`Ошибка при добавлении ключевого слова "${keyword}":`, err);
            errorCount++;
          }
        }
      }

      // Обновляем данные в кэше
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
      
      // Создаем информативное сообщение 
      let message = "";
      let description = "";
      let variant: "default" | "destructive" | "secondary" = "default";
      
      if (addedCount > 0) {
        message = "Успешно";
        description = `Добавлено ${addedCount} ключевых слов`;
        
        if (skippedCount > 0) {
          description += `, пропущено ${skippedCount} дубликатов`;
        }
        
        if (errorCount > 0) {
          description += `. Не удалось добавить ${errorCount} ключевых слов`;
          variant = "secondary";
        }
      } else if (skippedCount > 0 && errorCount === 0) {
        message = "Информация";
        description = `Все ключевые слова (${skippedCount}) уже существуют в кампании`;
        variant = "secondary";
      } else if (errorCount > 0) {
        if (skippedCount > 0) {
          message = "Частичная ошибка";
          description = `Пропущено ${skippedCount} дубликатов. Не удалось добавить ${errorCount} ключевых слов`;
        } else {
          message = "Ошибка";
          description = `Не удалось добавить ключевые слова (${errorCount})`;
        }
        variant = "destructive";
      }
      
      toast({ 
        title: message,
        description: description,
        variant: variant
      });
    } catch (error) {
      console.error('Error saving website keywords:', error);
      
      // Проверяем, есть ли в ошибке информация о дубликатах
      const errorMessage = typeof error === 'object' && error !== null 
        ? (error.message || error.toString()) 
        : String(error);
      
      if (errorMessage.toLowerCase().includes('дубликат') || 
          errorMessage.toLowerCase().includes('duplicate') || 
          errorMessage.toLowerCase().includes('already exists')) {
        toast({
          variant: "secondary",
          title: "Дублирующиеся ключевые слова",
          description: "Некоторые ключевые слова уже существуют в кампании и были пропущены"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось сохранить ключевые слова"
        });
      }
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Ключевые слова</h1>
        <p className="text-muted-foreground mt-2">
          {selectedCampaignId && selectedCampaignName
            ? `Ключевые слова для кампании "${selectedCampaignName}"` 
            : "Выберите кампанию для управления ключевыми словами"}
        </p>
      </div>

      {!(selectedCampaignId && selectedCampaignName) && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="mb-4">Пожалуйста, выберите кампанию в селекторе в верхней части страницы</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCampaignId && selectedCampaignName && (
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Ключевые слова кампании</h2>
          </div>
          <KeywordTable
            keywords={keywords}
            searchResults={searchResults}
            isLoading={isLoadingCampaigns || isLoadingKeywords || isSearching}
            onDelete={async (id) => {
              try {
                await directusApi.delete(`items/campaign_keywords/${id}`);
                // Инвалидируем оба кеша для согласования данных между компонентами
                queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
                queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
                toast({ 
                  title: "Успешно",
                  description: "Ключевое слово удалено" 
                });
              } catch (error) {
                console.error("Ошибка при удалении ключевого слова:", error);
                toast({
                  variant: "destructive",
                  title: "Ошибка",
                  description: "Не удалось удалить ключевое слово"
                });
              } finally {
                // Гарантируем обновление всех компонентов, использующих ключевые слова
                queryClient.invalidateQueries({ queryKey: ["campaign_keywords", campaignId] });
                queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
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