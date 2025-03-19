import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { PublicationCalendar } from '@/components/publication/PublicationCalendar';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Calendar, Share2 } from 'lucide-react';

/**
 * Страница календаря публикаций
 */
export default function PublishCalendarPage() {
  return (
    <div className="container py-6 space-y-8">
      <PageHeader
        title="Календарь публикаций"
        description="Просмотр и управление вашими публикациями в календарном представлении"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/publish/scheduled">
                <Calendar className="h-4 w-4 mr-2" />
                Запланированные
              </Link>
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Экспорт
            </Button>
          </div>
        }
      />
      
      <PublicationCalendar />
    </div>
  );
}