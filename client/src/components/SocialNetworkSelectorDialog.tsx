import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SiInstagram, SiTelegram, SiVk, SiFacebook, SiYoutube } from "react-icons/si";
import { Loader2 } from "lucide-react";

interface SocialNetworkSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPlatforms: string[]) => void;
  isLoading?: boolean;
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

  const handleConfirm = () => {
    onConfirm(selectedPlatforms);
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
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button type="submit" onClick={handleConfirm} disabled={selectedPlatforms.length === 0 || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор трендов...
              </>
            ) : (
              "Собрать тренды"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}