import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: {
    success: boolean;
    data: {
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
  const sources = sourcesData?.data?.sources || [];
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const sourcesPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Вычисляем пагинацию
  const totalPages = Math.ceil(sources.length / sourcesPerPage);
  const startIndex = (currentPage - 1) * sourcesPerPage;
  const endIndex = startIndex + sourcesPerPage;
  const currentSources = sources.slice(startIndex, endIndex);

  const handleAddSources = async () => {
    if (selectedSources.length === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы один источник",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const sourcesToAdd = sources.filter(source => 
        selectedSources.includes(source.url)
      );

      for (const source of sourcesToAdd) {
        await fetch('/api/sources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            name: source.name,
            url: source.url,
            type: source.platform,
            campaignId: campaignId,
            isActive: true
          })
        }).then(response => {
          if (!response.ok) {
            throw new Error(`Ошибка при добавлении источника ${source.name}`);
          }
          return response.json();
        });
      }

      // Инвалидируем запрос на получение источников для выбранной кампании
      await queryClient.invalidateQueries({ queryKey: ["campaign_content_sources", campaignId] });

      toast({
        title: "Успешно",
        description: `Добавлено ${sourcesToAdd.length} источников`
      });
      onClose();
    } catch (error) {
      console.error('Error adding sources:', error);
      toast({
        title: "Ошибка",
        description: "Ошибка при добавлении источников",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Выбираем только текущие отображаемые источники
      const currentPageUrls = currentSources.map(source => source.url);
      setSelectedSources(prev => {
        const otherPages = prev.filter(url => !currentPageUrls.includes(url));
        return checked ? [...otherPages, ...currentPageUrls] : otherPages;
      });
    } else {
      // Снимаем выделение только с текущих отображаемых источников
      const currentPageUrls = currentSources.map(source => source.url);
      setSelectedSources(prev => prev.filter(url => !currentPageUrls.includes(url)));
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Найденные источники</DialogTitle>
        <DialogDescription>
          Выберите источники для добавления в кампанию
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {!sources || sources.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Поиск источников... Если долго нет результатов, попробуйте еще раз
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={currentSources.every(source => selectedSources.includes(source.url))}
                  onCheckedChange={handleSelectAll}
                  aria-label="Выбрать все источники на текущей странице"
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Выбрать все на странице
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                {sources.length} источников
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentSources.map((source, index) => (
                <Card key={source.url}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id={`source-${index}`}
                        checked={selectedSources.includes(source.url)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSources([...selectedSources, source.url]);
                          } else {
                            setSelectedSources(selectedSources.filter(url => url !== source.url));
                          }
                        }}
                        aria-label={`Выбрать источник ${source.name}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{source.name}</h3>
                          <Badge variant="outline" className="whitespace-nowrap">
                            {source.followers >= 1000000 
                              ? `${(source.followers / 1000000).toFixed(1)}M`
                              : source.followers >= 1000 
                              ? `${(source.followers / 1000).toFixed(1)}K`
                              : source.followers} подписчиков
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Страница {currentPage} из {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Следующая страница"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

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