import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: {
    success?: boolean;
    data?: {
      sources: Array<{
        url: string;
        rank: number;
        keyword: string;
        followers?: number;
        description?: string;
        name: string;
      }>;
    };
  };
}

interface ParsedSource {
  name: string;
  url: string;
  type: 'twitter' | 'vk' | 'telegram' | 'instagram' | 'youtube' | 'reddit' | 'website' | 'facebook';
  rank: number;
  keyword: string;
  followers?: number;
  description?: string;
}

const ITEMS_PER_PAGE = 5;

const getRankBadge = (rank: number) => {
  if (rank <= 3) return { color: 'bg-green-100 text-green-800', text: 'Эксперт' };
  if (rank <= 6) return { color: 'bg-yellow-100 text-yellow-800', text: 'Специалист' };
  return { color: 'bg-blue-100 text-blue-800', text: 'Тематический канал' };
};

const formatFollowers = (count?: number) => {
  if (!count) return 'Неизвестно';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  console.log('Dialog received sourcesData:', sourcesData);
  const sources = sourcesData?.data?.sources || [];
  console.log('Parsed sources:', sources);

  const [selectedSources, setSelectedSources] = useState<ParsedSource[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectAll, setSelectAll] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const { add: toast } = useToast();

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

  const totalPages = Math.ceil(sources.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSources = sources.slice(startIndex, endIndex);

  const isSourceSelected = (source: ParsedSource) =>
    selectedSources.some(s => s.url === source.url);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedSources(prev => {
        const newSelected = [...prev];
        currentSources.forEach(source => {
          if (!isSourceSelected(source)) {
            newSelected.push(source);
          }
        });
        return newSelected;
      });
    } else {
      setSelectedSources(prev =>
        prev.filter(selected => !currentSources.some(s => s.url === selected.url))
      );
    }
  };


  const addSelectedSources = async () => {
    if (selectedSources.length === 0) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите хотя бы один источник"
      });
      return;
    }

    setIsAdding(true);
    setAddedCount(0);
    setFailedCount(0);

    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      let successCount = 0;
      let failureCount = 0;

      toast({
        title: "Добавление источников",
        description: "Начинаем добавление выбранных источников..."
      });

      for (const source of selectedSources) {
        try {
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
          successCount++;
          setAddedCount(successCount);
        } catch (error) {
          console.error(`Error adding source ${source.url}:`, error);
          failureCount++;
          setFailedCount(failureCount);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });

      if (successCount > 0) {
        toast({
          title: "Успешно",
          description: `Добавлено ${successCount} из ${selectedSources.length} источников${failureCount > 0 ? `, не удалось добавить ${failureCount}` : ''}`
        });

        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error("Не удалось добавить источники");
      }

    } catch (error) {
      console.error('Error adding sources:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось добавить источники"
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
        {!sourcesData?.success ? (
          <p className="text-center text-muted-foreground">
            Ошибка при получении источников
          </p>
        ) : sources.length === 0 ? (
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
                  <CardContent className="p-0">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{source.name}</h3>
                          {source.followers && (
                            <Badge variant="outline" className="whitespace-nowrap">
                              {formatFollowers(source.followers)} подписчиков
                            </Badge>
                          )}
                          <Badge className={getRankBadge(source.rank).color}>
                            {getRankBadge(source.rank).text} • Рейтинг {source.rank}/10
                          </Badge>
                        </div>

                        {source.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {source.description}
                          </p>
                        )}

                        <p className="text-sm break-all mt-2">
                          <a
                            href={source.url.startsWith('http') ? source.url : `https://${source.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {source.url}
                          </a>
                        </p>
                        <div className="mt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {source.type === 'twitter' ? 'Twitter/X' :
                                source.type === 'vk' ? 'ВКонтакте' :
                                  source.type === 'telegram' ? 'Telegram' :
                                    source.type === 'instagram' ? 'Instagram' :
                                      source.type === 'youtube' ? 'YouTube' :
                                        source.type === 'reddit' ? 'Reddit' : 'Веб-сайт'}
                            </Badge>
                            <Badge variant="outline">
                              {source.keyword}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
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
                    {addedCount > 0
                      ? `Добавлено ${addedCount}${failedCount > 0 ? `, ошибок: ${failedCount}` : ''}...`
                      : 'Добавление...'}
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