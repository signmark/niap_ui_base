
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { directusApi } from '@/lib/directus';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';

export function KeywordList() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keywords } = useQuery({
    queryKey: ['/api/keywords', campaignId],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        }
      });
      return response.data?.data || [];
    }
  });

  const handleDelete = async (keywordId: string) => {
    try {
      await directusApi.delete(`/items/user_keywords/${keywordId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/keywords', campaignId] });
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

  const filteredKeywords = keywords?.filter(kw => 
    kw.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Поиск ключевых слов..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg">
        <div className="grid grid-cols-[1fr,auto,auto] gap-4 p-4 font-medium border-b">
          <div>Ключевое слово</div>
          <div>Тренд</div>
          <div></div>
        </div>

        {filteredKeywords?.map((keyword) => (
          <div key={keyword.id} className="grid grid-cols-[1fr,auto,auto] gap-4 p-4 items-center hover:bg-muted/50">
            <div>{keyword.keyword}</div>
            <div>{keyword.trend_score}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(keyword.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
