/**
 * Компонент для публикации контента в Instagram Stories
 * и получения ссылки на опубликованную историю
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Instagram, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PublishInstagramStoryProps {
  contentId: string;
  campaignId?: string;
  onPublishComplete?: (result: any) => void;
  className?: string;
}

export function PublishInstagramStory({
  contentId,
  campaignId,
  onPublishComplete,
  className
}: PublishInstagramStoryProps) {
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Функция для публикации контента в Instagram Stories
  const publishStory = async () => {
    if (!contentId) {
      toast({
        title: 'Ошибка',
        description: 'Не указан ID контента для публикации',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsPublishing(true);
      
      // Запрос к API для публикации истории
      const response = await apiRequest({
        url: '/api/publish/stories',
        method: 'POST',
        body: { contentId, campaignId, platform: 'instagram' }
      });

      if (response.success) {
        setPublishResult(response.result);
        
        toast({
          title: 'Успешно',
          description: 'История опубликована в Instagram',
          variant: 'default'
        });
        
        // Вызываем колбэк, если он предоставлен
        if (onPublishComplete) {
          onPublishComplete(response.result);
        }
      } else {
        toast({
          title: 'Ошибка публикации',
          description: response.error || 'Не удалось опубликовать историю',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Произошла ошибка при публикации',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Функция для копирования URL истории в буфер обмена
  const copyStoryUrl = () => {
    if (publishResult?.storyUrl) {
      navigator.clipboard.writeText(publishResult.storyUrl);
      setIsCopied(true);
      
      toast({
        title: 'Ссылка скопирована',
        description: 'Ссылка на историю скопирована в буфер обмена',
        variant: 'default'
      });
      
      // Сбросить статус копирования через 2 секунды
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Функция для открытия истории в новой вкладке
  const openStoryInNewTab = () => {
    if (publishResult?.storyUrl) {
      window.open(publishResult.storyUrl, '_blank');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram size={20} />
          Публикация Instagram Stories
        </CardTitle>
        <CardDescription>
          Публикация контента в Instagram в виде истории
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!publishResult ? (
          <div className="flex flex-col space-y-2">
            <p className="text-sm text-muted-foreground">
              Нажмите кнопку ниже, чтобы опубликовать контент в Instagram Stories.
              После публикации вы получите ссылку на историю.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Примечание: ссылка ведет на все активные истории пользователя, а не на конкретную историю.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4">
              <h4 className="mb-2 font-medium">Информация о публикации</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Статус:</span>
                  <span className="font-medium text-green-600">Опубликовано</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID истории:</span>
                  <span className="font-mono text-xs">{publishResult.storyId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Время публикации:</span>
                  <span>{new Date(publishResult.publishedAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Имя пользователя:</span>
                  <span>{publishResult.igUsername}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Ссылка на историю:</span>
                  <div className="flex flex-1 items-center justify-between rounded-md border px-3 py-1.5">
                    <span className="text-xs truncate">{publishResult.storyUrl}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={copyStoryUrl}
                        title="Копировать ссылку"
                      >
                        {isCopied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={openStoryInNewTab}
                        title="Открыть в новой вкладке"
                      >
                        <ExternalLink size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t bg-muted/50 px-6 py-4">
        {!publishResult ? (
          <Button 
            onClick={publishStory} 
            disabled={isPublishing}
            className="w-full"
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Публикация...
              </>
            ) : (
              <>
                <Instagram className="mr-2 h-4 w-4" />
                Опубликовать в Instagram Stories
              </>
            )}
          </Button>
        ) : (
          <div className="flex w-full gap-3">
            <Button 
              variant="outline" 
              onClick={copyStoryUrl}
              className="flex-1"
            >
              <Copy className="mr-2 h-4 w-4" />
              Копировать ссылку
            </Button>
            <Button 
              onClick={openStoryInNewTab}
              className="flex-1"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Открыть историю
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

export default PublishInstagramStory;