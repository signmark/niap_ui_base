import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Instagram, MessageCircle, Facebook, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import RichTextEditor from "./RichTextEditor";

// Определение типов
type SocialPlatform = 'instagram' | 'telegram' | 'vk' | 'facebook';

interface SocialContentAdaptationDialogProps {
  contentId: string;
  originalContent: string;
  onClose: () => void;
}

interface PlatformContent {
  content: string;
  isEnabled: boolean;
  isEdited: boolean;
}

export function SocialContentAdaptationDialog({ 
  contentId, 
  originalContent, 
  onClose 
}: SocialContentAdaptationDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SocialPlatform>('instagram');
  const [isGenerating, setIsGenerating] = useState(false);

  // Состояние для каждой платформы
  const [platformsContent, setPlatformsContent] = useState<{[key in SocialPlatform]: PlatformContent}>({
    instagram: { content: adaptContentForPlatform('instagram', originalContent), isEnabled: true, isEdited: false },
    telegram: { content: adaptContentForPlatform('telegram', originalContent), isEnabled: false, isEdited: false },
    vk: { content: adaptContentForPlatform('vk', originalContent), isEnabled: false, isEdited: false },
    facebook: { content: adaptContentForPlatform('facebook', originalContent), isEnabled: false, isEdited: false }
  });

  // Мутация для сохранения адаптированного контента
  const { mutate: saveAdaptedContent, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const enabledPlatforms = Object.entries(platformsContent)
        .filter(([_, data]) => data.isEnabled)
        .map(([platform, data]) => ({
          platform,
          content: data.content
        }));

      if (enabledPlatforms.length === 0) {
        throw new Error("Выберите хотя бы одну платформу для публикации");
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Требуется авторизация");
      }
      
      return await fetch(`/api/content/${contentId}/adapt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          socialPublications: enabledPlatforms.map(p => ({
            platform: p.platform,
            content: p.content,
            status: 'pending'
          }))
        })
      }).then(response => {
        if (!response.ok) {
          throw new Error("Ошибка при сохранении адаптированного контента");
        }
        return response.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Контент адаптирован для выбранных платформ",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось сохранить адаптированный контент",
      });
    }
  });

  // Переключение активности платформы
  const handleTogglePlatform = (platform: SocialPlatform) => {
    setPlatformsContent(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        isEnabled: !prev[platform].isEnabled
      }
    }));
  };

  // Изменение контента для платформы
  const handleContentChange = (platform: SocialPlatform, newContent: string) => {
    setPlatformsContent(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        content: newContent,
        isEdited: true
      }
    }));
  };

  // Адаптация контента для разных платформ
  function adaptContentForPlatform(platform: SocialPlatform, content: string): string {
    // Базовая логика адаптации контента для разных платформ
    switch (platform) {
      case 'instagram':
        // Для Instagram добавляем хэштеги и эмодзи
        return content + "\n\n#контент #smm #маркетинг";
      case 'telegram':
        // Для Telegram добавляем форматирование и ссылки
        return content + "\n\nПодписывайтесь на наш канал! 👉";
      case 'vk':
        // Для VK стандартный формат
        return content + "\n\nСтавьте лайки и делитесь с друзьями! ❤";
      case 'facebook':
        // Для Facebook более формальный стиль
        return content + "\n\nНе забудьте подписаться на нашу страницу, чтобы не пропустить новые публикации.";
      default:
        return content;
    }
  }

  // Регенерация контента для платформы
  const regenerateForPlatform = (platform: SocialPlatform) => {
    setPlatformsContent(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        content: adaptContentForPlatform(platform, originalContent),
        isEdited: false
      }
    }));
  };

  // Получить иконку для платформы
  const getPlatformIcon = (platform: SocialPlatform) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'telegram':
        return <MessageCircle className="h-4 w-4" />;
      case 'vk':
        return <MessageCircle className="h-4 w-4" />;
      case 'facebook':
        return <Facebook className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Адаптация контента для социальных сетей</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(['instagram', 'telegram', 'vk', 'facebook'] as SocialPlatform[]).map(platform => (
              <Button
                key={platform}
                variant={platformsContent[platform].isEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => handleTogglePlatform(platform)}
                className="flex items-center gap-2"
              >
                {getPlatformIcon(platform)}
                <span className="capitalize">{platform}</span>
                {platformsContent[platform].isEnabled && <Check className="h-3 w-3" />}
              </Button>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SocialPlatform)}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="instagram" disabled={!platformsContent.instagram.isEnabled}>Instagram</TabsTrigger>
              <TabsTrigger value="telegram" disabled={!platformsContent.telegram.isEnabled}>Telegram</TabsTrigger>
              <TabsTrigger value="vk" disabled={!platformsContent.vk.isEnabled}>VK</TabsTrigger>
              <TabsTrigger value="facebook" disabled={!platformsContent.facebook.isEnabled}>Facebook</TabsTrigger>
            </TabsList>

            {(['instagram', 'telegram', 'vk', 'facebook'] as SocialPlatform[]).map(platform => (
              <TabsContent key={platform} value={platform}>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Контент для {platform}</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => regenerateForPlatform(platform)}
                    >
                      Сбросить
                    </Button>
                  </div>
                  <RichTextEditor
                    content={platformsContent[platform].content}
                    onChange={(html: string) => handleContentChange(platform, html)}
                    placeholder={`Введите текст для ${platform}...`}
                    className={!platformsContent[platform].isEnabled ? "opacity-50 pointer-events-none" : ""}
                    minHeight="200px"
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={() => saveAdaptedContent()} 
            disabled={isSaving || Object.values(platformsContent).every(p => !p.isEnabled)}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Сохранить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}