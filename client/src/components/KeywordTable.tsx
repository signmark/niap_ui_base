import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { directusApi } from "@/lib/directus";

// Define the Keyword interface locally
interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
  mentions_count: number;
  campaign_id: string;
}

interface Source {
  url: string;
  followers: number;
  description: string;
  platform: string;
}

interface KeywordTableProps {
  keywords: Array<{
    keyword: string;
    trend: number;
    competition: number;
    sources?: Source[];
  }>;
  existingKeywords: Keyword[];
  isLoading: boolean;
  campaignId?: string;
  onKeywordsUpdated: () => void;
}

export function KeywordTable({
  keywords = [],
  existingKeywords = [],
  isLoading,
  campaignId,
  onKeywordsUpdated
}: KeywordTableProps) {
  const { add: toast } = useToast();
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Проверяем, добавлено ли слово уже
  const isKeywordAdded = (keyword: string) => {
    return existingKeywords.some(k => k.keyword === keyword);
  };

  // Мутация для добавления ключевых слов
  const { mutate: addToKeywords, isPending: isAdding } = useMutation({
    mutationFn: async (keywordsToAdd: string[]) => {
      if (!campaignId) {
        throw new Error("Выберите кампанию");
      }

      await Promise.all(
        keywordsToAdd.map(async (keywordText) => {
          const keywordData = keywords.find(k => k.keyword === keywordText);
          if (!keywordData) return;

          await directusApi.post('/items/user_keywords', {
            campaign_id: campaignId,
            keyword: keywordText,
            trend_score: keywordData.trend,
            mentions_count: keywordData.competition,
            last_checked: new Date().toISOString()
          });
        })
      );
    },
    onSuccess: () => {
      toast({
        description: "Ключевые слова добавлены в кампанию"
      });
      setSelectedKeywords([]);
      onKeywordsUpdated();
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      }
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Не удалось добавить ключевые слова",
        variant: "destructive"
      });
    }
  });

  // Мутация для удаления ключевого слова
  const { mutate: deleteKeyword } = useMutation({
    mutationFn: async (keywordId: string) => {
      await directusApi.delete(`/items/user_keywords/${keywordId}`);
    },
    onSuccess: () => {
      toast({
        description: "Ключевое слово удалено"
      });
      onKeywordsUpdated();
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      }
    },
    onError: () => {
      toast({
        description: "Не удалось удалить ключевое слово",
        variant: "destructive"
      });
    }
  });

  const handleAddSelected = () => {
    if (selectedKeywords.length > 0) {
      addToKeywords(selectedKeywords);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!keywords.length && !existingKeywords.length) {
    return null;
  }

  // Show search results even without campaign selection
  const availableKeywords = keywords.filter(k => !isKeywordAdded(k.keyword));

  return (
    <div className="space-y-8">
      {/* Таблица результатов поиска источников */}
      {availableKeywords.map((keyword) => (
        <div key={keyword.keyword} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Источники для "{keyword.keyword}"</h3>
            {campaignId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToKeywords([keyword.keyword])}
                disabled={isAdding}
              >
                Добавить ключевое слово
              </Button>
            )}
          </div>

          {keyword.sources && keyword.sources.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Источник</TableHead>
                  <TableHead>Подписчики</TableHead>
                  <TableHead>Платформа</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keyword.sources.map((source, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source.url.replace(/https?:\/\/(www\.)?/, '')}
                      </a>
                    </TableCell>
                    <TableCell>{source.followers.toLocaleString()}</TableCell>
                    <TableCell>{source.platform}</TableCell>
                    <TableCell>{source.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              Не найдено подходящих источников
            </div>
          )}
        </div>
      ))}

      {/* Таблица существующих ключевых слов - показываем только если выбрана кампания */}
      {campaignId && existingKeywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Добавленные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeywords.map((keyword) => (
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
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}