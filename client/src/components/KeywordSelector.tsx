import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface KeywordSelectorProps {
  campaignId: string;
}

interface KeywordResult {
  keyword: string;
  trend: number;
  selected: boolean;
}

export function KeywordSelector({ campaignId }: KeywordSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KeywordResult[]>([]);
  const { add: toast } = useToast();
  const queryClient = useQueryClient();

  // Обновленный запрос для получения существующих ключевых слов
  const { data: existingKeywords, isLoading: isLoadingKeywords, refetch: refetchKeywords } = useQuery({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      try {
        const response = await directusApi.get(`/items/user_keywords`, {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              }
            }
          }
        });
        console.log("Fetched keywords:", response.data?.data);
        return response.data?.data || [];
      } catch (error) {
        console.error("Error fetching keywords:", error);
        throw new Error("Не удалось загрузить ключевые слова");
      }
    }
  });

  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Ошибка при поиске ключевых слов");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      if (!data.data || !Array.isArray(data.data.keywords)) {
        throw new Error("Некорректный формат данных от API");
      }

      const results = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: kw.trend,
        selected: false
      }));

      setSearchResults(results);
      toast({
        description: "Ключевые слова найдены"
      });
    },
    onError: (error: Error) => {
      toast({
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Обновленная мутация для сохранения ключевых слов
  const { mutate: saveKeywords, isPending: isSaving } = useMutation({
    mutationFn: async (selectedKeywords: KeywordResult[]) => {
      console.log("Saving keywords:", selectedKeywords);
      const promises = selectedKeywords.map(keyword =>
        directusApi.post('/items/user_keywords', {
          campaign_id: campaignId,
          keyword: keyword.keyword,
          trend_score: keyword.trend,
          mentions_count: 0,
          last_checked: new Date().toISOString()
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        description: "Ключевые слова сохранены"
      });
      setSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
    },
    onError: (error) => {
      console.error("Error saving keywords:", error);
      toast({
        description: "Не удалось сохранить ключевые слова",
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchKeywords(searchQuery);
  };

  const handleKeywordToggle = (index: number) => {
    setSearchResults(prev =>
      prev.map((kw, i) =>
        i === index ? { ...kw, selected: !kw.selected } : kw
      )
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
    console.log("Saving selected keywords:", selectedKeywords);
    saveKeywords(selectedKeywords);
  };

  const handleDelete = async (keywordId: string) => {
    if (confirm("Вы уверены, что хотите удалить это ключевое слово?")) {
      try {
        await directusApi.delete(`/items/user_keywords/${keywordId}`);
        toast({
          description: "Ключевое слово удалено"
        });
        refetchKeywords();
      } catch (error) {
        console.error("Error deleting keyword:", error);
        toast({
          description: "Не удалось удалить ключевое слово",
          variant: "destructive"
        });
      }
    }
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
            "Искать"
          )}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveSelected}
            disabled={isSaving || searchResults.every(kw => !kw.selected)}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Добавить выбранные ({searchResults.filter(kw => kw.selected).length})
              </>
            )}
          </Button>
        </div>
      )}

      {searchResults.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Ключевое слово</TableHead>
              <TableHead>Тренд</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isLoadingKeywords ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : existingKeywords && existingKeywords.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mt-8 mb-4">Сохраненные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeywords.map((keyword: any) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend_score}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(keyword.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}