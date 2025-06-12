import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';
import { CampaignContent } from '@/types';
import PublicationCalendar from '@/components/PublicationCalendar';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { PenLine, ArrowLeft, SortDesc, SortAsc, Loader2 } from 'lucide-react';

export default function CalendarView() {
  const { selectedCampaign } = useCampaignStore();
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // По умолчанию сортировка от новых к старым
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      try {
        console.log('Загрузка публикаций для кампании:', selectedCampaign.id);

        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();
        console.log('Загружено публикаций:', (responseData.data || []).length);
        return responseData;
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return { data: [] };
      }
    },
    enabled: !!selectedCampaign?.id,
    refetchOnMount: true,
    staleTime: 0, // Всегда считаем данные устаревшими и перезагружаем
    refetchInterval: 10000, // Автоматически обновляем данные каждые 10 секунд
    refetchIntervalInBackground: true // Обновляем даже если вкладка не активна
  });

  const campaignContent: CampaignContent[] = campaignContentResponse?.data || [];

  // Отладка данных календаря
  useEffect(() => {
    if (campaignContent.length > 0) {
      console.log(`СТРАНИЦА КАЛЕНДАРЯ: Получено ${campaignContent.length} публикаций`);
      
      const withSocialPlatforms = campaignContent.filter(post => 
        post.socialPlatforms && 
        typeof post.socialPlatforms === 'object' && 
        Object.keys(post.socialPlatforms).length > 0
      );
      
      console.log(`СТРАНИЦА КАЛЕНДАРЯ: С социальными платформами: ${withSocialPlatforms.length}`);
      
      if (withSocialPlatforms.length > 0) {
        console.log('СТРАНИЦА КАЛЕНДАРЯ: Первые 5 публикаций с платформами:');
        withSocialPlatforms.slice(0, 5).forEach((post, i) => {
          console.log(`  ${i + 1}. Title: "${post.title}", publishedAt: ${post.publishedAt}, scheduledAt: ${post.scheduledAt}, platforms: ${Object.keys(post.socialPlatforms || {}).join(', ')}`);
        });
      }
    }
  }, [campaignContent]);

  const handleCreateClick = () => {
    // Перенаправляем на страницу создания контента
    window.location.href = '/content';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Календарь</h1>
          <p className="text-muted-foreground mt-1">
            Просмотр запланированных публикаций в календарном виде
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            {sortOrder === 'desc' ? (
              <>
                <SortDesc size={16} />
                <span>Сначала новые</span>
              </>
            ) : (
              <>
                <SortAsc size={16} />
                <span>Сначала старые</span>
              </>
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/publish/scheduled">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к публикациям
            </Link>
          </Button>
          <Button onClick={handleCreateClick}>
            <PenLine className="mr-2 h-4 w-4" />
            Создать публикацию
          </Button>
        </div>
      </div>

      {selectedCampaign ? (
        <>
          {isLoadingContent ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Загружаем публикации для календаря...</p>
            </div>
          ) : (
            <PublicationCalendar 
              content={campaignContent} 
              isLoading={isLoadingContent}
              onCreateClick={handleCreateClick}
              onViewPost={(post) => console.log('View post details:', post)}
              initialSortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
          )}
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          Пожалуйста, выберите кампанию в селекторе сверху
        </div>
      )}
    </div>
  );
}