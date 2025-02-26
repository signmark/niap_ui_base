import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: any;
}

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  const { toast } = useToast();
  const [selectedSources, setSelectedSources] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Парсим результаты из Perplexity
  const sources = (() => {
    try {
      // Извлекаем JSON из ответа
      const content = sourcesData.choices[0].message.content;
      let jsonStr = content.substring(
        content.indexOf('{'),
        content.lastIndexOf('}') + 1
      );
      const data = JSON.parse(jsonStr);
      return Array.isArray(data.sources) ? data.sources : [];
    } catch (e) {
      console.error('Error parsing sources:', e);
      return [];
    }
  })();

  const addSelectedSources = async () => {
    setIsAdding(true);
    try {
      // Добавляем каждый выбранный источник через Directus API
      for (const source of selectedSources) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: source.type || 'website',
          campaign_id: campaignId,
          is_active: true
        });
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      toast({
        title: "Успешно",
        description: "Источники добавлены"
      });
      onClose();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить источники"
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Найденные источники</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {sources.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Не удалось найти подходящие источники
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {sources.map((source: any, index: number) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedSources.includes(source)}
                      onCheckedChange={(checked) => {
                        setSelectedSources(prev =>
                          checked
                            ? [...prev, source]
                            : prev.filter(s => s !== source)
                        );
                      }}
                    />
                    <div>
                      <h3 className="font-medium">{source.name}</h3>
                      <p className="text-sm text-muted-foreground">{source.url}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button
                onClick={addSelectedSources}
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
          </>
        )}
      </div>
    </DialogContent>
  );
}
