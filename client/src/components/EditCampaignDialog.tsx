import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface EditCampaignDialogProps {
  campaignId: string;
  currentName: string;
  onClose: () => void;
}

export function EditCampaignDialog({ campaignId, currentName, onClose }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateCampaign = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите название кампании"
      });
      return;
    }

    setIsUpdating(true);
    try {
      await directusApi.patch(`/items/user_campaigns/${campaignId}`, {
        name: name.trim()
      });

      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Успешно",
        description: "Название кампании обновлено"
      });
      onClose();
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить название кампании"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Редактировать название кампании</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите новое название"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={updateCampaign}
            disabled={isUpdating || !name.trim() || name === currentName}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить'
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
