
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Trash2, Search } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
  campaign_id: string;
}

export default function KeywordList({ campaignId }: { campaignId: string }) {
  const [searchTerm, setSearchTerm] = useState("");
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

  const handleDelete = async (keywordId: string) => {
    try {
      await directusApi.delete(`/items/user_keywords/${keywordId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      toast({
        title: "Успешно",
        description: "Ключевое слово удалено"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить ключевое слово",
        variant: "destructive"
      });
    }
  };

  const filteredKeywords = keywords?.filter(keyword => 
    keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Сохраненные ключевые слова</h3>
      
      <div className="flex gap-2">
        <Input
          placeholder="Поиск ключевых слов"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-[1fr,auto,auto] items-center gap-4 p-4 font-medium">
          <div>Ключевое слово</div>
          <div>Тренд</div>
          <div></div>
        </div>
        {filteredKeywords?.map((keyword) => (
          <div key={keyword.id} className="grid grid-cols-[1fr,auto,auto] items-center gap-4 border-t p-4">
            <div>{keyword.keyword}</div>
            <div>{keyword.trend_score}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(keyword.id)}
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
