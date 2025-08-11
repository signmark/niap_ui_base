import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Type, Move, Save, ArrowLeft, Download, Palette } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import Draggable from 'react-draggable';

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
}

interface SimpleStoryData {
  backgroundImage: string | null;
  textOverlay: TextOverlay;
  campaignId: string;
  title: string;
}

interface SimpleStoryEditorProps {
  campaignId: string;
  onBack: () => void;
}

export default function SimpleStoryEditor({ campaignId, onBack }: SimpleStoryEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [storyData, setStoryData] = useState<SimpleStoryData>({
    backgroundImage: null,
    textOverlay: {
      text: 'Добавьте ваш текст',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 10,
      borderRadius: 8
    },
    campaignId,
    title: 'Новая простая Stories'
  });

  // Загрузка изображения
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setStoryData(prev => ({
        ...prev,
        backgroundImage: imageUrl
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  // Обновление текста
  const updateTextOverlay = useCallback((updates: Partial<TextOverlay>) => {
    setStoryData(prev => ({
      ...prev,
      textOverlay: { ...prev.textOverlay, ...updates }
    }));
  }, []);

  // Обновление позиции текста при перетаскивании
  const handleTextDrag = useCallback((e: any, data: any) => {
    updateTextOverlay({ x: data.x, y: data.y });
  }, [updateTextOverlay]);

  // Генерация финального изображения
  const generateFinalImage = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('Canvas не найден'));
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D контекст не доступен'));
        return;
      }

      // Устанавливаем размер Stories (9:16)
      canvas.width = 1080;
      canvas.height = 1920;

      const { textOverlay, backgroundImage } = storyData;

      if (backgroundImage) {
        const img = new Image();
        img.onload = () => {
          // Рисуем фоновое изображение
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Рисуем текст
          drawTextOverlay(ctx, textOverlay, canvas.width, canvas.height);
          
          // Конвертируем в base64
          const dataURL = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataURL);
        };
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        img.src = backgroundImage;
      } else {
        // Рисуем только цветной фон
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        drawTextOverlay(ctx, textOverlay, canvas.width, canvas.height);
        
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);
        resolve(dataURL);
      }
    });
  }, [storyData]);

  // Функция отрисовки текста на canvas
  const drawTextOverlay = (ctx: CanvasRenderingContext2D, overlay: TextOverlay, canvasWidth: number, canvasHeight: number) => {
    const { text, fontSize, color, fontFamily, fontWeight, textAlign, backgroundColor, padding = 10, borderRadius = 8 } = overlay;
    
    // Масштабируем координаты с превью на canvas
    const scaleX = canvasWidth / 400;  // 400px - ширина превью
    const scaleY = canvasHeight / 711; // 711px - высота превью (9:16 от 400px)
    
    const scaledX = overlay.x * scaleX;
    const scaledY = overlay.y * scaleY;
    const scaledFontSize = fontSize * Math.min(scaleX, scaleY);

    ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    // Измеряем текст
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = scaledFontSize;

    let textX = scaledX;
    if (textAlign === 'center') {
      textX = scaledX;
    } else if (textAlign === 'right') {
      textX = scaledX - textWidth;
    }

    // Рисуем фон текста если есть
    if (backgroundColor && backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      const bgX = textX - textWidth / 2 - padding;
      const bgY = scaledY - textHeight / 2 - padding;
      const bgWidth = textWidth + padding * 2;
      const bgHeight = textHeight + padding * 2;
      
      if (borderRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      }
    }

    // Рисуем текст
    ctx.fillStyle = color;
    ctx.fillText(text, textX, scaledY);
  };

  // Сохранение Stories
  const saveStoryMutation = useMutation({
    mutationFn: async () => {
      const finalImage = await generateFinalImage();
      
      // Подготавливаем данные для сохранения
      const storyContent = {
        mode: 'simple',
        backgroundImage: storyData.backgroundImage,
        textOverlay: storyData.textOverlay,
        finalImage
      };

      return apiRequest(`/api/stories`, {
        method: 'POST',
        json: {
          campaignId: storyData.campaignId,
          title: storyData.title,
          content: JSON.stringify(storyContent),
          type: 'story',
          status: 'draft'
        }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Успешно!',
        description: 'Stories сохранена'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить Stories',
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Заголовок */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Простой редактор Stories</h1>
              <p className="text-gray-600">Одна картинка с настраиваемым текстом</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => saveStoryMutation.mutate()}
              disabled={saveStoryMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveStoryMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Панель настроек */}
          <div className="lg:col-span-1 space-y-6">
            {/* Загрузка изображения */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Фоновое изображение
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Выбрать изображение
                </Button>
              </CardContent>
            </Card>

            {/* Настройки текста */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Настройки текста
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="storyTitle">Название Stories</Label>
                  <Input
                    id="storyTitle"
                    value={storyData.title}
                    onChange={(e) => setStoryData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Введите название"
                  />
                </div>
                
                <div>
                  <Label htmlFor="textContent">Текст</Label>
                  <Textarea
                    id="textContent"
                    value={storyData.textOverlay.text}
                    onChange={(e) => updateTextOverlay({ text: e.target.value })}
                    placeholder="Введите текст для наложения"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Размер шрифта: {storyData.textOverlay.fontSize}px</Label>
                  <Slider
                    value={[storyData.textOverlay.fontSize]}
                    onValueChange={([value]) => updateTextOverlay({ fontSize: value })}
                    min={16}
                    max={72}
                    step={2}
                  />
                </div>

                <div>
                  <Label htmlFor="textColor">Цвет текста</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="textColor"
                      value={storyData.textOverlay.color}
                      onChange={(e) => updateTextOverlay({ color: e.target.value })}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={storyData.textOverlay.color}
                      onChange={(e) => updateTextOverlay({ color: e.target.value })}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="backgroundColor">Цвет фона текста</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="backgroundColor"
                      value={storyData.textOverlay.backgroundColor?.replace('rgba(0,0,0,0.5)', '#000000') || '#000000'}
                      onChange={(e) => {
                        const color = e.target.value;
                        const rgb = parseInt(color.slice(1), 16);
                        const r = (rgb >> 16) & 255;
                        const g = (rgb >> 8) & 255;
                        const b = rgb & 255;
                        updateTextOverlay({ backgroundColor: `rgba(${r},${g},${b},0.7)` });
                      }}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Button
                      variant="outline"
                      onClick={() => updateTextOverlay({ backgroundColor: 'transparent' })}
                      size="sm"
                    >
                      Без фона
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="fontFamily">Шрифт</Label>
                  <Select
                    value={storyData.textOverlay.fontFamily}
                    onValueChange={(value) => updateTextOverlay({ fontFamily: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fontWeight">Начертание</Label>
                  <Select
                    value={storyData.textOverlay.fontWeight}
                    onValueChange={(value) => updateTextOverlay({ fontWeight: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Обычный</SelectItem>
                      <SelectItem value="bold">Жирный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="textAlign">Выравнивание</Label>
                  <Select
                    value={storyData.textOverlay.textAlign}
                    onValueChange={(value: 'left' | 'center' | 'right') => updateTextOverlay({ textAlign: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">По левому краю</SelectItem>
                      <SelectItem value="center">По центру</SelectItem>
                      <SelectItem value="right">По правому краю</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Превью */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Move className="h-4 w-4" />
                  Превью Stories (перетаскивайте текст)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="relative mx-auto bg-gray-200 overflow-hidden"
                  style={{ width: '400px', height: '711px' }} // 9:16 aspect ratio
                >
                  {/* Фоновое изображение */}
                  {storyData.backgroundImage && (
                    <img
                      src={storyData.backgroundImage}
                      alt="Background"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Перетаскиваемый текст */}
                  <Draggable
                    position={{ x: storyData.textOverlay.x, y: storyData.textOverlay.y }}
                    onDrag={handleTextDrag}
                    bounds="parent"
                  >
                    <div
                      className="absolute cursor-move select-none"
                      style={{
                        fontSize: `${storyData.textOverlay.fontSize}px`,
                        color: storyData.textOverlay.color,
                        fontFamily: storyData.textOverlay.fontFamily,
                        fontWeight: storyData.textOverlay.fontWeight,
                        textAlign: storyData.textOverlay.textAlign,
                        backgroundColor: storyData.textOverlay.backgroundColor,
                        padding: storyData.textOverlay.padding ? `${storyData.textOverlay.padding}px` : undefined,
                        borderRadius: storyData.textOverlay.borderRadius ? `${storyData.textOverlay.borderRadius}px` : undefined,
                        whiteSpace: 'pre-wrap',
                        maxWidth: '350px'
                      }}
                    >
                      {storyData.textOverlay.text}
                    </div>
                  </Draggable>
                </div>

                {/* Скрытый canvas для генерации */}
                <canvas
                  ref={canvasRef}
                  style={{ display: 'none' }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}