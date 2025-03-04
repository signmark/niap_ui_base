import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  const { add: toast } = useToast();

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!campaignId
  });

  const { mutate: deleteKeyword } = useMutation({
    mutationFn: async (keywordId: string) => {
      await directusApi.delete(`/items/user_keywords/${keywordId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
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

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    fetch(`/api/wordstat/${encodeURIComponent(searchQuery)}`)
      .then(response => response.json())
      .then(data => {
        const processedKeywords = data?.processed_keywords || [];
        setSearchResults(processedKeywords.map((kw: any) => ({
          keyword: kw.keyword,
          trend: kw.trend,
          competition: kw.competition,
          selected: false
        })));
        toast({
          description: `Найдено ${processedKeywords.length} ключевых слов`
        });
      })
      .catch((error) => {
        console.error("Search error:", error);
        toast({
          variant: "destructive",
          description: "Ошибка при поиске ключевых слов"
        });
      })
      .finally(() => {
        setIsSearching(false);
      });
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
        setSearchResults([]);
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
    <div className="space-y-4">
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
        onDelete={deleteKeyword}
        onKeywordToggle={handleKeywordToggle}
        onSelectAll={handleSelectAll}
        onSaveSelected={handleSaveSelected}
      />
    </div>
  );
}