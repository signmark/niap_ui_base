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
      </div>
    </DialogContent>
  );
}