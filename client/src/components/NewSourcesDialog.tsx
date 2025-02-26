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

const ITEMS_PER_PAGE = 5;

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  const { toast } = useToast();
  const [selectedSources, setSelectedSources] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectAll, setSelectAll] = useState(false);

  const sources = (() => {
    try {
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

  const totalPages = Math.ceil(sources.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSources = sources.slice(startIndex, endIndex);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedSources(sources);
    } else {
      setSelectedSources([]);
    }
  };

  const addSelectedSources = async () => {
    setIsAdding(true);
    try {
      for (const source of selectedSources) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: source.type || 'website',
          campaign_id: campaignId,
          is_active: true,
          update_frequency: source.post_frequency,
          metrics_info: source.example_stats,
          followers_count: source.followers
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
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                checked={selectAll}
                onCheckedChange={(checked: boolean) => handleSelectAll(checked)}
              />
              <span className="text-sm">Выбрать все источники</span>
            </div>

            <div className="space-y-2">
              {currentSources.map((source: any, index: number) => (
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
                    <div className="flex-1">
                      <h3 className="font-medium">{source.name}</h3>
                      <p className="text-sm text-muted-foreground">{source.url}</p>
                      <div className="mt-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Платформа:</span>
                          <span className="font-medium">
                            {source.type === 'twitter' ? 'Twitter/X' :
                             source.type === 'vk' ? 'ВКонтакте' :
                             source.type === 'telegram' ? 'Telegram' :
                             source.type === 'instagram' ? 'Instagram' :
                             source.type === 'facebook' ? 'Facebook' :
                             source.type === 'linkedin' ? 'LinkedIn' :
                             source.type === 'reddit' ? 'Reddit' :
                             source.type === 'youtube' ? 'YouTube' : source.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-muted-foreground">Подписчики:</span>
                          <span className="font-medium">{source.followers}</span>
                        </div>
                        {source.metrics_available && (
                          <div className="mt-2">
                            <p className="text-muted-foreground">Средние показатели:</p>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              <div>
                                👍 {source.example_stats?.avg_reactions || 'N/A'}
                              </div>
                              <div>
                                💬 {source.example_stats?.avg_comments || 'N/A'}
                              </div>
                              <div>
                                👀 {source.example_stats?.avg_views || 'N/A'}
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Обновляется: {source.post_frequency === 'daily' ? 'ежедневно' : 'еженедельно'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Вперед
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                Страница {currentPage} из {totalPages}
              </span>
            </div>

            <div className="flex justify-end gap-2 mt-4">
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