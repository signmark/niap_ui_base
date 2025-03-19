import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { directusApi } from "@/lib/directus";
import { Search, Loader2 } from "lucide-react";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";

interface KeywordSelectorProps {
  campaignId: string;
}

export function KeywordSelector({ campaignId }: KeywordSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: { campaign_id: { _eq: campaignId } }
        }
      });
      return response.data?.data || [];
    },
    enabled: !!campaignId
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    // Получаем токен из состояния
    const auth = directusApi.defaults.headers.common['Authorization'];
    let authToken = '';
    
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      authToken = auth.substring(7);
      console.log('Got token from directusApi:', authToken.substring(0, 10) + '...');
    } else {
      // Пробуем получить из localStorage как запасной вариант
      authToken = localStorage.getItem('auth_token') || '';
      console.log('Got token from localStorage:', authToken ? (authToken.substring(0, 10) + '...') : 'нет токена');
    }
    
    if (!authToken) {
      toast({
        variant: "destructive",
        description: "Требуется авторизация. Пожалуйста, войдите в систему."
      });
      setIsSearching(false);
      return;
    }

    try {
      // Добавляем случайный параметр для предотвращения кеширования
      const nocache = Date.now();
      const response = await fetch(
        `/api/wordstat/${encodeURIComponent(searchQuery.trim())}?nocache=${nocache}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      // Проверка на ошибки авторизации или отсутствие API ключа
      if (response.status === 401) {
        toast({
          variant: "destructive",
          description: "Ошибка авторизации. Пожалуйста, войдите в систему заново."
        });
        setIsSearching(false);
        return;
      }
      
      if (response.status === 400) {
        const errorData = await response.json();
        if (errorData.key_missing && errorData.service === 'xmlriver') {
          toast({
            variant: "destructive",
            description: "Отсутствует API ключ XMLRiver. Пожалуйста, добавьте ключ в настройках."
          });
          setIsSearching(false);
          return;
        }
      }
      
      const data = await response.json();

      if (!data?.data?.keywords?.length) {
        toast({ description: "Не найдено ключевых слов" });
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
      toast({ description: `Найдено ${formattedResults.length} ключевых слов` });
    } catch (error) {
      toast({
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
    const selectedKeywords = searchResults.filter(kw => kw.selected);
    if (!selectedKeywords.length) {
      toast({
        variant: "destructive",
        description: "Выберите ключевые слова"
      });
      return;
    }

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      toast({
        variant: "destructive",
        description: "Требуется авторизация"
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

        console.log('Отправляем в Directus:', data);

        await directusApi.post('items/user_keywords', data);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      setSearchResults([]);
      toast({ description: "Ключевые слова добавлены" });
    } catch (error: any) {
      console.error('Error saving keywords:', error);
      toast({
        variant: "destructive",
        description: "Не удалось сохранить ключевые слова"
      });
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">
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

      <KeywordTable
        keywords={keywords}
        searchResults={searchResults}
        isLoading={isLoadingKeywords || isSearching}
        onDelete={async (id) => {
          try {
            await directusApi.delete(`items/user_keywords/${id}`);
            queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
            toast({ description: "Ключевое слово удалено" });
          } catch {
            toast({
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