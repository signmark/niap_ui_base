import { useState } from "react";
import { TrendAnalysisSettings as TrendSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";

interface TrendAnalysisSettingsProps {
  campaignId: string;
  initialSettings?: TrendSettings;
  onSettingsUpdated?: () => void;
}

export function TrendAnalysisSettings({
  campaignId,
  initialSettings,
  onSettingsUpdated
}: TrendAnalysisSettingsProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const defaultSettings: TrendSettings = {
    minFollowers: {
      instagram: 5000,
      telegram: 2000,
      vk: 3000,
      facebook: 5000,
      youtube: 10000
    },
    maxSourcesPerPlatform: 10,
    maxTrendsPerSource: 5
  };
  
  const [settings, setSettings] = useState<TrendSettings>(
    initialSettings || defaultSettings
  );
  
  const handleFollowersChange = (platform: keyof TrendSettings['minFollowers'], value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings({
      ...settings,
      minFollowers: {
        ...settings.minFollowers,
        [platform]: numValue
      }
    });
  };
  
  const handleMaxSourcesChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings({
      ...settings,
      maxSourcesPerPlatform: numValue
    });
  };
  
  const handleMaxTrendsChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setSettings({
      ...settings,
      maxTrendsPerSource: numValue
    });
  };
  
  const saveSettings = async () => {
    setIsUpdating(true);
    try {
      await directusApi.patch(`/items/user_campaigns/${campaignId}`, {
        trend_analysis_settings: settings
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Успешно",
        description: "Настройки анализа трендов обновлены"
      });
      
      if (onSettingsUpdated) {
        onSettingsUpdated();
      }
    } catch (error) {
      console.error('Error updating trend analysis settings:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить настройки анализа трендов"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Настройки поиска источников</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-base">Минимальное количество подписчиков по платформам</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="instagram-followers">Instagram</Label>
                <Input 
                  id="instagram-followers"
                  type="number" 
                  value={settings.minFollowers.instagram} 
                  onChange={(e) => handleFollowersChange('instagram', e.target.value)}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telegram-followers">Telegram</Label>
                <Input 
                  id="telegram-followers"
                  type="number" 
                  value={settings.minFollowers.telegram} 
                  onChange={(e) => handleFollowersChange('telegram', e.target.value)}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="vk-followers">VK</Label>
                <Input 
                  id="vk-followers"
                  type="number" 
                  value={settings.minFollowers.vk} 
                  onChange={(e) => handleFollowersChange('vk', e.target.value)}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="facebook-followers">Facebook</Label>
                <Input 
                  id="facebook-followers"
                  type="number" 
                  value={settings.minFollowers.facebook} 
                  onChange={(e) => handleFollowersChange('facebook', e.target.value)}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="youtube-followers">YouTube</Label>
                <Input 
                  id="youtube-followers"
                  type="number" 
                  value={settings.minFollowers.youtube} 
                  onChange={(e) => handleFollowersChange('youtube', e.target.value)}
                  min={0}
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-sources">Максимальное количество источников на платформу</Label>
              <Input 
                id="max-sources"
                type="number" 
                value={settings.maxSourcesPerPlatform} 
                onChange={(e) => handleMaxSourcesChange(e.target.value)}
                min={1}
                max={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-trends">Максимальное количество трендов из источника</Label>
              <Input 
                id="max-trends"
                type="number" 
                value={settings.maxTrendsPerSource} 
                onChange={(e) => handleMaxTrendsChange(e.target.value)}
                min={1}
                max={50}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            'Сохранить настройки'
          )}
        </Button>
      </div>
    </div>
  );
}