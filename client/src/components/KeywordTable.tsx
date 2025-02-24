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
import { directusApi } from "@/lib/directus";
import { Loader2, Plus } from "lucide-react";
import type { Keyword, KeywordSearchResult } from "@shared/schema";

interface KeywordTableProps {
  keywords: (Keyword | KeywordSearchResult)[];
  existingKeywords: Keyword[];
  isLoading: boolean;
  campaignId: string;
}

export function KeywordTable({ keywords = [], existingKeywords, isLoading, campaignId }: KeywordTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  const { mutate: addToKeywords, isPending: isAdding } = useMutation({
    mutationFn: async (keywords: string[]) => {
      await Promise.all(
        keywords.map(async (keyword) => {
          await directusApi.post("/items/user_keywords", {
            campaign_id: campaignId,
            keyword,
            trend_score: 0,
            mentions_count: 0,
            last_checked: new Date().toISOString()
          });
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      toast({
        description: "Ключевые слова добавлены в кампанию"
      });
      setSelectedKeywords([]);
    },
    onError: (error: Error) => {
      toast({
        description: "Не удалось добавить ключевые слова",
        variant: "destructive"
      });
    }
  });

  const isKeywordAdded = (keyword: string) => {
    return existingKeywords?.some(k => k.keyword === keyword);
  };

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

  if (!keywords.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        {existingKeywords?.length ? "Это все ключевые слова кампании" : "Введите ключевое слово для поиска"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedKeywords.length > 0 && (
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
              <Checkbox
                checked={selectedKeywords.length === keywords.filter(k => !isKeywordAdded(k.keyword)).length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    const availableKeywords = keywords
                      .filter(k => !isKeywordAdded(k.keyword))
                      .map(k => k.keyword);
                    setSelectedKeywords(availableKeywords);
                  } else {
                    setSelectedKeywords([]);
                  }
                }}
              />
            </TableHead>
            <TableHead>Ключевое слово</TableHead>
            <TableHead>Тренд</TableHead>
            <TableHead>Упоминания</TableHead>
            <TableHead className="text-right">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((keyword) => {
            const isAdded = isKeywordAdded(keyword.keyword);
            const trendValue = 'trendScore' in keyword ? keyword.trendScore : keyword.trend;
            const mentionsValue = 'mentionsCount' in keyword ? keyword.mentionsCount : 0;

            return (
              <TableRow key={keyword.keyword}>
                <TableCell>
                  {!isAdded && (
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
                <TableCell>{trendValue}</TableCell>
                <TableCell>{mentionsValue}</TableCell>
                <TableCell className="text-right">
                  {isAdded ? (
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}