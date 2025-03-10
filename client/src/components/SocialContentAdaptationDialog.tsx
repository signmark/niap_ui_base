import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Loader2, Instagram, MessageCircle, Send, Calendar } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { directusApi } from '@/lib/directus';
import { queryClient } from '@/lib/queryClient';
import { SiVk, SiFacebook } from 'react-icons/si';
import type { SocialPlatform } from '@shared/schema';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface SocialContentAdaptationDialogProps {
  contentId: string;
  originalContent: string;
  onClose: () => void;
}

export function SocialContentAdaptationDialog({ 
  contentId, 
  originalContent, 
  onClose 
}: SocialContentAdaptationDialogProps) {
  const { add: toast } = useToast();
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [adaptedContent, setAdaptedContent] = useState<Record<SocialPlatform, string>>({
    instagram: '',
    telegram: '',
    vk: '',
    facebook: ''
  });
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // При первой загрузке адаптируем контент для всех платформ
  useEffect(() => {
    if (originalContent) {
      setAdaptedContent({
        instagram: adaptContentForPlatform('instagram', originalContent),
        telegram: adaptContentForPlatform('telegram', originalContent),
        vk: adaptContentForPlatform('vk', originalContent),
        facebook: adaptContentForPlatform('facebook', originalContent)
      });
    }
  }, [originalContent]);

  const { mutate: schedulePublication, isPending } = useMutation({
    mutationFn: async () => {
      if (selectedPlatforms.length === 0) {
        throw new Error('Выберите хотя бы одну платформу для публикации');
      }

      if (!scheduledDate || !scheduledTime) {
        throw new Error('Выберите дату и время публикации');
      }

      // Формируем дату публикации
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      
      // Создаем объект публикаций для каждой выбранной платформы
      const publications = selectedPlatforms.reduce((acc, platform) => {
        acc[platform] = {
          platform,
          status: 'pending',
          publishedAt: null,
          adaptedContent: adaptedContent[platform]
        };
        return acc;
      }, {} as Record<string, any>);

      // Обновляем контент с информацией о публикациях
      return await directusApi.patch(`/items/campaign_content/${contentId}`, {
        social_platforms: publications,
        status: 'scheduled',
        scheduled_at: scheduledDateTime.toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
      toast({
        title: 'Успешно',
        description: 'Публикации запланированы'
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Не удалось запланировать публикации'
      });
    }
  });

  const handleTogglePlatform = (platform: SocialPlatform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleContentChange = (platform: SocialPlatform, newContent: string) => {
    setAdaptedContent({
      ...adaptedContent,
      [platform]: newContent
    });
  };

  // Адаптируем контент для разных платформ
  function adaptContentForPlatform(platform: SocialPlatform, content: string): string {
    switch (platform) {
      case 'instagram':
        // Instagram: добавляем хэштеги и эмодзи для стильного представления
        return `${content}\n\n#контент #smm #instagram`;
        
      case 'telegram':
        // Telegram: поддерживает markdown форматирование
        return content;
        
      case 'vk':
        // ВКонтакте: можно добавить хэштеги
        return `${content}\n\n#вк #контент`;
        
      case 'facebook':
        // Facebook: более формальный стиль
        return content;
        
      default:
        return content;
    }
  }

  // Перегенерировать контент для конкретной платформы
  const regenerateForPlatform = (platform: SocialPlatform) => {
    const adapted = adaptContentForPlatform(platform, originalContent);
    setAdaptedContent({
      ...adaptedContent,
      [platform]: adapted
    });
  };

  return (
    <DialogContent className="sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle>Адаптация контента для соцсетей</DialogTitle>
        <DialogDescription>
          Настройте контент для публикации в разных социальных сетях
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scheduledDate">Дата публикации</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <Label htmlFor="scheduledTime">Время публикации</Label>
            <Input
              id="scheduledTime"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="instagram" 
              checked={selectedPlatforms.includes('instagram')}
              onCheckedChange={() => handleTogglePlatform('instagram')}
            />
            <Label htmlFor="instagram" className="flex items-center gap-1">
              <Instagram className="h-4 w-4" /> Instagram
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="telegram" 
              checked={selectedPlatforms.includes('telegram')}
              onCheckedChange={() => handleTogglePlatform('telegram')}
            />
            <Label htmlFor="telegram" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" /> Telegram
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="vk" 
              checked={selectedPlatforms.includes('vk')}
              onCheckedChange={() => handleTogglePlatform('vk')}
            />
            <Label htmlFor="vk" className="flex items-center gap-1">
              <SiVk className="h-4 w-4" /> ВКонтакте
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="facebook" 
              checked={selectedPlatforms.includes('facebook')}
              onCheckedChange={() => handleTogglePlatform('facebook')}
            />
            <Label htmlFor="facebook" className="flex items-center gap-1">
              <SiFacebook className="h-4 w-4" /> Facebook
            </Label>
          </div>
        </div>

        {selectedPlatforms.length > 0 && (
          <Tabs defaultValue={selectedPlatforms[0]}>
            <TabsList className="w-full">
              {selectedPlatforms.map(platform => (
                <TabsTrigger key={platform} value={platform} className="flex items-center gap-1">
                  {platform === 'instagram' && <Instagram className="h-4 w-4" />}
                  {platform === 'telegram' && <MessageCircle className="h-4 w-4" />}
                  {platform === 'vk' && <SiVk className="h-4 w-4" />}
                  {platform === 'facebook' && <SiFacebook className="h-4 w-4" />}
                  {platform === 'instagram' ? 'Instagram' : 
                   platform === 'telegram' ? 'Telegram' : 
                   platform === 'vk' ? 'ВКонтакте' : 'Facebook'}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {selectedPlatforms.map(platform => (
              <TabsContent key={platform} value={platform} className="space-y-2 mt-2">
                <div className="flex justify-between items-center">
                  <Label>
                    Контент для {platform === 'instagram' ? 'Instagram' : 
                              platform === 'telegram' ? 'Telegram' : 
                              platform === 'vk' ? 'ВКонтакте' : 'Facebook'}
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => regenerateForPlatform(platform)}
                  >
                    Адаптировать заново
                  </Button>
                </div>
                <Textarea 
                  value={adaptedContent[platform]}
                  onChange={(e) => handleContentChange(platform, e.target.value)}
                  placeholder={`Введите контент для ${platform}`}
                  rows={8}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button 
          onClick={() => schedulePublication()} 
          disabled={isPending || selectedPlatforms.length === 0 || !scheduledDate || !scheduledTime}
          className="flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Планирование...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4" />
              Запланировать публикации
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}