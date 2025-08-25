import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { publishWithImageGeneration } from '@/utils/publishWithImageGeneration';

interface StoryPublishButtonProps {
  story: any;
  contentId: string;
  platforms?: string[];
  disabled?: boolean;
}

export const StoryPublishButton: React.FC<StoryPublishButtonProps> = ({
  story,
  contentId,
  platforms = ['instagram'],
  disabled = false
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();

  const handlePublish = async () => {
    if (!contentId || !story) {
      toast({
        title: "Ошибка",
        description: "Нет данных для публикации",
        variant: "destructive"
      });
      return;
    }

    console.log('[STORY-PUBLISH-BUTTON] Начинаем публикацию:', { contentId, story });
    console.log('[STORY-PUBLISH-BUTTON] textOverlays:', story.textOverlays);
    console.log('[STORY-PUBLISH-BUTTON] platforms:', platforms);
    setIsPublishing(true);
    
    try {
      const result = await publishWithImageGeneration({
        contentId,
        platforms,
        story
      });
      
      console.log('[STORY-PUBLISH-BUTTON] Результат публикации:', result);
      
      if (result.success) {
        const mediaDescription = result.videoGenerated 
          ? 'с автоматически сгенерированным видео'
          : result.imageGenerated 
            ? 'с автоматически сгенерированным изображением'
            : '';
            
        toast({
          title: "Публикация успешна!",
          description: `Stories опубликована ${mediaDescription}`.trim(),
        });
      } else {
        throw new Error(result.message || 'Ошибка публикации');
      }
      
    } catch (error) {
      console.error('[STORY-PUBLISH-BUTTON] Ошибка публикации:', error);
      toast({
        title: "Ошибка публикации",
        description: error instanceof Error ? error.message : 'Произошла ошибка при публикации',
        variant: "destructive"
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Button
      onClick={handlePublish}
      disabled={disabled || isPublishing || !story?.textOverlays?.length}
      className="flex items-center gap-2"
    >
      {isPublishing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
      {isPublishing ? 'Публикация...' : 'Опубликовать'}
    </Button>
  );
};