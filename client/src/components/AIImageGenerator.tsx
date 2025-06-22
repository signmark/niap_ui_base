import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

interface AIImageGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string) => void;
}

export function AIImageGenerator({ isOpen, onClose, onImageGenerated }: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('fast-sdxl');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const models = [
    { id: 'fast-sdxl', name: 'Fast SDXL', description: 'Быстрая генерация высокого качества' },
    { id: 'flux', name: 'Flux', description: 'Высокое качество деталей' },
    { id: 'stable-diffusion-v35-medium', name: 'SD v3.5 Medium', description: 'Баланс качества и скорости' }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Введите описание изображения');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/fal-ai-images', {
        prompt,
        negativePrompt: negativePrompt || undefined,
        width: 1024,
        height: 1024,
        numImages: 1,
        model
      });

      if (response.data.success && response.data.images && response.data.images.length > 0) {
        onImageGenerated(response.data.images[0]);
        setPrompt('');
        setNegativePrompt('');
      } else {
        setError('Не удалось сгенерировать изображение. Попробуйте другое описание.');
      }
    } catch (err: any) {
      setError(`Ошибка: ${err.response?.data?.error || err.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Генерация изображения с помощью ИИ
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="model">Модель</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите модель" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} - {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="prompt">Описание изображения</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите, какое изображение вы хотите создать..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="negativePrompt">Что исключить (необязательно)</Label>
            <Input
              id="negativePrompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="blurry, low quality, distorted..."
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Создать изображение
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}