import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Keyword } from "@shared/schema";

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
  const { toast } = useToast();

  const { data: existingKeywords, isLoading: isLoadingKeywords } = useQuery<Keyword[]>({
    queryKey: ["/api/campaigns", campaignId, "keywords"],
    queryFn: async () => {
      const { data } = await directusApi.get(`/items/user_keywords`, {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        }
      });
      return data.data;
    }
  });

  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/wordstat/${encodeURIComponent(query)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка при поиске ключевых слов");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      if (!data.data || !Array.isArray(data.data.keywords)) {
        throw new Error("Некорректный формат данных от API");
      }

      const results = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword || kw.word || "",
        trend: Number(kw.trend) || Number(kw.difficulty) || 0,
        selected: false
      }));

      setSearchResults(results);
      toast({
        title: "Успешно",
        description: "Ключевые слова найдены"
      });
    },
    onError: (error: Error) => {
      console.error("Search error:", error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { mutate: saveKeywords, isPending: isSaving } = useMutation({
    mutationFn: async (selectedKeywords: KeywordResult[]) => {
      const promises = selectedKeywords.map(keyword => 
        directusApi.post('/items/user_keywords', {
          keyword: keyword.keyword,
          campaign_id: campaignId,
          trend: keyword.trend
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Ключевые слова сохранены"
      });
      setSearchResults([]);
    },
    onError: (error: Error) => {
      console.error("Save error:", error);
      toast({
        title: "Ошибка",
        description: error.message,
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
        title: "Внимание",
        description: "Выберите хотя бы одно ключевое слово",
        variant: "destructive"
      });
      return;
    }
    saveKeywords(selectedKeywords);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Введите запрос для поиска ключевых слов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
        <>
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
                "Сохранить выбранные"
              )}
            </Button>
          </div>
        </>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeywords.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}