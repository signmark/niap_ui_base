import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Instagram, MessageCircle, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { directusApi } from '@/lib/directus';
import { queryClient } from '@/lib/queryClient';
import { SiVk, SiFacebook } from 'react-icons/si';
import type { SocialPlatform, CampaignContent } from '@shared/schema';
import { Textarea } from '@/components/ui/textarea';

interface SocialPublishingPanelProps {
  content: CampaignContent;
  onClose?: () => void;
}

export function SocialPublishingPanel({ content, onClose }: SocialPublishingPanelProps) {
  const { toast } = useToast();
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [adaptedContent, setAdaptedContent] = useState<Record<SocialPlatform, string>>({
    instagram: content.content,
    telegram: content.content,
    vk: content.content,
    facebook: content.content,
  });

  const { mutate: publishContent, isPending } = useMutation({
    mutationFn: async () => {
      if (selectedPlatforms.length === 0) {
        throw new Error('Выберите хотя бы одну платформу для публикации');
      }

      // Создаем объект публикаций для каждой выбранной платформы
      const publications = selectedPlatforms.reduce((acc, platform) => {
        acc[platform] = {
          platform,
          status: 'pending',
          content: adaptedContent[platform],
          publishedAt: null
        };
        return acc;
      }, {} as Record<string, any>);

      // Обновляем контент с информацией о публикациях через API сервера
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      
      return await fetch(`/api/content/${content.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          socialPlatforms: publications,
          status: 'scheduled'
        })
      }).then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при публикации контента');
        }
        return response.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
      toast({
        title: 'Успешно',
        description: 'Контент запланирован для публикации'
      });
      if (onClose) onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Не удалось запланировать публикацию'
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

  // Функция для адаптации контента под особенности платформы
  const adaptContentForPlatform = (platform: SocialPlatform) => {
    let baseContent = content.content;
    
    switch (platform) {
      case 'instagram':
        // Instagram: добавляем хэштеги и эмодзи
        return `${baseContent}\n\n#content #socialmedia`;
        
      case 'telegram':
        // Telegram: форматирование с markdown
        return baseContent;
        
      case 'vk':
        // VK: стандартный текст
        return baseContent;
        
      case 'facebook':
        // Facebook: более формальный стиль
        return baseContent;
        
      default:
        return baseContent;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Публикация в социальные сети</CardTitle>
        <CardDescription>
          Выберите платформы для публикации контента и настройте его для каждой из них
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 mb-4">
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

        {selectedPlatforms.map(platform => (
          <div key={platform} className="space-y-2">
            <Label className="flex items-center gap-2">
              {platform === 'instagram' && <Instagram className="h-4 w-4" />}
              {platform === 'telegram' && <MessageCircle className="h-4 w-4" />}
              {platform === 'vk' && <SiVk className="h-4 w-4" />}
              {platform === 'facebook' && <SiFacebook className="h-4 w-4" />}
              Контент для {platform === 'instagram' ? 'Instagram' : 
                          platform === 'telegram' ? 'Telegram' : 
                          platform === 'vk' ? 'ВКонтакте' : 'Facebook'}
            </Label>
            <Textarea 
              value={adaptedContent[platform]}
              onChange={(e) => handleContentChange(platform, e.target.value)}
              placeholder={`Введите контент для ${platform}`}
              rows={4}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleContentChange(platform, adaptContentForPlatform(platform))}
              className="w-full"
            >
              Автоматически адаптировать
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button 
          onClick={() => publishContent()} 
          disabled={isPending || selectedPlatforms.length === 0}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Публикация...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Опубликовать
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}