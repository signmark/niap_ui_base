import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: {
    success?: boolean;
    data?: {
      sources: Array<{
        url: string;
        name: string;
        followers: number;
        platform: string;
        description: string;
        rank: number;
      }>;
    };
  };
}

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  console.log('Dialog received sourcesData:', sourcesData);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const { add: toast } = useToast();

  // Тестовые данные для отладки отображения
  const testSources = [
    {
      url: 'https://instagram.com/bewellbykelly',
      name: 'Kelly LeVeque',
      followers: 550700,
      platform: 'instagram.com',
      description: 'Clinical nutritionist, best-selling author, and mom',
      rank: 5
    },
    {
      url: 'https://instagram.com/pp_mari_food',
      name: 'Марина',
      followers: 200000,
      platform: 'instagram.com',
      description: 'Рецепты и советы по правильному питанию',
      rank: 5
    }
  ];

  const handleAddSources = async () => {
    if (selectedSources.length === 0) {
      toast({
        description: "Выберите хотя бы один источник",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      const sourcesToAdd = testSources.filter(source => 
        selectedSources.includes(source.url)
      );

      for (const source of sourcesToAdd) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: 'instagram',
          campaign_id: campaignId,
          is_active: true
        });
      }

      toast({
        description: `Добавлено ${sourcesToAdd.length} источников`
      });
      onClose();
    } catch (error) {
      console.error('Error adding sources:', error);
      toast({
        description: "Ошибка при добавлении источников",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Тестовый вывод источников</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {testSources.map((source, index) => (
            <Card key={index} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedSources.includes(source.url)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSources([...selectedSources, source.url]);
                      } else {
                        setSelectedSources(selectedSources.filter(url => url !== source.url));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{source.name}</h3>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {source.followers} подписчиков
                      </Badge>
                    </div>

                    {source.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {source.description}
                      </p>
                    )}

                    <p className="text-sm break-all mt-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {source.url}
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleAddSources} 
            disabled={selectedSources.length === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Добавление...
              </>
            ) : (
              `Добавить ${selectedSources.length} источников`
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}