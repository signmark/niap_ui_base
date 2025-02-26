import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">
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

      <div className="space-y-4">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Ключевые слова</h2>
            <div className="space-y-4">
              <Input
                placeholder="Введите запрос для поиска ключевых слов"
              />
              <div className="flex justify-end">
                <Button>
                  Искать
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

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