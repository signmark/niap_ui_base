import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendAnalysisSettings } from "@/components/TrendAnalysisSettings";
import { TrendAnalysisSettings as TrendSettings } from "@shared/schema";
import { SocialMediaSettings as SocialSettings } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface EditCampaignDialogProps {
  campaignId: string;
  currentName: string;
  onClose: () => void;
}

export function EditCampaignDialog({ campaignId, currentName, onClose }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [isUpdating, setIsUpdating] = useState(false);
  const [trendSettings, setTrendSettings] = useState<TrendSettings | undefined>(undefined);
  const [socialSettings, setSocialSettings] = useState<SocialSettings | undefined>(undefined);

  // Получаем полные данные о кампании
  const { data: campaignData, isLoading } = useQuery({
    queryKey: [`campaign-details-${campaignId}`],
    queryFn: async () => {
      try {
        const response = await directusApi.get(`/items/user_campaigns/${campaignId}`);
        return response.data?.data;
      } catch (error) {
        console.error('Error fetching campaign details:', error);
        throw error;
      }
    }
  });

  useEffect(() => {
    if (campaignData) {
      // Загружаем настройки из полученных данных
      if (campaignData.trend_analysis_settings) {
        setTrendSettings(campaignData.trend_analysis_settings);
      }
      if (campaignData.social_media_settings) {
        setSocialSettings(campaignData.social_media_settings);
      }
    }
  }, [campaignData]);

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

  if (isLoading) {
    return (
      <DialogContent>
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>Редактировать кампанию</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="general" className="mt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="general">Основные настройки</TabsTrigger>
          <TabsTrigger value="trend-analysis">Анализ трендов</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4 py-2">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Название кампании</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите новое название"
              />
            </div>

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
        </TabsContent>
        
        <TabsContent value="trend-analysis" className="space-y-4 py-2">
          <TrendAnalysisSettings 
            campaignId={campaignId} 
            initialSettings={trendSettings}
            onSettingsUpdated={() => {
              // После обновления настроек обновляем кэш
              queryClient.invalidateQueries({ queryKey: [`campaign-details-${campaignId}`] });
            }}
          />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
