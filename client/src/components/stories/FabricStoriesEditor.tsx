import React, { useEffect, useRef, useState } from 'react';
// Временно используем HTML5 Canvas вместо fabric.js
// TODO: настроить fabric.js корректно
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Type, 
  Image, 
  Download,
  Save,
  Upload,
  Palette,
  Square,
  Circle
} from 'lucide-react';

// Instagram Stories размеры (официальные)
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

// JSON структура совместимая с Instagram API
interface InstagramStoryJSON {
  version: string;
  width: number;
  height: number;
  background: {
    type: 'color' | 'image';
    value: string;
  };
  elements: {
    type: 'text' | 'image';
    content: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    style: {
      fontSize?: number;
      fontFamily?: string;
      color?: string;
      textAlign?: string;
    };
  }[];
  metadata: {
    createdAt: string;
    campaignId?: string;
  };
}

interface FabricStoriesEditorProps {
  campaignId?: string;
  onSave?: (storyData: InstagramStoryJSON, imageDataUrl: string) => void;
}

export default function FabricStoriesEditor({ campaignId, onSave }: FabricStoriesEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textContent, setTextContent] = useState('');
  const { toast } = useToast();

  // Инициализация Fabric.js canvas
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      // Создаем canvas с размерами Instagram Stories
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: STORY_WIDTH / 2, // Уменьшаем для UI (будем масштабировать при экспорте)
        height: STORY_HEIGHT / 2,
        backgroundColor: backgroundColor,
      });

      fabricCanvasRef.current = canvas;

      // Добавляем обработчики событий
      canvas.on('object:modified', () => {
        console.log('Object modified');
      });

      return () => {
        canvas.dispose();
      };
    }
  }, []);

  // Обновление фона
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setBackgroundColor(backgroundColor, () => {
        fabricCanvasRef.current?.renderAll();
      });
    }
  }, [backgroundColor]);

  // Добавление текста
  const addText = () => {
    if (!fabricCanvasRef.current || !textContent.trim()) return;

    const text = new fabric.Text(textContent, {
      left: 100,
      top: 100,
      fontSize: 40,
      fill: '#000000',
      fontFamily: 'Arial',
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    setTextContent('');
  };

  // Добавление прямоугольника
  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;

    const rect = new fabric.Rect({
      left: 150,
      top: 150,
      width: 200,
      height: 100,
      fill: '#ff6b6b',
      stroke: '#000000',
      strokeWidth: 2,
    });

    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect);
  };

  // Добавление круга
  const addCircle = () => {
    if (!fabricCanvasRef.current) return;

    const circle = new fabric.Circle({
      left: 200,
      top: 200,
      radius: 50,
      fill: '#4ecdc4',
      stroke: '#000000',
      strokeWidth: 2,
    });

    fabricCanvasRef.current.add(circle);
    fabricCanvasRef.current.setActiveObject(circle);
  };

  // Загрузка изображения
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvasRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      
      fabric.Image.fromURL(imgSrc, (img) => {
        // Масштабируем изображение для Stories
        const maxWidth = STORY_WIDTH / 3;
        const maxHeight = STORY_HEIGHT / 3;
        
        img.scaleToWidth(maxWidth);
        if (img.getScaledHeight() > maxHeight) {
          img.scaleToHeight(maxHeight);
        }

        img.set({
          left: 100,
          top: 300,
        });

        fabricCanvasRef.current?.add(img);
        fabricCanvasRef.current?.setActiveObject(img);
      });
    };
    reader.readAsDataURL(file);
  };

  // Экспорт в JSON (совместимый с Instagram API)
  const exportToInstagramJSON = (): InstagramStoryJSON => {
    if (!fabricCanvasRef.current) {
      throw new Error('Canvas not initialized');
    }

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();

    const elements = objects.map((obj) => {
      if (obj.type === 'text') {
        const textObj = obj as fabric.Text;
        return {
          type: 'text' as const,
          content: textObj.text || '',
          position: { x: textObj.left || 0, y: textObj.top || 0 },
          size: { width: textObj.width || 0, height: textObj.height || 0 },
          style: {
            fontSize: textObj.fontSize,
            fontFamily: textObj.fontFamily,
            color: textObj.fill as string,
            textAlign: textObj.textAlign,
          },
        };
      } else if (obj.type === 'image') {
        const imgObj = obj as fabric.Image;
        return {
          type: 'image' as const,
          content: imgObj.getSrc(),
          position: { x: imgObj.left || 0, y: imgObj.top || 0 },
          size: { width: imgObj.width || 0, height: imgObj.height || 0 },
          style: {},
        };
      }
      return null;
    }).filter(Boolean) as InstagramStoryJSON['elements'];

    return {
      version: '1.0',
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      background: {
        type: 'color',
        value: backgroundColor,
      },
      elements,
      metadata: {
        createdAt: new Date().toISOString(),
        campaignId,
      },
    };
  };

  // Экспорт изображения для Instagram API
  const exportImage = (): string => {
    if (!fabricCanvasRef.current) {
      throw new Error('Canvas not initialized');
    }

    // Временно масштабируем canvas до полного размера Stories
    const canvas = fabricCanvasRef.current;
    const originalZoom = canvas.getZoom();
    const scaleFactor = 2; // Возвращаем к полному размеру

    canvas.setZoom(scaleFactor);
    canvas.setWidth(STORY_WIDTH);
    canvas.setHeight(STORY_HEIGHT);

    // Экспортируем изображение
    const dataURL = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.9,
      multiplier: 1,
    });

    // Возвращаем исходный размер
    canvas.setZoom(originalZoom);
    canvas.setWidth(STORY_WIDTH / 2);
    canvas.setHeight(STORY_HEIGHT / 2);

    return dataURL;
  };

  // Мутация для сохранения Stories
  const saveStoryMutation = useMutation({
    mutationFn: async (storyData: { json: InstagramStoryJSON; image: string }) => {
      return apiRequest('/api/stories/save', {
        method: 'POST',
        body: JSON.stringify({
          campaignId,
          storyJson: storyData.json,
          imageDataUrl: storyData.image,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Stories сохранена',
      });
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: `Не удалось сохранить: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Обработчик сохранения
  const handleSave = () => {
    try {
      const storyJSON = exportToInstagramJSON();
      const imageDataUrl = exportImage();

      if (onSave) {
        onSave(storyJSON, imageDataUrl);
      } else {
        saveStoryMutation.mutate({ json: storyJSON, image: imageDataUrl });
      }
    } catch (error) {
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось экспортировать Stories',
        variant: 'destructive',
      });
    }
  };

  // Скачивание изображения
  const handleDownload = () => {
    try {
      const imageDataUrl = exportImage();
      const link = document.createElement('a');
      link.download = `story-${Date.now()}.jpg`;
      link.href = imageDataUrl;
      link.click();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скачать изображение',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-screen">
      {/* Панель инструментов */}
      <div className="w-80 bg-gray-50 p-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Instagram Stories Редактор</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Фон */}
            <div>
              <Label>Цвет фона</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-8"
                />
                <Input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Добавление текста */}
            <div>
              <Label>Добавить текст</Label>
              <div className="flex space-x-2">
                <Input
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Введите текст"
                />
                <Button onClick={addText} size="sm">
                  <Type className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Добавление фигур */}
            <div>
              <Label>Добавить элементы</Label>
              <div className="flex space-x-2">
                <Button onClick={addRectangle} size="sm" variant="outline">
                  <Square className="w-4 h-4" />
                </Button>
                <Button onClick={addCircle} size="sm" variant="outline">
                  <Circle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Загрузка изображения */}
            <div>
              <Label>Загрузить изображение</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>

            {/* Действия */}
            <div className="space-y-2">
              <Button onClick={handleSave} className="w-full" disabled={saveStoryMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Сохранить Stories
              </Button>
              <Button onClick={handleDownload} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Скачать изображение
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}