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
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

  const { mutate: addToKeywords, isPending: isAdding } = useMutation({
    mutationFn: async (keywordsToAdd: string[]) => {
      await Promise.all(
        keywordsToAdd.map(async (keywordText) => {
          const keywordData = keywords.find(k => k.keyword === keywordText);
          if (!keywordData) return;

          await apiRequest('/api/keywords', {
            method: 'POST',
            data: {
              campaignId: Number(campaignId),
              keyword: keywordText,
              trendScore: keywordData.trend,
              mentionsCount: keywordData.competition
            }
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
    },
    onError: () => {
      toast({
        description: "Не удалось добавить ключевые слова",
        variant: "destructive"
      });
    }
  });

  const isKeywordAdded = (keyword: string) => {
    return existingKeywords.some(k => k.keyword === keyword);
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

  if (!keywords.length && !existingKeywords.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Введите ключевое слово для поиска
      </div>
    );
  }

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
          {[...keywords, ...existingKeywords.map(k => ({
            keyword: k.keyword,
            trend: k.trendScore,
            competition: k.mentionsCount,
            isExisting: true
          }))].map((keyword) => (
            <TableRow key={keyword.keyword}>
              <TableCell>
                {!keyword.isExisting && !isKeywordAdded(keyword.keyword) && (
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
                {keyword.isExisting || isKeywordAdded(keyword.keyword) ? (
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