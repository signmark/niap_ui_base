import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Типы платформ социальных сетей
export type SocialPlatform = 'telegram' | 'vk' | 'instagram' | 'facebook';

// Интерфейс для структуры контента
export interface Content {
  id: string;
  title?: string;
  text?: string;
  contentType?: string;
  imageUrl?: string;
  videoUrl?: string;
  additionalImages?: string[];
  keywords?: string[];
  socialPlatforms?: Record<string, any>;
  [key: string]: any;
}

interface PublishButtonProps {
  content: Content;
  className?: string;
  onPublishSuccess?: (platform: SocialPlatform, response: any) => void;
  onPublishError?: (platform: SocialPlatform, error: Error) => void;
}

export function PublishButton({ 
  content, 
  className = "",
  onPublishSuccess,
  onPublishError
}: PublishButtonProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);

  // Мутация для публикации контента
  const publishMutation = useMutation({
    mutationFn: async ({ platform }: { platform: SocialPlatform }) => {
      return apiRequest('/api/publish', {
        method: 'POST',
        data: {
          contentId: content.id,
          platform,
          content
        }
      });
    },
    onSuccess: (response, variables) => {
      const platform = variables.platform;
      toast({
        title: "Публикация успешна",
        description: `Контент успешно опубликован в ${getPlatformName(platform)}`,
      });
      
      if (onPublishSuccess) {
        onPublishSuccess(platform, response);
      }
      
      setIsDialogOpen(false);
    },
    onError: (error: Error, variables) => {
      const platform = variables.platform;
      toast({
        title: "Ошибка публикации",
        description: `Не удалось опубликовать в ${getPlatformName(platform)}: ${error.message}`,
        variant: "destructive",
      });
      
      if (onPublishError) {
        onPublishError(platform, error);
      }
    }
  });

  // Функция для определения имени платформы
  function getPlatformName(platform: SocialPlatform): string {
    switch (platform) {
      case 'telegram': return 'Telegram';
      case 'vk': return 'ВКонтакте';
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      default: return platform;
    }
  }

  // Функция для публикации
  const handlePublish = () => {
    if (!selectedPlatform) {
      toast({
        title: "Ошибка",
        description: "Выберите платформу для публикации",
        variant: "destructive",
      });
      return;
    }

    publishMutation.mutate({ platform: selectedPlatform });
  };

  // Функция для проверки готовности публикации
  function isContentReadyForPublishing(): boolean {
    // Базовая проверка
    if (!content || !content.id) {
      return false;
    }

    // Проверка по типу контента
    if (content.contentType === 'text-image') {
      return !!content.text && !!content.title;
    } else if (content.contentType === 'text') {
      return !!content.text;
    } else if (content.contentType === 'video' || content.contentType === 'video-text') {
      return !!content.videoUrl;
    }

    return !!content.text || !!content.title;
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className={`flex items-center gap-2 ${className}`}
            disabled={!isContentReadyForPublishing()}
          >
            <Send size={16} />
            Опубликовать
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Публикация контента</DialogTitle>
            <DialogDescription>
              Выберите платформу для публикации контента "{content.title || 'Без названия'}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Платформа</Label>
              <Select 
                value={selectedPlatform || ""} 
                onValueChange={(value) => setSelectedPlatform(value as SocialPlatform)}
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Выберите платформу" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="vk">ВКонтакте</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {selectedPlatform && (
              <div className="rounded-md border p-4 space-y-2">
                <h3 className="text-sm font-medium">Предпросмотр публикации в {getPlatformName(selectedPlatform)}</h3>
                {content.title && <p className="text-md font-bold">{content.title}</p>}
                {content.text && <p className="text-sm text-muted-foreground">{content.text.length > 150 ? `${content.text.substring(0, 150)}...` : content.text}</p>}
                {content.contentType === 'text-image' && content.imageUrl && (
                  <div className="mt-2 rounded-md overflow-hidden" style={{ maxHeight: "150px" }}>
                    <img 
                      src={content.imageUrl}
                      alt="Предпросмотр"
                      className="w-full h-auto object-cover"
                      style={{ maxHeight: "150px" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={publishMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!selectedPlatform || publishMutation.isPending}
            >
              {publishMutation.isPending ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}