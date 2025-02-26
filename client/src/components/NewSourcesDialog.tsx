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

interface Source {
  name: string;
  url: string;
  type: string;
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

      // Сначала пытаемся извлечь JSON из текста
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const urls = JSON.parse(jsonMatch[0]);
          if (Array.isArray(urls)) {
            return urls
              .filter(url => {
                try {
                  new URL(url);
                  return true;
                } catch {
                  return false;
                }
              })
              .map(url => {
                const cleanUrl = url.trim();
                const type = detectSourceType(cleanUrl);

                // Извлекаем название из URL в зависимости от типа
                let name = '';
                try {
                  const urlObj = new URL(cleanUrl);
                  switch (type) {
                    case 'telegram':
                      name = urlObj.pathname.split('/').pop() || 'Telegram Channel';
                      break;
                    case 'vk':
                      name = urlObj.pathname.split('/').pop() || 'VK Group';
                      break;
                    case 'youtube':
                      name = urlObj.pathname.includes('/channel/') ?
                        'YouTube Channel' : urlObj.pathname.split('/').pop() || 'YouTube';
                      break;
                    case 'reddit':
                      name = urlObj.pathname.split('/r/')[1]?.split('/')[0] || 'Reddit';
                      break;
                    case 'twitter':
                      name = urlObj.pathname.split('/').pop() || 'Twitter/X';
                      break;
                    case 'instagram':
                      name = urlObj.pathname.split('/').pop() || 'Instagram';
                      break;
                    case 'facebook':
                      name = urlObj.pathname.split('/').pop() || 'Facebook';
                      break;
                    case 'linkedin':
                      name = urlObj.pathname.split('/').pop() || 'LinkedIn';
                      break;
                    default:
                      name = urlObj.hostname.replace(/^www\./, '');
                  }
                } catch (e) {
                  name = 'Unknown Source';
                }

                return {
                  name,
                  url: cleanUrl,
                  type
                };
              });
          }
        } catch (e) {
          console.error('Error parsing JSON from text:', e);
        }
      }

      // Если не удалось извлечь JSON, ищем все URL в тексте
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/[^\s]*)?/g;
      const matches = [...content.matchAll(urlRegex)];

      return matches
        .map(match => match[0])
        .filter(url => {
          try {
            if (!url.startsWith('http')) {
              url = 'https://' + url;
            }
            new URL(url);
            const type = detectSourceType(url);
            return type !== 'website'; // Оставляем только URL социальных сетей
          } catch {
            return false;
          }
        })
        .map(url => {
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          const type = detectSourceType(url);
          let name = '';
          try {
            const urlObj = new URL(url);
            switch (type) {
              case 'telegram':
                name = urlObj.pathname.split('/').pop() || 'Telegram Channel';
                break;
              case 'vk':
                name = urlObj.pathname.split('/').pop() || 'VK Group';
                break;
              case 'youtube':
                name = urlObj.pathname.includes('/channel/') ?
                  'YouTube Channel' : urlObj.pathname.split('/').pop() || 'YouTube';
                break;
              case 'reddit':
                name = urlObj.pathname.split('/r/')[1]?.split('/')[0] || 'Reddit';
                break;
              case 'twitter':
                name = urlObj.pathname.split('/').pop() || 'Twitter/X';
                break;
              case 'instagram':
                name = urlObj.pathname.split('/').pop() || 'Instagram';
                break;
              case 'facebook':
                name = urlObj.pathname.split('/').pop() || 'Facebook';
                break;
              case 'linkedin':
                name = urlObj.pathname.split('/').pop() || 'LinkedIn';
                break;
              default:
                name = urlObj.hostname.replace(/^www\./, '');
            }
          } catch (e) {
            name = 'Unknown Source';
          }

          return {
            name,
            url,
            type
          };
        });

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