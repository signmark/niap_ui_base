import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SocialMediaIcon from '@/components/SocialMediaIcon';
import { Loader2, Filter } from 'lucide-react';
import { SocialPlatform } from '@shared/schema';
import { useCampaigns } from '@/hooks/useCampaigns';
import { CampaignContent } from '@shared/schema';

// Определяем константы для типов контента
const CONTENT_TYPE_COLORS = {
  text: 'bg-blue-500',
  image: 'bg-yellow-500',
  video: 'bg-red-500',
};

// Компонент-индикатор для отображения типа контента
interface ContentTypeIndicatorProps {
  type: string;
  count?: number;
}

const ContentTypeIndicator: React.FC<ContentTypeIndicatorProps> = ({ type, count = 1 }) => {
  const colorClass = CONTENT_TYPE_COLORS[type as keyof typeof CONTENT_TYPE_COLORS] || 'bg-gray-500';
  
  return (
    <div className={`w-3 h-3 rounded-full ${colorClass} flex items-center justify-center text-[8px] text-white font-bold`}>
      {count > 1 ? count : ''}
    </div>
  );
};

// Интерфейс для группированного контента по типам
interface GroupedContent {
  text: number;
  image: number;
  video: number;
}

// Функция для группировки контента по типам
const groupContentByType = (contents: CampaignContent[]): GroupedContent => {
  return contents.reduce((acc, content) => {
    if (content.contentType === 'text') {
      acc.text += 1;
    } else if (content.contentType === 'image' || content.contentType.includes('image')) {
      acc.image += 1;
    } else if (content.contentType === 'video' || content.contentType.includes('video')) {
      acc.video += 1;
    }
    return acc;
  }, { text: 0, image: 0, video: 0 } as GroupedContent);
};

// Компонент для отображения индикаторов контента в ячейке календаря
interface DateCellContentProps {
  contents: CampaignContent[];
}

const DateCellContent: React.FC<DateCellContentProps> = ({ contents }) => {
  if (!contents || contents.length === 0) return null;
  
  const grouped = groupContentByType(contents);
  const indicators = [];
  
  // Добавляем индикаторы для каждого типа контента
  if (grouped.text > 0) indicators.push({ type: 'text', count: grouped.text });
  if (grouped.image > 0) indicators.push({ type: 'image', count: grouped.image });
  if (grouped.video > 0) indicators.push({ type: 'video', count: grouped.video });
  
  // Ограничиваем отображение до 3 индикаторов с "+N" для остальных
  const totalCount = grouped.text + grouped.image + grouped.video;
  const maxIndicators = 3;
  const displayIndicators = indicators.slice(0, maxIndicators);
  const hasMore = totalCount > maxIndicators;
  
  return (
    <div className="flex gap-1 flex-wrap justify-center mt-1">
      {displayIndicators.map((indicator, index) => (
        <ContentTypeIndicator key={index} type={indicator.type} count={indicator.count} />
      ))}
      {hasMore && (
        <div className="text-[10px] text-gray-500 font-medium">
          +{totalCount - maxIndicators}
        </div>
      )}
    </div>
  );
};

// Интерфейс компонента календаря публикаций
export interface PublicationCalendarProps {
  onDateSelect?: (date: Date, contents: CampaignContent[]) => void;
}

