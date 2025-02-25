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
import { Loader2, Plus } from "lucide-react";
import { directusApi } from "@/lib/directus";
import type { Keyword } from "@shared/schema";

interface KeywordTableProps {
  keywords: Array<{
    keyword: string;
    trend: number;
    competition: number;
  }>;
  existingKeywords: Keyword[];
  isLoading: boolean;
  campaignId: string;
  onKeywordsUpdated: () => void;
}

export function KeywordTable({ 
  keywords = [], 
  existingKeywords = [], 
  isLoading, 
  campaignId,
  onKeywordsUpdated 
}: KeywordTableProps) {
  const { toast } = useToast();
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Проверяем, добавлено ли слово уже
  const isKeywordAdded = (keyword: string) => {
    return existingKeywords.some(k => k.keyword === keyword);
  };

  // Мутация для добавления ключевых слов
  const { mutate: addToKeywords, isPending: isAdding } = useMutation({
    mutationFn: async (keywordsToAdd: string[]) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
    },
    onError: () => {
      toast({
        description: "Не удалось добавить ключевые слова",
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
    return (
      <div className="text-center p-8 text-muted-foreground">
        Введите ключевое слово для поиска
      </div>
    );
  }

  // Фильтруем доступные для добавления ключевые слова
  const availableKeywords = keywords.filter(k => !isKeywordAdded(k.keyword));

  return (
    <div className="space-y-4">
      {availableKeywords.length > 0 && selectedKeywords.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleAddSelected}
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Добавление...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Добавить выбранные ({selectedKeywords.length})
              </>
            )}
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              {availableKeywords.length > 0 && (
                <Checkbox
                  checked={
                    selectedKeywords.length === availableKeywords.length &&
                    availableKeywords.length > 0
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedKeywords(availableKeywords.map(k => k.keyword));
                    } else {
                      setSelectedKeywords([]);
                    }
                  }}
                />
              )}
            </TableHead>
            <TableHead>Ключевое слово</TableHead>
            <TableHead>Тренд</TableHead>
            <TableHead>Конкуренция</TableHead>
            <TableHead className="text-right">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ...keywords.map(k => ({
              keyword: k.keyword,
              trend: k.trend,
              competition: k.competition,
              isExisting: isKeywordAdded(k.keyword)
            })),
            ...existingKeywords.map(k => ({
              keyword: k.keyword,
              trend: k.trend_score,
              competition: k.mentions_count,
              isExisting: true
            }))
          ].map((keyword) => (
            <TableRow key={keyword.keyword}>
              <TableCell>
                {!keyword.isExisting && (
                  <Checkbox
                    checked={selectedKeywords.includes(keyword.keyword)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedKeywords([...selectedKeywords, keyword.keyword]);
                      } else {
                        setSelectedKeywords(selectedKeywords.filter(k => k !== keyword.keyword));
                      }
                    }}
                  />
                )}
              </TableCell>
              <TableCell>{keyword.keyword}</TableCell>
              <TableCell>{keyword.trend}</TableCell>
              <TableCell>{keyword.competition}</TableCell>
              <TableCell className="text-right">
                {keyword.isExisting ? (
                  <Button variant="ghost" size="sm" disabled>
                    Добавлено
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addToKeywords([keyword.keyword])}
                    disabled={isAdding}
                  >
                    {isAdding ? "Добавление..." : "Добавить"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}