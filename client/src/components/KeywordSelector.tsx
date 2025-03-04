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
  const { add } = useToast();

  // Закрытие результатов по клику вне компонента
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

    try {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(searchQuery.trim())}`);
      const data = await response.json();

      if (!data?.data?.keywords?.length) {
        add({ description: "Не найдено ключевых слов" });
        return;
      }

      const formattedResults = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: kw.trend,
        competition: kw.competition,
        selected: false
      }));

      setSearchResults(formattedResults);
      add({ description: `Найдено ${formattedResults.length} ключевых слов` });
    } catch (error) {
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
    const selectedKeywords = searchResults.filter(kw => kw.selected);
    if (!selectedKeywords.length) {
      add({
        variant: "destructive",
        description: "Выберите ключевые слова"
      });
      return;
    }

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      add({
        variant: "destructive",
        description: "Требуется авторизация"
      });
      return;
    }

    try {
      // Добавляем отладочный вывод
      console.log('Отправляемые ключевые слова:', selectedKeywords);

      for (const keyword of selectedKeywords) {
        const data = {
          keyword: keyword.keyword,
          campaign_id: campaignId,
          trend_score: Number(keyword.trend),
          mentions_count: Number(keyword.competition)
        };

        console.log('Отправляем в Directus:', data);

        await directusApi.post('/items/user_keywords', data, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      setSearchResults([]);
      add({ description: "Ключевые слова добавлены" });
    } catch (error: any) {
      console.error('Error saving keywords:', error);
      console.error('Response data:', error.response?.data);

      add({
        variant: "destructive",
        description: error.response?.data?.errors?.[0]?.message || "Не удалось сохранить ключевые слова"
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
            await directusApi.delete(`/items/user_keywords/${id}`);
            queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
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