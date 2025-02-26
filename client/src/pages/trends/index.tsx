import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Pencil } from "lucide-react";
import { EditCampaignDialog } from "@/components/EditCampaignDialog";

export default function Trends() {
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const { toast } = useToast();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns/a99c0c78-bed0-4ec6-80d2-325500680bef');
      console.log('Campaign response:', response);
      return response.data;
    }
  });

  const { mutate: updateCampaignName } = useMutation({
    mutationFn: async (newName: string) => {
      await directusApi.patch('/items/user_campaigns/a99c0c78-bed0-4ec6-80d2-325500680bef', {
        name: newName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast({
        title: "Успешно",
        description: "Название кампании обновлено"
      });
      setIsEditingCampaign(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить название"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {campaign?.data?.name || "Основная кампания"}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsEditingCampaign(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ключевые слова</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Введите запрос для поиска ключевых слов"
              className="flex-1"
            />
            <Button>
              Искать
            </Button>
          </div>
        </div>
      </Card>

      <Dialog 
        open={isEditingCampaign} 
        onOpenChange={setIsEditingCampaign}
      >
        <EditCampaignDialog
          campaignId="a99c0c78-bed0-4ec6-80d2-325500680bef"
          currentName={campaign?.data?.name || ""}
          onClose={() => setIsEditingCampaign(false)}
          onUpdate={updateCampaignName}
        />
      </Dialog>
    </div>
  );
}