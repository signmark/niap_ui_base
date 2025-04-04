import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface TextEnhancementDialogProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  onApply: (enhancedText: string) => void;
}

export function TextEnhancementDialog({ 
  open, 
  onClose, 
  originalText, 
  onApply 
}: TextEnhancementDialogProps) {
  // Состояния для различных режимов диалога
  const [isLoading, setIsLoading] = useState(false);
  const [enhancedText, setEnhancedText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needApiKey, setNeedApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Общие инструкции для улучшения текста
  const enhancementPresets = [
    { label: 'Исправить ошибки и улучшить читаемость', value: 'Исправь грамматические и стилистические ошибки. Сделай текст более читабельным и структурированным.' },
    { label: 'Добавить эмодзи и сделать более привлекательным', value: 'Добавь эмодзи и сделай текст более привлекательным для социальных сетей, сохраняя суть и стиль.' },
    { label: 'Оптимизировать для Instagram', value: 'Оптимизируй текст для Instagram. Сделай его кратким, но информативным, добавь эмодзи и улучши структуру.' },
    { label: 'Оптимизировать для Telegram', value: 'Оптимизируй для Telegram-канала. Улучши структуру, добавь подзаголовки и маркированные списки, сохраняя основной смысл.' },
    { label: 'Профессиональный стиль', value: 'Перепиши текст в более профессиональном стиле, используя деловой язык и сохраняя все ключевые моменты.' },
  ];

  // Отправка запроса на улучшение текста
  const enhanceText = async () => {
    setIsLoading(true);
    setError(null);
    setNeedApiKey(false);
    
    try {
      const response = await apiRequest('/api/claude/improve-text', {
        method: 'POST',
        data: {
          text: originalText,
          prompt: instructions
        }
      });
      
      if (response.success && response.text) {
        setEnhancedText(response.text);
        setSuccess(true);
      } else {
        setError(response.error || 'Произошла ошибка при улучшении текста');
      }
    } catch (error: any) {
      console.error('Ошибка при улучшении текста:', error);
      
      // Проверяем, нужен ли API ключ
      if (error.response?.data?.needApiKey) {
        setNeedApiKey(true);
        setError('Для использования Claude AI необходимо добавить API ключ');
      } else {
        setError(error.response?.data?.error || error.message || 'Произошла ошибка при улучшении текста');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Сохранение API ключа
  const saveApiKey = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/claude/save-api-key', {
        method: 'POST',
        data: { apiKey }
      });
      
      if (response.success) {
        setNeedApiKey(false);
        // После сохранения ключа пробуем улучшить текст снова
        enhanceText();
      } else {
        setError(response.error || 'Не удалось сохранить API ключ');
      }
    } catch (error: any) {
      console.error('Ошибка при сохранении API ключа:', error);
      setError(error.response?.data?.error || error.message || 'Произошла ошибка при сохранении API ключа');
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик закрытия диалога с очисткой состояния
  const handleClose = () => {
    // Сбрасываем все состояния при закрытии
    setEnhancedText('');
    setInstructions('');
    setError(null);
    setNeedApiKey(false);
    setApiKey('');
    setSuccess(false);
    onClose();
  };

  // Обработчик применения улучшенного текста
  const handleApply = () => {
    onApply(enhancedText);
    handleClose();
  };

  // Отрендерить соответствующее содержимое диалога в зависимости от состояния
  const renderDialogContent = () => {
    // Если необходимо ввести API ключ
    if (needApiKey) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Необходим API ключ Claude AI</DialogTitle>
            <DialogDescription>
              Для использования функций Claude AI необходимо добавить свой API ключ. Вы можете получить его на сайте Anthropic.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="api-key">API ключ Claude AI</Label>
              <Input
                id="api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Введите ваш API ключ Claude"
                type="password"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              onClick={saveApiKey}
              disabled={isLoading || !apiKey}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить ключ'
              )}
            </Button>
          </DialogFooter>
        </>
      );
    }
    
    // Если показываем результат улучшения
    if (success && enhancedText) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Текст успешно улучшен</DialogTitle>
            <DialogDescription>
              Просмотрите улучшенный текст и примените его, если он вам подходит.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Готово!</AlertTitle>
              <AlertDescription>Текст был успешно улучшен с помощью Claude AI.</AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="enhanced-text">Улучшенный текст</Label>
              <Textarea
                id="enhanced-text"
                value={enhancedText}
                onChange={(e) => setEnhancedText(e.target.value)}
                className="h-[200px]"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button onClick={handleApply}>
              Применить
            </Button>
          </DialogFooter>
        </>
      );
    }
    
    // Форма ввода инструкций для улучшения текста (по умолчанию)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Улучшение текста с помощью Claude AI</DialogTitle>
          <DialogDescription>
            Введите инструкции для улучшения текста или выберите один из готовых шаблонов.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label>Выберите шаблон инструкций</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {enhancementPresets.map((preset, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => setInstructions(preset.value)}
                  className="justify-start"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="instructions">Инструкции для улучшения</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Опишите, как именно нужно улучшить текст..."
              className="h-[100px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="original-text">Исходный текст</Label>
            <Textarea
              id="original-text"
              value={originalText}
              readOnly
              className="h-[100px] bg-muted"
            />
          </div>
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button
            onClick={enhanceText}
            disabled={isLoading || !instructions}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Улучшение...
              </>
            ) : (
              'Улучшить текст'
            )}
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl">
        {renderDialogContent()}
      </DialogContent>
    </Dialog>
  );
}