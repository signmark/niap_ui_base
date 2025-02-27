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
  const { toast } = useToast();
  const [selectedSources, setSelectedSources] = useState<ParsedSource[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectAll, setSelectAll] = useState(false);

  // Функция для определения типа источника по URL
  const detectSourceType = (url: string): ParsedSource['type'] => {
    const lowercaseUrl = url.toLowerCase();

    // Проверяем в порядке приоритета
    if (lowercaseUrl.includes('twitter.com') || lowercaseUrl.includes('x.com')) {
      return 'twitter';
    }
    if (lowercaseUrl.includes('vk.com')) {
      return 'vk';
    }
    if (lowercaseUrl.includes('telegram.me') || lowercaseUrl.includes('t.me')) {
      return 'telegram';
    }
    if (lowercaseUrl.includes('instagram.com')) {
      return 'instagram';
    }
    if (lowercaseUrl.includes('facebook.com') || lowercaseUrl.includes('fb.com')) {
      return 'facebook';
    }
    if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) {
      return 'youtube';
    }
    if (lowercaseUrl.includes('linkedin.com')) {
      return 'linkedin';
    }
    if (lowercaseUrl.includes('reddit.com')) {
      return 'reddit';
    }
    // Если не нашли соответствий, значит это обычный веб-сайт
    return 'website';
  };

  // Парсинг ответа API
  const sources = (() => {
    try {
      console.log('Raw sourcesData:', sourcesData);

      if (!sourcesData?.choices?.[0]?.message?.content) {
        console.error('Invalid API response structure');
        return [];
      }

      const content = sourcesData.choices[0].message.content;
      console.log('API response content:', content);

      // Извлекаем URL из markdown-ссылок [text](url)
      const markdownUrls = Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g))
        .map(match => match[2])
        .filter(url => !url.includes('непосредственный URL отсутствует'));

      // Извлекаем прямые упоминания URL
      const directUrls = Array.from(content.matchAll(/(?:^|\s)((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s\)"',]+)/gm))
        .map(match => match[1])
        .filter(url => !url.includes('непосредственный URL отсутствует'));

      // Объединяем все найденные URL
      const allUrls = [...new Set([...markdownUrls, ...directUrls])];
      console.log('Found URLs:', allUrls);

      return allUrls
        .map(url => {
          // Добавляем протокол, если его нет
          const fullUrl = url.startsWith('http') ? url : 'https://' + url;
          const type = detectSourceType(fullUrl);

          // Игнорируем не-соцсети
          if (type === 'website') {
            return null;
          }

          let name = '';
          try {
            const urlObj = new URL(fullUrl);
            name = urlObj.pathname.split('/').pop() || urlObj.hostname.replace('www.', '');
          } catch (e) {
            name = 'Unknown Source';
          }

          return {
            name,
            url: fullUrl,
            type
          };
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
    setIsAdding(true);
    try {
      for (const source of selectedSources) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: source.type,
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
      console.error('Error adding sources:', error);
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
                checked={currentSources.every(s => isSourceSelected(s))}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">Выбрать все источники на этой странице</span>
            </div>

            <div className="space-y-2">
              {currentSources.map((source, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
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
