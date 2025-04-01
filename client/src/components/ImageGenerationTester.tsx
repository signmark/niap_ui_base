import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import axios from 'axios';

// Компонент для тестирования API генерации изображений с использованием разных моделей FAL.AI
export function ImageGenerationTester() {
  const [prompt, setPrompt] = useState('A beautiful landscape in the style of Thomas Kinkade');
  const [negativePrompt, setNegativePrompt] = useState('Ugly, distorted, low quality');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [numImages, setNumImages] = useState(1);
  const [model, setModel] = useState('fast-sdxl');

  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const generateImages = async () => {
    setLoading(true);
    setError(null);
    setImages([]);
    
    try {
      const result = await axios.post('/api/generate-universal-image', {
        prompt,
        negativePrompt,
        width,
        height,
        numImages,
        model
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      
      if (result.data.success) {
        setImages(result.data.data);
        toast({
          title: "Изображения успешно сгенерированы",
          description: `Получено ${result.data.data.length} изображений с использованием модели ${model}`,
        });
      } else {
        setError(result.data.error || 'Неизвестная ошибка при генерации изображений');
        toast({
          title: "Ошибка",
          description: result.data.error || 'Неизвестная ошибка при генерации изображений',
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error('Error generating images:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка при генерации изображений';
      setError(errorMessage);
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Тестирование универсального API генерации изображений</h2>
        <p className="text-gray-500">Этот компонент позволяет тестировать API генерации изображений с использованием разных моделей FAL.AI</p>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="model">Модель для генерации</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast-sdxl">Fast SDXL (быстрая)</SelectItem>
              <SelectItem value="sdxl">SDXL (высокое качество)</SelectItem>
              <SelectItem value="schnell">Schnell (самая быстрая)</SelectItem>
              <SelectItem value="fooocus">Fooocus (расширенные возможности)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Промпт</Label>
          <Textarea
            id="prompt"
            placeholder="Опишите изображение, которое хотите сгенерировать"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="negativePrompt">Негативный промпт</Label>
          <Textarea
            id="negativePrompt"
            placeholder="Опишите, чего НЕ должно быть на изображении"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="width">Ширина</Label>
            <Input
              id="width"
              type="number"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 512)}
              min={256}
              max={2048}
              step={64}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="height">Высота</Label>
            <Input
              id="height"
              type="number"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 512)}
              min={256}
              max={2048}
              step={64}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="numImages">Количество изображений</Label>
            <Input
              id="numImages"
              type="number"
              value={numImages}
              onChange={(e) => setNumImages(parseInt(e.target.value) || 1)}
              min={1}
              max={4}
              step={1}
            />
          </div>
        </div>

        <Button 
          className="mt-4" 
          onClick={generateImages} 
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Генерация...
            </>
          ) : "Сгенерировать изображения"}
        </Button>

        {error && (
          <div className="text-red-500 p-3 border border-red-300 bg-red-50 rounded-md">
            <p className="font-semibold">Ошибка:</p>
            <p>{error}</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="space-y-4 mt-6">
            <h3 className="text-xl font-semibold">Результаты генерации:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((imageUrl, index) => (
                <Card key={index} className="overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt={`Generated image ${index + 1}`} 
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      // Если изображение не загрузилось, показываем сообщение об ошибке
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'p-4 text-red-500';
                      errorDiv.textContent = 'Ошибка загрузки изображения';
                      target.parentNode?.appendChild(errorDiv);
                    }}
                  />
                  <div className="p-3 bg-gray-50 text-sm">
                    <p className="font-medium">Изображение {index + 1}</p>
                    <p className="text-gray-500 truncate text-xs">{imageUrl}</p>
                    <a 
                      href={imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs"
                    >
                      Открыть в новой вкладке
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageGenerationTester;