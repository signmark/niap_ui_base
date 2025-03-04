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

interface KeywordTableProps {
  keywords: Array<{
    keyword: string;
    trend: number;
    competition: number;
  }>;
  existingKeywords: Keyword[];
  isLoading: boolean;
  campaignId?: string; // Make campaignId optional
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
    return (
      <div className="text-center p-8 text-muted-foreground">
        {campaignId ? "Введите ключевое слово для поиска" : ""}
      </div>
    );
  }

  // Show search results even without campaign selection
  const availableKeywords = keywords.filter(k => !isKeywordAdded(k.keyword));

  return (
    <div className="space-y-4">
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

      {/* Таблица новых ключевых слов */}
      {availableKeywords.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Найденные ключевые слова</h3>
            {selectedKeywords.length > 0 && campaignId && (
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
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  {campaignId && (
                    <Checkbox
                      checked={
                        availableKeywords.length > 0 &&
                        selectedKeywords.length === availableKeywords.length
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
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableKeywords.map((keyword) => (
                <TableRow key={keyword.keyword}>
                  <TableCell>
                    {campaignId && (
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
                  <TableCell>
                    {campaignId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToKeywords([keyword.keyword])}
                        disabled={isAdding}
                      >
                        Добавить
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!campaignId && availableKeywords.length > 0 && (
        <div className="text-center text-muted-foreground mt-4">
          Выберите кампанию, чтобы добавить ключевые слова
        </div>
      )}
    </div>
  );
}