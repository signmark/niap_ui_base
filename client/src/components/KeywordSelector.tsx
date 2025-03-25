import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/store';
import { Checkbox } from '@/components/ui/checkbox';

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
  campaignId,
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
  const [existingKeywords, setExistingKeywords] = useState<string[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const { getAuthToken } = useAuthStore();

  const loadExistingKeywords = async () => {
    if (!campaignId) return;
    
    setIsLoadingExisting(true);
    try {
      const authToken = getAuthToken();
      const response = await fetch(`/api/keywords/${campaignId}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при загрузке ключевых слов: ${response.status}`);
      }
      
      const data = await response.json();
      const keywords = data.map((item: any) => item.keyword);
      setExistingKeywords(keywords);
      setSelectedItems(keywords);
      
      // Удаляем автоматический вызов onSelect при загрузке
      // Теперь пользователь должен явно нажать кнопку "Сохранить ключевые слова"
    } catch (error) {
      console.error('Error loading keywords:', error);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      console.log("Loading keywords for campaign:", campaignId);
      loadExistingKeywords();
    }
  }, [campaignId]);

  // Инициализируем выбранные элементы только при первоначальной загрузке компонента
  // или при изменении другой кампании, но не при каждом изменении selectedKeywords
  useEffect(() => {
    if (selectedKeywords && selectedKeywords.length > 0) {
      // Проверяем, действительно ли это новый массив, а не тот же самый
      setExistingKeywords(selectedKeywords);
      setSelectedItems(selectedKeywords);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setKeywords([]);
    
    try {
      // Получаем токен авторизации
      const authToken = getAuthToken();
      
      // Добавляем случайный параметр для предотвращения кеширования
      const nocache = Date.now();
      const response = await fetch(`/api/wordstat/${encodeURIComponent(searchTerm.trim())}?nocache=${nocache}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        }
      });
      
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

  // Функция для выбора/отмены выбора ключевого слова из результатов поиска
  const handleSelect = (keyword: string) => {
    const newSelected = [...selectedItems];
    
    if (newSelected.includes(keyword)) {
      const index = newSelected.indexOf(keyword);
      newSelected.splice(index, 1);
      
      // Показываем сообщение об удалении
      toast({
        description: `Ключевое слово "${keyword}" удалено`
      });
    } else {
      // Проверяем, что ключевое слово уникально для этой кампании
      if (!newSelected.includes(keyword)) {
        newSelected.push(keyword);
        
        // Показываем сообщение о добавлении
        toast({
          description: `Ключевое слово "${keyword}" добавлено`
        });
      }
    }
    
    setSelectedItems(newSelected);
    
    // Сразу сохраняем при выборе/отмене выбора из поиска
    onSelect(newSelected);
  };
  
  // Функция для удаления ключевого слова при клике на бейдж (для уже выбранных слов)
  // с мгновенным сохранением на сервере
  const handleRemoveKeyword = (keyword: string) => {
    const newSelected = selectedItems.filter(item => item !== keyword);
    setSelectedItems(newSelected);
    
    // Сразу сохраняем изменения на сервере
    onSelect(newSelected);
    
    toast({
      description: `Ключевое слово "${keyword}" удалено`
    });
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };
  
  // Функция для сравнения двух массивов строк (без учета порядка)
  const areArraysEqual = (array1: string[], array2: string[]): boolean => {
    if (array1.length !== array2.length) return false;
    
    // Создаем копии массивов для сортировки, чтобы не изменять оригиналы
    const sorted1 = [...array1].sort();
    const sorted2 = [...array2].sort();
    
    // Сравниваем каждый элемент
    return sorted1.every((item, index) => item === sorted2[index]);
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
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleRemoveKeyword(keyword)}
              >
                {keyword} ×
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
                  <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Выбрать</th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {keywords.map((item, index) => (
                  <tr key={index} className={selectedItems.includes(item.keyword) ? 'bg-primary/10' : ''}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{item.keyword}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatNumber(item.trend || 0)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div className="flex items-center justify-center">
                        <Checkbox 
                          checked={selectedItems.includes(item.keyword)}
                          onCheckedChange={() => handleSelect(item.keyword)}
                          id={`keyword-${index}`}
                        />
                      </div>
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
            <AlertDialogTitle>Требуется авторизация и API ключ XMLRiver</AlertDialogTitle>
            <AlertDialogDescription>
              Для поиска ключевых слов необходимо:
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Войти в аккаунт системы (авторизоваться)</li>
                <li>Добавить API ключ XMLRiver в настройках профиля</li>
              </ol>
              <div className="mt-4">
                Вы можете получить API ключ на сайте <a href="https://xmlriver.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">XMLRiver</a>.
              </div>
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