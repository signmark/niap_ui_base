import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2, Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface KeywordSelectorProps {
  campaignId: string;
}

export function KeywordSelector({ campaignId }: KeywordSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { add: toast } = useToast();
  const queryClient = useQueryClient();

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
        if (!Array.isArray(data.processed_keywords)) {
          throw new Error("Некорректный формат данных от API");
        }
        const processedKeywords = data.processed_keywords.map((kw: any) => ({
          keyword: kw.keyword,
          trend: kw.trend,
          competition: kw.competition,
          selected: false
        }));
        setSearchResults(processedKeywords);
        toast({
          description: `Найдено ${processedKeywords.length} ключевых слов`
        });
      })
      .catch(error => {
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
      prev.map((kw, i) =>
        i === index ? { ...kw, selected: !kw.selected } : kw
      )
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSearchResults(prev =>
      prev.map(kw => ({ ...kw, selected: checked }))
    );
  };

  const handleSaveSelected = () => {
    const selectedKeywords = searchResults.filter(kw => kw.selected);

    if (selectedKeywords.length === 0) {
      toast({
        description: "Выберите хотя бы одно ключевое слово",
        variant: "destructive"
      });
      return;
    }

    selectedKeywords.forEach(keyword => {
      directusApi.post('/items/user_keywords', {
        campaign_id: campaignId,
        keyword: keyword.keyword,
        trend_score: keyword.trend,
        mentions_count: keyword.competition
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
        setSearchResults([]);
        toast({
          description: "Ключевые слова добавлены"
        });
      }).catch(() => {
        toast({
          variant: "destructive",
          description: "Не удалось добавить ключевые слова"
        });
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

      {keywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Добавленные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((keyword: any) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend_score}</TableCell>
                  <TableCell>{keyword.mentions_count}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeyword(keyword.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {searchResults.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Результаты поиска</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={searchResults.every(kw => kw.selected)}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm">
                  Выбрать все
                </label>
              </div>
              <Button
                onClick={handleSaveSelected}
                disabled={!searchResults.some(kw => kw.selected)}
              >
                Добавить выбранные ({searchResults.filter(kw => kw.selected).length})
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((keyword, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox
                      checked={keyword.selected}
                      onCheckedChange={() => handleKeywordToggle(index)}
                    />
                  </TableCell>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend}</TableCell>
                  <TableCell>{keyword.competition}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {isLoadingKeywords && (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
}