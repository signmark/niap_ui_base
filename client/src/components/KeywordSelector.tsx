import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Keyword {
  keyword: string;
  frequency?: number;
  trend?: number;
  competition?: number;
  source?: string;
}

interface KeywordSelectorProps {
  onSelect: (keywords: string[]) => void;
  selectedKeywords?: string[];
  campaignId?: string;
  label?: string;
  placeholder?: string;
}

export function KeywordSelector({
  onSelect,
  selectedKeywords = [],
  label = 'Ключевые слова',
  placeholder = 'Введите ключевое слово или фразу',
}: KeywordSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>(selectedKeywords || []);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedKeywords) {
      setSelectedItems(selectedKeywords);
    }
  }, [selectedKeywords]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setKeywords([]);
    
    try {
      // Добавляем случайный параметр для предотвращения кеширования
      const nocache = Date.now();
      const response = await fetch(`/api/wordstat/${encodeURIComponent(searchTerm.trim())}?nocache=${nocache}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setShowApiKeyDialog(true);
          setIsLoading(false);
          return;
        }
        throw new Error(`Ошибка при поиске ключевых слов: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data?.data?.keywords?.length) {
        toast({ 
          title: "Результаты",
          description: "Не найдено ключевых слов" 
        });
        setIsLoading(false);
        return;
      }

      const formattedResults = data.data.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        trend: parseInt(kw.trend) || 0,
        competition: parseInt(kw.competition) || 0,
      }));

      setKeywords(formattedResults);
      
      toast({ 
        title: "Успешно",
        description: `Найдено ${formattedResults.length} ключевых слов` 
      });
      
    } catch (error) {
      console.error('Error searching keywords:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Произошла ошибка при поиске ключевых слов');
      
      toast({
        title: 'Ошибка поиска',
        description: error instanceof Error ? error.message : 'Произошла ошибка при поиске ключевых слов',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelect = (keyword: string) => {
    const newSelected = [...selectedItems];
    
    if (newSelected.includes(keyword)) {
      const index = newSelected.indexOf(keyword);
      newSelected.splice(index, 1);
    } else {
      newSelected.push(keyword);
    }
    
    setSelectedItems(newSelected);
    onSelect(newSelected);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <div className="font-medium">{label}</div>
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isLoading || !searchTerm.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Поиск
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-destructive/15 p-3 rounded-md flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-destructive text-sm">{errorMessage}</div>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Выбранные ключевые слова:</div>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((keyword) => (
              <Badge 
                key={keyword} 
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => handleSelect(keyword)}
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {keywords.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Результаты поиска:</div>
          <div className="max-h-60 overflow-y-auto border rounded-md">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Ключевое слово</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Частота</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Добавить</th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {keywords.map((item, index) => (
                  <tr key={index} className={selectedItems.includes(item.keyword) ? 'bg-primary/10' : ''}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{item.keyword}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatNumber(item.trend || 0)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <Button
                        variant={selectedItems.includes(item.keyword) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelect(item.keyword)}
                      >
                        {selectedItems.includes(item.keyword) ? 'Убрать' : 'Добавить'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Требуется API ключ XMLRiver</AlertDialogTitle>
            <AlertDialogDescription>
              Для поиска ключевых слов необходимо добавить API ключ XMLRiver в настройках профиля.
              <br /><br />
              Вы можете получить API ключ на сайте <a href="https://xmlriver.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">XMLRiver</a>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowApiKeyDialog(false)}>
              Понятно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}