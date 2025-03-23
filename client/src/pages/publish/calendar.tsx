import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';
import { CampaignContent } from '@/types';
import PublicationCalendar from '@/components/PublicationCalendar';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { PenLine, ArrowLeft } from 'lucide-react';

export default function CalendarView() {
  const { selectedCampaign } = useCampaignStore();
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
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

  const handleCreateClick = () => {
    // Перенаправляем на страницу создания контента
    window.location.href = '/content';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Календарь публикаций</h1>
          <p className="text-muted-foreground mt-1">
            Просмотр запланированных публикаций в календарном виде
          </p>
        </div>
        <div className="flex gap-2">
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
            <div className="text-center py-12">
              <p className="text-muted-foreground">Загрузка публикаций...</p>
            </div>
          ) : (
            <PublicationCalendar 
              content={campaignContent} 
              isLoading={isLoadingContent}
              onCreateClick={handleCreateClick}
              onViewPost={(post) => console.log('View post details:', post)}
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