import React, { useRef, useEffect, useState } from 'react';
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
  Palette
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

interface Element {
  id: string;
  type: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  isSelected?: boolean;
}

interface SimpleStoriesEditorProps {
  campaignId?: string;
  onSave?: (storyData: InstagramStoryJSON, imageDataUrl: string) => void;
}

export default function SimpleStoriesEditor({ campaignId, onSave }: SimpleStoriesEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState(40);
  const [textColor, setTextColor] = useState('#000000');
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const { toast } = useToast();

  // Масштабирование для отображения в UI
  const scaleFactor = 0.3;
  const displayWidth = STORY_WIDTH * scaleFactor;
  const displayHeight = STORY_HEIGHT * scaleFactor;

  // Отрисовка canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очистка и установка фона
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Отрисовка элементов
    elements.forEach((element) => {
      if (element.type === 'text') {
        ctx.fillStyle = element.color || '#000000';
        ctx.font = `${(element.fontSize || 40) * scaleFactor}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(
          element.content,
          element.x * scaleFactor,
          element.y * scaleFactor
        );

        // Рамка для выбранного элемента
        if (element.isSelected) {
          ctx.strokeStyle = '#007bff';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            (element.x - 5) * scaleFactor,
            (element.y - element.height - 5) * scaleFactor,
            (element.width + 10) * scaleFactor,
            (element.height + 10) * scaleFactor
          );
        }
      }
    });
  };

  // Перерисовка при изменениях
  useEffect(() => {
    drawCanvas();
  }, [backgroundColor, elements, selectedElement]);

  // Добавление текста
  const addText = () => {
    if (!textContent.trim()) return;

    const newElement: Element = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: textContent,
      x: 100,
      y: 200,
      width: textContent.length * fontSize * 0.6,
      height: fontSize,
      fontSize: fontSize,
      color: textColor,
    };

    setElements([...elements, newElement]);
    setTextContent('');
  };

  // Обработка клика по canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scaleFactor;
    const y = (event.clientY - rect.top) / scaleFactor;

    // Поиск кликнутого элемента
    let clickedElement = null;
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y - element.height &&
        y <= element.y
      ) {
        clickedElement = element.id;
        break;
      }
    }

    // Обновление выбранного элемента
    setElements(elements.map(el => ({
      ...el,
      isSelected: el.id === clickedElement
    })));
    setSelectedElement(clickedElement);
  };

  // Удаление выбранного элемента
  const deleteSelected = () => {
    if (!selectedElement) return;
    setElements(elements.filter(el => el.id !== selectedElement));
    setSelectedElement(null);
  };

  // Экспорт в JSON (совместимый с Instagram API)
  const exportToInstagramJSON = (): InstagramStoryJSON => {
    const jsonElements = elements.map((element) => ({
      type: element.type,
      content: element.content,
      position: { x: element.x, y: element.y },
      size: { width: element.width, height: element.height },
      style: {
        fontSize: element.fontSize,
        fontFamily: 'Arial',
        color: element.color,
        textAlign: 'left' as const,
      },
    }));

    return {
      version: '1.0',
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      background: {
        type: 'color',
        value: backgroundColor,
      },
      elements: jsonElements,
      metadata: {
        createdAt: new Date().toISOString(),
        campaignId,
      },
    };
  };

  // Экспорт изображения в полном размере для Instagram API
  const exportImage = (): string => {
    // Создаем временный canvas в полном размере
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = STORY_WIDTH;
    tempCanvas.height = STORY_HEIGHT;
    const ctx = tempCanvas.getContext('2d');

    if (!ctx) throw new Error('Canvas context not available');

    // Фон
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    // Элементы в полном размере
    elements.forEach((element) => {
      if (element.type === 'text') {
        ctx.fillStyle = element.color || '#000000';
        ctx.font = `${element.fontSize || 40}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(element.content, element.x, element.y);
      }
    });

    return tempCanvas.toDataURL('image/jpeg', 0.9);
  };

  // Мутация для сохранения
  const saveStoryMutation = useMutation({
    mutationFn: async (storyData: { json: InstagramStoryJSON; image: string }) => {
      // Здесь будет вызов API для сохранения
      console.log('Saving story:', storyData);
      return { success: true };
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
              <div className="space-y-2">
                <Input
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Введите текст"
                />
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    placeholder="Размер"
                    className="w-20"
                  />
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-12 h-8"
                  />
                </div>
                <Button onClick={addText} className="w-full">
                  <Type className="w-4 h-4 mr-2" />
                  Добавить текст
                </Button>
              </div>
            </div>

            {/* Управление элементами */}
            <div>
              <Label>Элементы ({elements.length})</Label>
              <div className="space-y-2">
                {elements.map((element) => (
                  <div
                    key={element.id}
                    className={`p-2 border rounded cursor-pointer ${
                      element.isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      setElements(elements.map(el => ({
                        ...el,
                        isSelected: el.id === element.id
                      })));
                      setSelectedElement(element.id);
                    }}
                  >
                    <div className="text-sm font-medium">
                      {element.type === 'text' ? 'Текст' : 'Изображение'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {element.content}
                    </div>
                  </div>
                ))}
              </div>
              {selectedElement && (
                <Button onClick={deleteSelected} variant="destructive" size="sm" className="w-full mt-2">
                  Удалить выбранный
                </Button>
              )}
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

            {/* Информация */}
            <div className="text-xs text-gray-500">
              <div>Размер: {STORY_WIDTH}x{STORY_HEIGHT}px</div>
              <div>Формат: Instagram Stories</div>
              <div>Элементов: {elements.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={displayWidth}
            height={displayHeight}
            onClick={handleCanvasClick}
            className="border cursor-pointer"
          />
          <div className="p-2 text-center text-sm text-gray-500">
            Кликните по элементам для выбора
          </div>
        </div>
      </div>
    </div>
  );
}