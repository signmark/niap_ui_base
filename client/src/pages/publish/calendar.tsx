import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { PublicationCalendar } from '@/components/publication/PublicationCalendar';
import { CampaignContent } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function PublicationCalendarPage() {
  const { toast } = useToast();
  
  // Обработчик выбора даты и контента
  const handleDateSelect = (date: Date, contents: CampaignContent[]) => {
    // Можно добавить дополнительную логику при выборе даты
    console.log(`Выбрана дата: ${date.toLocaleDateString()}, контента: ${contents.length}`);
  };
  
  return (
    <div className="container py-6 space-y-6">
      <PageHeader 
        title="Календарь публикаций" 
        description="Просмотр опубликованного контента в календарном представлении"
      />
      
      <PublicationCalendar onDateSelect={handleDateSelect} />
    </div>
  );
}

export default PublicationCalendarPage;