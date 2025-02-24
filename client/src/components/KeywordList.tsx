import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { useToast } from "@/hooks/use-toast";
import { useDeleteKeyword } from "@/hooks/useKeywords";


interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
}

export default function KeywordList({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteKeyword = useDeleteKeyword();

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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Сохраненные ключевые слова</h3>
      <div className="rounded-md border">
        <div className="grid grid-cols-[1fr,auto,auto] items-center gap-4 p-4 font-medium">
          <div>Ключевое слово</div>
          <div>Тренд</div>
          <div></div>
        </div>
        {keywords?.map((keyword) => (
          <div key={keyword.id} className="grid grid-cols-[1fr,auto,auto] items-center gap-4 border-t p-4">
            <div>{keyword.keyword}</div>
            <div>{keyword.trend_score}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteKeyword.mutate(keyword.id)}
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