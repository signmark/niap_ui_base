
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
}

export function KeywordList({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: keywords } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async () => {
      const response = await directusApi.get("/items/user_keywords", {
        params: {
          filter: { campaign_id: { _eq: campaignId } }
        }
      });
      return response.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      await directusApi.delete(`/items/user_keywords/${keywordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ description: "Ключевое слово удалено" });
    }
  });

  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-4">Сохраненные ключевые слова</h2>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr,100px,40px] gap-4 font-medium">
          <div>Ключевое слово</div>
          <div>Тренд</div>
          <div></div>
        </div>
        {keywords?.map((keyword) => (
          <div key={keyword.id} className="grid grid-cols-[1fr,100px,40px] gap-4 items-center">
            <div>{keyword.keyword}</div>
            <div>{keyword.trend_score}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate(keyword.id)}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
