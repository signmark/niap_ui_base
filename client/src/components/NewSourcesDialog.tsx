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

interface ParsedSource {
  name: string;
  url: string;
  type: 'twitter' | 'vk' | 'telegram' | 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'reddit' | 'website';
}

const ITEMS_PER_PAGE = 5;

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  const toast = useToast();
  const [selectedSources, setSelectedSources] = useState<ParsedSource[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectAll, setSelectAll] = useState(false);

  const detectSourceType = (url: string): ParsedSource['type'] => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.includes('youtube.com')) return 'youtube';
    if (lowercaseUrl.includes('vk.com')) return 'vk';
    if (lowercaseUrl.includes('telegram.me') || lowercaseUrl.includes('t.me')) return 'telegram';
    if (lowercaseUrl.includes('instagram.com')) return 'instagram';
    if (lowercaseUrl.includes('facebook.com')) return 'facebook';
    if (lowercaseUrl.includes('twitter.com')) return 'twitter';
    if (lowercaseUrl.includes('reddit.com')) return 'reddit';
    return 'website';
  };

  const sources = (() => {
    try {
      if (!sourcesData?.data) {
        console.error('Invalid API response structure');
        return [];
      }

      return sourcesData.data
        .map((url: string) => {
          const type = detectSourceType(url);
          if (type === 'website') return null;

          let name = '';
          try {
            const urlObj = new URL(url);
            name = urlObj.pathname.split('/').pop() || urlObj.hostname.replace('www.', '');
          } catch (e) {
            name = 'Unknown Source';
          }

          return { name, url, type };
        })
        .filter(Boolean);
    } catch (e) {
      console.error('Error parsing sources:', e);
      return [];
    }
  })();

  const totalPages = Math.ceil(sources.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSources = sources.slice(startIndex, endIndex);

  const isSourceSelected = (source: ParsedSource) =>
    selectedSources.some(s => s.url === source.url);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const newSelected = [...selectedSources];
      currentSources.forEach(source => {
        if (!isSourceSelected(source)) {
          newSelected.push(source);
        }
      });
      setSelectedSources(newSelected);
    } else {
      setSelectedSources(selectedSources.filter(
        selected => !currentSources.some(s => s.url === selected.url)
      ));
    }
  };

  const addSelectedSources = async () => {
    if (selectedSources.length === 0) {
      toast.add({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите хотя бы один источник"
      });
      return;
    }

    setIsAdding(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      for (const source of selectedSources) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: source.type,
          campaign_id: campaignId,
          is_active: true
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });

      toast.add({
        title: "Успешно",
        description: `Добавлено ${selectedSources.length} источников`
      });

      onClose();
    } catch (error) {
      console.error('Error adding sources:', error);
      toast.add({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить источники"
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
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
                id="select-all"
                checked={currentSources.every(s => isSourceSelected(s))}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm">
                Выбрать все источники на этой странице
              </label>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentSources.map((source, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={`source-${index}`}
                      checked={isSourceSelected(source)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSources([...selectedSources, source]);
                        } else {
                          setSelectedSources(selectedSources.filter(s => s.url !== source.url));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{source.name}</h3>
                      <p className="text-sm text-muted-foreground break-all">{source.url}</p>
                      <div className="mt-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Платформа:</span>
                          <span className="font-medium">
                            {source.type === 'twitter' ? 'Twitter/X' :
                              source.type === 'vk' ? 'ВКонтакте' :
                                source.type === 'telegram' ? 'Telegram' :
                                  source.type === 'instagram' ? 'Instagram' :
                                    source.type === 'facebook' ? 'Facebook' :
                                      source.type === 'youtube' ? 'YouTube' :
                                        source.type === 'linkedin' ? 'LinkedIn' :
                                          source.type === 'reddit' ? 'Reddit' : 'Веб-сайт'}
                          </span>
                        </div>
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

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
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