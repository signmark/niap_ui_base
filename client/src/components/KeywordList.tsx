
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { directusApi } from '@/lib/directus';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from './Calendar';
import { useParams } from 'wouter';
import { Trash2 } from 'lucide-react';

export function KeywordList() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

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
      return response.data;
    }
  });

  const handleDelete = async (keywordId: string) => {
    try {
      await directusApi.delete(`/items/user_keywords/${keywordId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/keywords', campaignId] });
      toast({
        title: 'Успешно',
        description: 'Ключевое слово удалено'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить ключевое слово',
        variant: 'destructive'
      });
    }
  };

  const filteredKeywords = keywords?.data?.filter(keyword =>
    keyword.keyword.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Поиск ключевых слов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button onClick={() => setShowCalendar(!showCalendar)}>
          {showCalendar ? 'Скрыть календарь' : 'Показать календарь'}
        </Button>
      </div>

      {showCalendar && <Calendar campaignId={campaignId} />}

      <div className="grid gap-4">
        {filteredKeywords?.map((keyword) => (
          <Card key={keyword.id}>
            <CardContent className="flex justify-between items-center p-4">
              <div>
                <p className="font-medium">{keyword.keyword}</p>
                <p className="text-sm text-gray-500">Тренд: {keyword.trend_score}</p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleDelete(keyword.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
