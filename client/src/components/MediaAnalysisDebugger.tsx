import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

/**
 * Компонент для тестирования анализа медиаконтента
 * Отправляет запросы к API и отображает результаты
 */
export function MediaAnalysisDebugger() {
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    if (!mediaUrl) {
      setError('Пожалуйста, введите URL изображения для анализа');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Используем отладочный эндпоинт для медиа-анализа
      const response = await fetch('/api/debug/analyze-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Произошла ошибка при анализе медиаконтента');
      } else {
        setResult(data.result);
      }
    } catch (err) {
      console.error('Error analyzing media:', err);
      setError('Не удалось выполнить запрос к API анализа медиаконтента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Отладка анализа медиаконтента</CardTitle>
        <CardDescription>
          Введите URL изображения для тестирования анализа с помощью FAL AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mediaUrl">URL изображения</Label>
            <Input
              id="mediaUrl"
              placeholder="https://example.com/image.jpg"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="mt-4">
              <Separator className="my-2" />
              <h3 className="text-lg font-medium mb-2">Результаты анализа:</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Исходное изображение:</h4>
                  <img
                    src={result.mediaUrl}
                    alt="Анализируемое изображение"
                    className="w-full h-auto rounded-md border"
                  />
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">Результаты:</h4>
                  <pre className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-[300px]">
                    {JSON.stringify(result.analysis, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleTest} 
          disabled={loading || !mediaUrl}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализируем...
            </>
          ) : (
            'Анализировать изображение'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}