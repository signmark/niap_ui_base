import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // Исправлен импорт
import { directusApi } from "@/lib/directus";
import { Search, Loader2 } from "lucide-react";
import { KeywordTable } from "@/components/KeywordTable";

interface KeywordSelectorProps {
  campaignId: string;
}

export function KeywordSelector({ campaignId }: KeywordSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast(); // Правильное использование хука

  // Обработчик клика вне компонента
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSearchResults([]); // Очищаем результаты поиска
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!campaignId
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    fetch(`/api/wordstat/${encodeURIComponent(searchQuery)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error("Ошибка при поиске ключевых слов");
        }
        return response.json();
      })
      .then(rawData => {
        console.log("Raw API Response:", rawData);
        if (!rawData?.data?.keywords) {
          throw new Error("Некорректный формат данных от API");
        }

        const keywords = rawData.data.keywords;
        console.log("Extracted keywords:", keywords);

        const formattedResults = keywords.map((kw: any) => ({
          keyword: kw.keyword,
          trend: kw.trend,
          competition: kw.competition,
          selected: false
        }));
        console.log("Formatted results:", formattedResults);

        setSearchResults(formattedResults);
        toast({
          description: `Найдено ${formattedResults.length} ключевых слов`
        });
      })
      .catch((error) => {
        console.error("Search error:", error);
        toast({
          variant: "destructive",
          description: error.message || "Ошибка при поиске ключевых слов"
        });
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
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

  const handleSaveSelected = () => {
    const selectedKeywords = searchResults.filter(kw => kw.selected);
    if (selectedKeywords.length === 0) {
      toast({
        variant: "destructive",
        description: "Выберите хотя бы одно ключевое слово"
      });
      return;
    }

    Promise.all(selectedKeywords.map(keyword =>
      directusApi.post('/items/user_keywords', {
        campaign_id: campaignId,
        keyword: keyword.keyword,
        trend_score: keyword.trend,
        mentions_count: keyword.competition
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
    ))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
        setSearchResults([]); // Очищаем результаты после успешного сохранения
        toast({
          description: "Ключевые слова добавлены"
        });
      })
      .catch(() => {
        toast({
          variant: "destructive",
          description: "Не удалось добавить ключевые слова"
        });
      });
  };

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Введите запрос для поиска ключевых слов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
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
        onDelete={id => {
          directusApi.delete(`/items/user_keywords/${id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
            toast({
              description: "Ключевое слово удалено"
            });
          }).catch(() => {
            toast({
              variant: "destructive",
              description: "Не удалось удалить ключевое слово"
            });
          });
        }}
        onKeywordToggle={handleKeywordToggle}
        onSelectAll={handleSelectAll}
        onSaveSelected={handleSaveSelected}
      />
    </div>
  );
}