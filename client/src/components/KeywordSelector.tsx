import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import type { Keyword, XmlRiverResponse } from "@shared/schema";

interface KeywordSelectorProps {
  campaignId: number;
}

export function KeywordSelector({ campaignId }: KeywordSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: keywords, isLoading: isLoadingKeywords } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      const { data } = await directusApi.get(`/items/campaign_keywords`, {
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
      const response = await fetch(
        `http://xmlriver.com/wordstat/json?user=16797&key=f7947eff83104621deb713275fe3260bfde4f001&query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Ошибка при поиске ключевых слов");
      }

      const data: XmlRiverResponse = await response.json();
      return data;
    },
    onSuccess: async (data) => {
      // Сохраняем найденные ключевые слова
      for (const keyword of data.data.keywords) {
        try {
          await directusApi.post('/items/campaign_keywords', {
            word: keyword.keyword,
            campaign_id: campaignId,
            trend: keyword.difficulty,
            competition: keyword.competition,
            volume: keyword.volume
          });
        } catch (error) {
          console.error("Ошибка при сохранении ключевого слова:", error);
        }
      }

      toast({
        title: "Успешно",
        description: "Ключевые слова добавлены"
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

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchKeywords(searchQuery);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Введите запрос для поиска ключевых слов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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

      {isLoadingKeywords ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ключевое слово</TableHead>
              <TableHead>Объем</TableHead>
              <TableHead>Конкуренция</TableHead>
              <TableHead>Тренд</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords?.map((keyword) => (
              <TableRow key={keyword.id}>
                <TableCell>{keyword.word}</TableCell>
                <TableCell>{keyword.volume}</TableCell>
                <TableCell>{keyword.competition}</TableCell>
                <TableCell>{keyword.trend}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}