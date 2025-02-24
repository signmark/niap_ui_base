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
import { useQuery, useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import type { Keyword } from "@shared/schema";
import { useState } from "react";

interface KeywordTableProps {
  keywords: Keyword[];
  isLoading: boolean;
}

export function KeywordTable({ keywords, isLoading }: KeywordTableProps) {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get("/items/user_campaigns");
      return response.data?.data || [];
    }
  });

  const { mutate: addToKeywords, isPending } = useMutation({
    mutationFn: async ({ keyword, campaignId }: { keyword: string, campaignId: string }) => {
      await directusApi.post("/items/user_keywords", {
        campaign_id: campaignId,
        keyword: keyword,
        trend_score: 0,
        mentions_count: 0,
        last_checked: new Date().toISOString()
      });
    },
    onSuccess: () => {
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

  if (isLoading) {
    return <div>Загрузка ключевых слов...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Выберите кампанию" />
          </SelectTrigger>
          <SelectContent>
            {campaigns?.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ключевое слово</TableHead>
            <TableHead>Тренд</TableHead>
            <TableHead>Конкуренция</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((keyword) => (
            <TableRow key={keyword.id}>
              <TableCell>{keyword.word}</TableCell>
              <TableCell>{keyword.trend}</TableCell>
              <TableCell>{keyword.competition}</TableCell>
              <TableCell>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!selectedCampaign) {
                      toast({
                        title: "Ошибка",
                        description: "Выберите кампанию",
                        variant: "destructive"
                      });
                      return;
                    }
                    addToKeywords({
                      keyword: keyword.word,
                      campaignId: selectedCampaign
                    });
                  }}
                  disabled={isPending || !selectedCampaign}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Добавление...
                    </>
                  ) : (
                    "Добавить в кампанию"
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}