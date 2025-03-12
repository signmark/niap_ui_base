import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Search, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface WebsiteKeywordAnalyzerProps {
  campaignId: string;
  onKeywordsSelected?: (keywords: string[]) => void;
}

export function WebsiteKeywordAnalyzer({ campaignId, onKeywordsSelected }: WebsiteKeywordAnalyzerProps) {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { mutate: analyzeWebsite, isPending } = useMutation({
    mutationFn: async (websiteUrl: string) => {
      setIsAnalyzing(true);
      setError(null);
      
      // Нормализуем URL, добавляя протокол если его нет
      let normalizedUrl = websiteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      try {
        const response = await fetch(`/api/analyze-site/${encodeURIComponent(normalizedUrl)}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Не удалось проанализировать сайт");
        }
        
        const data = await response.json();
        return data.data.keywords || [];
      } catch (error: any) {
        throw new Error(error.message || "Ошибка при анализе сайта");
      } finally {
        setIsAnalyzing(false);
      }
    },
    onSuccess: (data) => {
      setKeywords(data);
      setSelectedKeywords([]);
      
      toast({
        title: "Анализ завершен",
        description: `Найдено ${data.length} ключевых слов`
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      setKeywords([]);
      
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message
      });
    }
  });

  const handleAnalyze = () => {
    if (!url.trim()) {
      setError("Введите URL сайта");
      return;
    }
    
    analyzeWebsite(url);
  };

  const toggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
    } else {
      setSelectedKeywords([...selectedKeywords, keyword]);
    }
  };

  const handleSaveKeywords = async () => {
    if (selectedKeywords.length === 0) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите хотя бы одно ключевое слово"
      });
      return;
    }
    
    try {
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({
          campaignId,
          keywords: selectedKeywords.map(keyword => ({
            keyword,
            trendScore: keywords.find(k => k.keyword === keyword)?.trend || 0
          }))
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Не удалось сохранить ключевые слова");
      }
      
      toast({
        title: "Успешно",
        description: `Добавлено ${selectedKeywords.length} ключевых слов`
      });
      
      // Обновляем список ключевых слов в родительском компоненте
      if (onKeywordsSelected) {
        onKeywordsSelected(selectedKeywords);
      }
      
      // Сбрасываем состояния
      setUrl("");
      setKeywords([]);
      setSelectedKeywords([]);
      
      // Инвалидируем кеш запроса ключевых слов
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", campaignId] });
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось сохранить ключевые слова"
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Анализ ключевых слов сайта
        </CardTitle>
        <CardDescription>
          Введите URL сайта для анализа и получения релевантных ключевых слов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-grow">
              <Label htmlFor="url" className="sr-only">URL сайта</Label>
              <Input
                id="url"
                placeholder="Введите URL сайта (например, site.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isPending}
              />
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={isPending || !url.trim()}
            >
              {isPending ? (
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
          
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {keywords.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Обнаруженные ключевые слова ({keywords.length})</h3>
                <span className="text-sm text-muted-foreground">
                  Выбрано: {selectedKeywords.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-md">
                {keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant={selectedKeywords.includes(keyword.keyword) ? "default" : "outline"}
                    className="cursor-pointer flex items-center gap-1"
                    onClick={() => toggleKeyword(keyword.keyword)}
                  >
                    {keyword.keyword}
                    <span className="text-xs opacity-70 ml-1">{keyword.trend}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {keywords.length > 0 && (
        <CardFooter>
          <div className="flex justify-end w-full">
            <Button
              onClick={handleSaveKeywords}
              disabled={selectedKeywords.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить выбранные ({selectedKeywords.length})
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}