// Основной компонент календаря публикаций
export const PublicationCalendar: React.FC<PublicationCalendarProps> = ({ onDateSelect }) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [mode, setMode] = useState<'month' | 'day'>('month');
  
  // Получение списка кампаний
  const { data: campaigns, isLoading: isLoadingCampaigns } = useCampaigns();
  
  // Определение первого и последнего дня месяца для фильтрации
  const startOfMonth = new Date(date?.getFullYear() || new Date().getFullYear(), date?.getMonth() || new Date().getMonth(), 1);
  const endOfMonth = new Date(date?.getFullYear() || new Date().getFullYear(), (date?.getMonth() || new Date().getMonth()) + 1, 0);
  
  // Запрос на получение опубликованного контента
  const { data: publishedContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/published', selectedCampaignId, startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      let url = '/api/published?';
      
      if (selectedCampaignId) {
        url += `campaignId=${selectedCampaignId}&`;
      }
      
      url += `startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить опубликованный контент');
      }
      
      const data = await response.json();
      return data.data as CampaignContent[];
    },
    enabled: !!date,
  });
  
  // Группируем контент по датам
  const groupedByDate = React.useMemo(() => {
    if (!publishedContent) return {};
    
    // Создаем объект, где ключи - даты, значения - массивы контента
    const grouped: { [key: string]: CampaignContent[] } = {};
    
    publishedContent.forEach(content => {
      if (!content.publishedAt) return;
      
      // Фильтрация по платформам, если выбраны
      if (selectedPlatforms.length > 0) {
        const contentPlatforms = content.socialPlatforms?.map(p => p.platform) || [];
        if (!contentPlatforms.some(platform => selectedPlatforms.includes(platform as SocialPlatform))) {
          return;
        }
      }
      
      const date = new Date(content.publishedAt).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(content);
    });
    
    return grouped;
  }, [publishedContent, selectedPlatforms]);
  
  // Обработчик выбора даты
  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return;
    
    setDate(newDate);
    
    const dateString = newDate.toISOString().split('T')[0];
    const contentsForDate = groupedByDate[dateString] || [];
    
    if (onDateSelect) {
      onDateSelect(newDate, contentsForDate);
    }
    
    // Переключаемся на представление дня при выборе даты
    setMode('day');
  };
  
  // Обработчик изменения фильтра платформ
  const handlePlatformToggle = (platform: SocialPlatform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };
  
  // Рендерим дополнительный контент для ячейки календаря
  const renderDayContent = (day: Date) => {
    const dateString = day.toISOString().split('T')[0];
    const contentsForDate = groupedByDate[dateString] || [];
    
    return <DateCellContent contents={contentsForDate} />;
  };
  
  // Список контента для выбранной даты
  const selectedDateContents = React.useMemo(() => {
    if (!date) return [];
    
    const dateString = date.toISOString().split('T')[0];
    return groupedByDate[dateString] || [];
  }, [date, groupedByDate]);
  
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Select
            value={selectedCampaignId}
            onValueChange={setSelectedCampaignId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Все кампании" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все кампании</SelectItem>
              {campaigns?.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Платформы:</span>
            <div className="flex space-x-1">
              {(['instagram', 'telegram', 'vk', 'facebook'] as SocialPlatform[]).map(platform => (
                <Button
                  key={platform}
                  variant={selectedPlatforms.includes(platform) ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePlatformToggle(platform)}
                >
                  <SocialMediaIcon platform={platform} size={16} />
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger 
              value="month" 
              onClick={() => setMode('month')}
              data-active={mode === 'month'}
              className={mode === 'month' ? 'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground' : ''}
            >
              Месяц
            </TabsTrigger>
            <TabsTrigger 
              value="day" 
              onClick={() => setMode('day')}
              data-active={mode === 'day'}
              className={mode === 'day' ? 'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground' : ''}
            >
              День
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1">
          <CardHeader className="p-4">
            <CardTitle className="text-lg">Календарь публикаций</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoadingContent ? (
              <div className="flex justify-center items-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                className="rounded-md border"
                components={{
                  DayContent: ({ day }) => (
                    <div className="flex flex-col items-center">
                      <div>{day.day}</div>
                      {renderDayContent(day.date)}
                    </div>
                  ),
                }}
              />
            )}
          </CardContent>
        </Card>
        
        {mode === 'day' && (
          <Card className="flex-1">
            <CardHeader className="p-4">
              <CardTitle className="text-lg">
                Публикации на {date?.toLocaleDateString('ru-RU')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedDateContents.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Нет публикаций на выбранную дату
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {selectedDateContents.map((content) => (
                      <div 
                        key={content.id} 
                        className="border rounded-md p-3 flex items-start gap-2"
                      >
                        <div className="flex-shrink-0">
                          <ContentTypeIndicator type={
                            content.contentType === 'text' ? 'text' : 
                            content.contentType.includes('image') ? 'image' : 'video'
                          } />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{content.title || 'Без названия'}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {content.content}
                          </p>
                          <div className="flex mt-2 gap-1">
                            {content.socialPlatforms?.map((platform, idx) => (
                              <SocialMediaIcon key={idx} platform={platform.platform as SocialPlatform} size={16} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Обозначения:</span>
          <div className="flex items-center gap-1">
            <ContentTypeIndicator type="text" />
            <span>Текст</span>
          </div>
          <div className="flex items-center gap-1">
            <ContentTypeIndicator type="image" />
            <span>Изображение</span>
          </div>
          <div className="flex items-center gap-1">
            <ContentTypeIndicator type="video" />
            <span>Видео</span>
          </div>
        </div>
      </div>
    </div>
  );
};