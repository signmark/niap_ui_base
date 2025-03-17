import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link, Globe, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WebsiteKeywordAnalyzerProps {
  campaignId: string;
  onKeywordsSelected?: (keywords: any[]) => void;
}

export function WebsiteKeywordAnalyzer({ campaignId, onKeywordsSelected }: WebsiteKeywordAnalyzerProps) {
  const [url, setUrl] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Фильтр для URL
  const isValidUrl = (text: string) => {
    try {
      // Проверяем, что URL содержит домен
      const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
      return urlPattern.test(text);
    } catch {
      return false;
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast({
        title: "Необходимо указать URL",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUrl(url)) {
      toast({
        title: "Некорректный URL",
        description: "Пожалуйста, укажите корректный URL сайта",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setKeywords([]);
    setSelectedKeywords(new Set());

    // Нормализуем URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      // Используем новый эндпоинт для анализа сайта
      const encodedUrl = encodeURIComponent(normalizedUrl);
      const nocache = Date.now(); // Добавляем параметр для предотвращения кеширования
      const response = await api.get(`/analyze-site/${encodedUrl}?nocache=${nocache}`);
      
      if (!response.data?.data?.keywords?.length) {
        toast({
          title: "Нет результатов",
          description: "Не удалось извлечь ключевые слова с сайта",
        });
        return;
      }

      const extractedKeywords = response.data.data.keywords;
      setKeywords(extractedKeywords);
      
      // Уведомляем пользователя
      toast({
        title: "Анализ завершен",
        description: `Найдено ${extractedKeywords.length} ключевых слов`,
      });
    } catch (error) {
      console.error("Ошибка при анализе сайта:", error);
      toast({
        title: "Ошибка анализа",
        description: "Не удалось проанализировать сайт. Попробуйте другой URL.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleKeyword = (keyword: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      // Выбираем все ключевые слова
      const allKeywords = keywords.map((kw) => kw.keyword);
      setSelectedKeywords(new Set(allKeywords));
    } else {
      // Снимаем выделение со всех
      setSelectedKeywords(new Set());
    }
  };

  const handleSaveSelected = async () => {
    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Выберите кампанию",
        variant: "destructive",
      });
      return;
    }

    if (selectedKeywords.size === 0) {
      toast({
        title: "Нет выбранных ключевых слов",
        description: "Выберите хотя бы одно ключевое слово",
        variant: "destructive",
      });
      return;
    }

    try {
      // Получаем полные объекты выбранных ключевых слов
      const selectedKeywordObjects = keywords.filter((kw) => 
        selectedKeywords.has(kw.keyword)
      );

      // Если есть внешний обработчик, вызываем его с выбранными объектами ключевых слов
      if (onKeywordsSelected) {
        onKeywordsSelected(selectedKeywordObjects);
      }
      // В противном случае сохраняем ключевые слова сами
      else {
        // Отправляем каждое ключевое слово отдельно
        for (const keyword of selectedKeywordObjects) {
          await api.post("/user-keywords", {
            keyword: keyword.keyword,
            trendScore: keyword.trend,
            mentionsCount: keyword.competition,
            campaignId,
          });
        }

        toast({
          title: "Успешно сохранено",
          description: `${selectedKeywords.size} ключевых слов добавлено в кампанию`,
        });
        
        // Сбрасываем выбранные ключевые слова
        setSelectedKeywords(new Set());
      }
    } catch (error) {
      console.error("Ошибка при сохранении ключевых слов:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить ключевые слова",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Анализ сайта</CardTitle>
        <CardDescription>
          Введите URL сайта для автоматического извлечения релевантных ключевых слов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Введите URL сайта для анализа"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={isAnalyzing || !url.trim()}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализ...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Анализировать
              </>
            )}
          </Button>
        </div>

        {keywords.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedKeywords.size === keywords.length && keywords.length > 0}
                  onCheckedChange={toggleAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Выбрать все
                </label>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveSelected}
                disabled={selectedKeywords.size === 0}
              >
                Сохранить выбранные ({selectedKeywords.size})
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableCaption>Ключевые слова, найденные на сайте</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Ключевое слово</TableHead>
                    <TableHead className="text-right">Популярность</TableHead>
                    <TableHead className="text-right">Конкуренция</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((keyword, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={selectedKeywords.has(keyword.keyword)}
                          onCheckedChange={() => toggleKeyword(keyword.keyword)}
                        />
                      </TableCell>
                      <TableCell>{keyword.keyword}</TableCell>
                      <TableCell className="text-right">{keyword.trend.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{keyword.competition}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          {isAnalyzing ? (
            <span>Анализируем сайт...</span>
          ) : keywords.length > 0 ? (
            <span>Найдено {keywords.length} ключевых слов</span>
          ) : (
            <span>Введите URL сайта и нажмите "Анализировать"</span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}