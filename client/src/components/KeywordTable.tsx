import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { directusApi } from "@/lib/directus";
import { Loader2, Plus } from "lucide-react";
import type { Keyword } from "@shared/schema";

interface KeywordTableProps {
  keywords: Keyword[];
  existingKeywords: any[];
  isLoading: boolean;
  campaignId: string;
}

export function KeywordTable({ keywords, existingKeywords, isLoading, campaignId }: KeywordTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Добавление ключевого слова в кампанию
  const { mutate: addToKeywords, isPending: isAdding } = useMutation({
    mutationFn: async (keyword: string) => {
      await directusApi.post("/items/user_keywords", {
        campaign_id: campaignId,
        keyword,
        trend_score: 0,
        mentions_count: 0,
        last_checked: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      toast({
        title: "Успешно",
        description: "Ключевое слово добавлено в кампанию"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Проверяем, добавлено ли слово в кампанию
  const isKeywordAdded = (keyword: string) => {
    return existingKeywords?.some(k => k.keyword === keyword);
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
        Введите ключевое слово для поиска
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ключевое слово</TableHead>
          <TableHead>Тренд</TableHead>
          <TableHead>Конкуренция</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keywords.map((keyword) => {
          const added = isKeywordAdded(keyword.word);

          return (
            <TableRow key={keyword.id}>
              <TableCell>{keyword.word}</TableCell>
              <TableCell>{keyword.trend}</TableCell>
              <TableCell>{keyword.competition}</TableCell>
              <TableCell className="text-right">
                {added ? (
                  <Button variant="ghost" size="sm" disabled>
                    Добавлено
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addToKeywords(keyword.word)}
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
                        Добавить
                      </>
                    )}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}