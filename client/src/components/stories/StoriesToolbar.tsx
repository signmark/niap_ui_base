import React from 'react';
import { StorySlide, StoryElement } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Palette, Image, Type, Clock } from 'lucide-react';

interface StoriesToolbarProps {
  slide: StorySlide;
  selectedElement: string | null;
  onElementStyleChange: (elementId: string, updates: Partial<StoryElement>) => void;
  onBackgroundChange: (background: StorySlide['background']) => void;
  onDurationChange: (duration: number) => void;
}

export function StoriesToolbar({
  slide,
  selectedElement,
  onElementStyleChange,
  onBackgroundChange,
  onDurationChange
}: StoriesToolbarProps) {
  const selectedElementData = slide.elements.find(el => el.id === selectedElement);

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 space-y-4 overflow-y-auto">
      {/* Slide Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Настройки слайда
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-xs">Длительность (секунды)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[slide.duration]}
                onValueChange={(value) => onDurationChange(value[0])}
                min={1}
                max={15}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">{slide.duration}с</span>
            </div>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Palette className="h-3 w-3" />
              Фон
            </Label>
            <div className="space-y-2">
              <Select
                value={slide.background?.type || 'color'}
                onValueChange={(type: 'color' | 'image' | 'gradient' | 'video') => {
                  onBackgroundChange({
                    type,
                    value: slide.background?.value || (type === 'color' ? '#ffffff' : '')
                  });
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">Цвет</SelectItem>
                  <SelectItem value="image">Изображение</SelectItem>
                  <SelectItem value="gradient">Градиент</SelectItem>
                  <SelectItem value="video">Видео</SelectItem>
                </SelectContent>
              </Select>

              {slide.background?.type === 'color' && (
                <Input
                  type="color"
                  value={slide.background.value}
                  onChange={(e) => onBackgroundChange({
                    type: 'color',
                    value: e.target.value
                  })}
                  className="h-8"
                />
              )}

              {slide.background?.type === 'image' && (
                <Input
                  placeholder="URL изображения"
                  value={slide.background.value}
                  onChange={(e) => onBackgroundChange({
                    type: 'image',
                    value: e.target.value
                  })}
                  className="h-8"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Element Settings */}
      {selectedElementData ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {selectedElementData.type === 'text' && <Type className="h-4 w-4" />}
              {selectedElementData.type === 'image' && <Image className="h-4 w-4" />}
              Настройки элемента
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content */}
            <div className="space-y-2">
              <Label className="text-xs">Содержимое</Label>
              {selectedElementData.type === 'text' ? (
                <Textarea
                  value={selectedElementData.content || ''}
                  onChange={(e) => onElementStyleChange(selectedElementData.id, {
                    content: e.target.value
                  })}
                  placeholder="Введите текст"
                  className="min-h-[60px] text-sm"
                />
              ) : selectedElementData.type === 'image' ? (
                <Input
                  value={selectedElementData.content || ''}
                  onChange={(e) => onElementStyleChange(selectedElementData.id, {
                    content: e.target.value
                  })}
                  placeholder="URL изображения"
                  className="h-8"
                />
              ) : null}
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label className="text-xs">Позиция</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">X</Label>
                  <Input
                    type="number"
                    value={selectedElementData.position.x}
                    onChange={(e) => onElementStyleChange(selectedElementData.id, {
                      position: {
                        ...selectedElementData.position,
                        x: parseInt(e.target.value) || 0
                      }
                    })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Y</Label>
                  <Input
                    type="number"
                    value={selectedElementData.position.y}
                    onChange={(e) => onElementStyleChange(selectedElementData.id, {
                      position: {
                        ...selectedElementData.position,
                        y: parseInt(e.target.value) || 0
                      }
                    })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {/* Text-specific styles */}
            {selectedElementData.type === 'text' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Размер шрифта</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedElementData.style?.fontSize || 16]}
                      onValueChange={(value) => onElementStyleChange(selectedElementData.id, {
                        style: {
                          ...selectedElementData.style,
                          fontSize: value[0]
                        }
                      })}
                      min={8}
                      max={72}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-8">{selectedElementData.style?.fontSize || 16}px</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Цвет текста</Label>
                  <Input
                    type="color"
                    value={selectedElementData.style?.color || '#000000'}
                    onChange={(e) => onElementStyleChange(selectedElementData.id, {
                      style: {
                        ...selectedElementData.style,
                        color: e.target.value
                      }
                    })}
                    className="h-8"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Выравнивание</Label>
                  <Select
                    value={selectedElementData.style?.textAlign || 'left'}
                    onValueChange={(value: 'left' | 'center' | 'right') => onElementStyleChange(selectedElementData.id, {
                      style: {
                        ...selectedElementData.style,
                        textAlign: value
                      }
                    })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Слева</SelectItem>
                      <SelectItem value="center">По центру</SelectItem>
                      <SelectItem value="right">Справа</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Стиль шрифта</Label>
                  <Select
                    value={selectedElementData.style?.fontWeight || 'normal'}
                    onValueChange={(value: 'normal' | 'bold') => onElementStyleChange(selectedElementData.id, {
                      style: {
                        ...selectedElementData.style,
                        fontWeight: value
                      }
                    })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Обычный</SelectItem>
                      <SelectItem value="bold">Жирный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Common styles */}
            <div className="space-y-2">
              <Label className="text-xs">Фон элемента</Label>
              <Input
                type="color"
                value={selectedElementData.style?.backgroundColor || 'transparent'}
                onChange={(e) => onElementStyleChange(selectedElementData.id, {
                  style: {
                    ...selectedElementData.style,
                    backgroundColor: e.target.value
                  }
                })}
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Прозрачность</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selectedElementData.style?.opacity || 1]}
                  onValueChange={(value) => onElementStyleChange(selectedElementData.id, {
                    style: {
                      ...selectedElementData.style,
                      opacity: value[0]
                    }
                  })}
                  min={0}
                  max={1}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8">{Math.round((selectedElementData.style?.opacity || 1) * 100)}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Скругление углов</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[selectedElementData.style?.borderRadius || 0]}
                  onValueChange={(value) => onElementStyleChange(selectedElementData.id, {
                    style: {
                      ...selectedElementData.style,
                      borderRadius: value[0]
                    }
                  })}
                  min={0}
                  max={50}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8">{selectedElementData.style?.borderRadius || 0}px</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Выберите элемент для редактирования</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}