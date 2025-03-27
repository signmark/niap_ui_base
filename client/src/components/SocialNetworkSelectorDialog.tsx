import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SiInstagram, SiTelegram, SiVk, SiFacebook, SiYoutube } from "react-icons/si";
import { Loader2 } from "lucide-react";

/**
 * Диалог для выбора социальных сетей при сборе трендов.
 * 
 * ВАЖНО: Эта функция отвечает за сбор трендовых постов из социальных сетей
 * через n8n webhook. Не путать с функцией "Искать упоминания" (SearchButton),
 * которая ищет новые источники через Perplexity API.
 * 
 * Процесс работы:
 * 1. Пользователь выбирает социальные сети для сбора постов
 * 2. При нажатии на кнопку "Собрать тренды" запрос направляется на n8n webhook
 * 3. Собранные тренды сохраняются в базе данных и отображаются в интерфейсе
 */
interface SocialNetworkSelectorDialogProps {
  isOpen: boolean;  // Открыт ли диалог
  onClose: () => void;  // Функция закрытия диалога
  onConfirm: (selectedPlatforms: string[], collectSources?: boolean) => void;  // Функция подтверждения выбора
  isLoading?: boolean;  // Состояние загрузки
}

export function SocialNetworkSelectorDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: SocialNetworkSelectorDialogProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "telegram", "vk"]);

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleCollectTrends = () => {
    onConfirm(selectedPlatforms, false);
  };
  
  const handleCollectSources = () => {
    onConfirm(selectedPlatforms, true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите социальные сети для сбора трендов</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="instagram" 
                checked={selectedPlatforms.includes("instagram")} 
                onCheckedChange={() => togglePlatform("instagram")}
              />
              <Label htmlFor="instagram" className="flex items-center">
                <SiInstagram className="mr-2 h-4 w-4 text-pink-500" />
                Instagram
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="telegram" 
                checked={selectedPlatforms.includes("telegram")} 
                onCheckedChange={() => togglePlatform("telegram")}
              />
              <Label htmlFor="telegram" className="flex items-center">
                <SiTelegram className="mr-2 h-4 w-4 text-blue-500" />
                Telegram
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="vk" 
                checked={selectedPlatforms.includes("vk")} 
                onCheckedChange={() => togglePlatform("vk")}
              />
              <Label htmlFor="vk" className="flex items-center">
                <SiVk className="mr-2 h-4 w-4 text-blue-600" />
                ВКонтакте
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="facebook" 
                checked={selectedPlatforms.includes("facebook")} 
                onCheckedChange={() => togglePlatform("facebook")}
              />
              <Label htmlFor="facebook" className="flex items-center">
                <SiFacebook className="mr-2 h-4 w-4 text-blue-700" />
                Facebook
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="youtube" 
                checked={selectedPlatforms.includes("youtube")} 
                onCheckedChange={() => togglePlatform("youtube")}
              />
              <Label htmlFor="youtube" className="flex items-center">
                <SiYoutube className="mr-2 h-4 w-4 text-red-600" />
                YouTube
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-end flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          
          <Button 
            onClick={handleCollectTrends} 
            disabled={selectedPlatforms.length === 0 || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор трендов...
              </>
            ) : (
              <div className="flex items-center gap-1">
                <span>Собрать тренды</span>
                <span className="ml-1 text-xs bg-blue-800 text-white rounded px-1.5 py-0.5" title="Использует n8n webhook">
                  webhook
                </span>
              </div>
            )}
          </Button>
          
          <Button 
            onClick={handleCollectSources} 
            disabled={selectedPlatforms.length === 0 || isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор источников...
              </>
            ) : (
              <div className="flex items-center gap-1">
                <span>Собрать источники</span>
                <span className="ml-1 text-xs bg-green-800 text-white rounded px-1.5 py-0.5" title="Использует n8n webhook">
                  webhook
                </span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}