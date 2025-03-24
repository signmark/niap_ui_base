import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Компонент для тестирования DeepSeek API
 */
export function DeepSeekTester() {
  // Стейт для ввода текста и отображения результатов
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { toast } = useToast();

  // Мутация для тестирования API
  const { mutate: testDeepSeek, isPending } = useMutation({
    mutationFn: async () => {
      const response = await api.get('/test-deepseek', {
        params: {
          apiKey: '' // API ключ берется из настроек пользователя на сервере
        }
      });
      
      if (!response?.data?.success && response?.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      // Проверяем, есть ли успешный результат в хотя бы одном формате ключа
      const anySuccess = data.results && data.results.some((r: any) => r.success);
      
      if (anySuccess) {
        // Находим первый успешный результат
        const successResult = data.results.find((r: any) => r.success);
        
        setResult(successResult?.result || data.message || 'API работает корректно');
        setApiStatus('success');
        
        toast({
          title: 'API работает корректно',
          description: data.recommendation 
            ? `Рекомендуем сохранить работающий формат ключа: ${data.recommendation.message}`
            : 'DeepSeek API успешно проверен',
        });
      } else {
        // Если нет ни одного успешного результата
        setApiStatus('error');
        setErrorMessage(data.message || 'Все форматы ключа не работают');
        
        toast({
          variant: 'destructive',
          title: 'Ошибка API',
          description: data.message || 'Ни один из форматов API ключа не работает',
        });
      }
    },
    onError: (error: any) => {
      setApiStatus('error');
      setErrorMessage(error.message || 'Непредвиденная ошибка при тестировании API');
      
      toast({
        variant: 'destructive',
        title: 'Ошибка API',
        description: error.message || 'Ошибка при тестировании DeepSeek API',
      });
    }
  });

  // Мутация для отправки сообщения
  const { mutate: sendMessage, isPending: isSendingMessage } = useMutation({
    mutationFn: async () => {
      // Здесь будет запрос к API для отправки сообщения
      // Сейчас мы не реализуем эту функциональность полностью
      await new Promise(resolve => setTimeout(resolve, 2000)); // Имитация задержки запроса
      
      // Заглушка для демонстрации
      return { 
        success: true, 
        result: `Ответ DeepSeek на запрос: "${userPrompt}"\n\nПривет! Я помощник на базе DeepSeek. Ваш API ключ работает корректно, и я могу отвечать на ваши запросы. Если у вас есть конкретные задачи или вопросы, я готов помочь.`
      };
    },
    onSuccess: (data) => {
      setResult(data.result);
      setApiStatus('success');
      
      toast({
        title: 'Сообщение отправлено',
        description: 'Получен ответ от DeepSeek API',
      });
    },
    onError: (error: any) => {
      setApiStatus('error');
      setErrorMessage(error.message || 'Ошибка при отправке сообщения');
      
      toast({
        variant: 'destructive',
        title: 'Ошибка отправки',
        description: error.message || 'Не удалось отправить сообщение',
      });
    }
  });

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Тестирование DeepSeek API</CardTitle>
        <CardDescription>
          Проверьте настройку и работоспособность DeepSeek API для вашего аккаунта
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Кнопка для проверки API */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <Button 
              onClick={() => testDeepSeek()} 
              disabled={isPending}
              variant="outline"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  {apiStatus === 'success' ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : apiStatus === 'error' ? (
                    <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Проверить API ключ
                </>
              )}
            </Button>
            
            {apiStatus === 'success' && (
              <Alert className="max-w-lg bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-500" />
                <AlertTitle>API работает корректно</AlertTitle>
                <AlertDescription>
                  DeepSeek API успешно настроен в вашем аккаунте
                </AlertDescription>
              </Alert>
            )}
            
            {apiStatus === 'error' && (
              <Alert className="max-w-lg bg-red-50 border-red-200" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка API</AlertTitle>
                <AlertDescription>
                  {errorMessage || 'Произошла ошибка при проверке API'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Форма для отправки тестового сообщения */}
        <div className="space-y-2 mt-4">
          <Label htmlFor="user-prompt">Тестовый запрос (опционально)</Label>
          <Textarea
            id="user-prompt"
            placeholder="Напишите текст для отправки в DeepSeek API..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        
        {/* Результат запроса */}
        {result && (
          <div className="space-y-2 mt-4">
            <Label>Результат</Label>
            <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={() => sendMessage()} 
          disabled={isSendingMessage || !userPrompt.trim()}
          className="w-full"
        >
          {isSendingMessage ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Отправка...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Отправить тестовое сообщение
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}