import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Pencil } from "lucide-react";

export default function Trends() {
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
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
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await directusApi.patch(`/items/user_campaigns/${id}`, {
        name: name.trim()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast({
        title: "Успешно",
        description: "Название кампании обновлено"
      });
      setEditingCampaignId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить название"
      });
    }
  });

  const startEditing = (id: string, currentName: string) => {
    setEditingCampaignId(id);
    setEditedName(currentName);
  };

  const handleSave = () => {
    if (editingCampaignId && editedName.trim()) {
      updateCampaignName({ id: editingCampaignId, name: editedName });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingCampaignId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {editingCampaignId === campaign?.data?.id ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-xl font-bold h-auto py-1"
            autoFocus
          />
        ) : (
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => startEditing(campaign?.data?.id, campaign?.data?.name || "")}
          >
            <h1 className="text-xl font-bold">
              {campaign?.data?.name || "Основная кампания"}
            </h1>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <Card className="p-6">
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
    </div>
  );
}