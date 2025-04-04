import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { SocialPlatform } from '@/types/social';

interface PublishButtonProps {
  contentId: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  content?: any; // Полное содержимое для публикации (опционально)
}

const PublishButton: React.FC<PublishButtonProps> = ({
  contentId,
  variant = "outline",
  size = "sm",
  onSuccess,
  onError,
  content
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('telegram');
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();

  const publishContent = async () => {
    try {
      setIsPublishing(true);
      
      let result;
      
      // Если передан объект content, используем его, иначе публикуем по ID
      if (content) {
        result = await apiRequest(`/api/publish/content/${selectedPlatform}`, {
          method: 'POST',
          body: content
        });
      } else {
        result = await apiRequest(`/api/publish/${selectedPlatform}/${contentId}`, {
          method: 'POST'
        });
      }
      
      setIsPublishing(false);
      setOpen(false);
      
      toast({
        title: 'Публикация успешна',
        description: `Контент успешно опубликован в ${getPlatformName(selectedPlatform)}`,
        variant: 'default',
      });
      
      if (onSuccess) onSuccess(result);
    } catch (error) {
      setIsPublishing(false);
      
      toast({
        title: 'Ошибка публикации',
        description: error instanceof Error ? error.message : 'Произошла ошибка при публикации контента',
        variant: 'destructive',
      });
      
      if (onError) onError(error);
    }
  };

  const getPlatformName = (platform: SocialPlatform): string => {
    switch (platform) {
      case 'telegram': return 'Telegram';
      case 'vk': return 'ВКонтакте';
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      default: return platform;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          Опубликовать
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Публикация в социальную сеть</DialogTitle>
          <DialogDescription>
            Выберите платформу для публикации контента
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup
            value={selectedPlatform}
            onValueChange={(value) => setSelectedPlatform(value as SocialPlatform)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="telegram" id="telegram" />
              <Label htmlFor="telegram">Telegram</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="vk" id="vk" />
              <Label htmlFor="vk">ВКонтакте</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="instagram" id="instagram" />
              <Label htmlFor="instagram">Instagram</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="facebook" id="facebook" />
              <Label htmlFor="facebook">Facebook</Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button onClick={publishContent} disabled={isPublishing}>
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Публикация...
              </>
            ) : (
              <>Опубликовать</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { PublishButton };