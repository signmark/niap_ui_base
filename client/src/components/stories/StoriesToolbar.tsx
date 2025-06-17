import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Palette, Image, Clock, Type, Brush } from 'lucide-react';
import type { StorySlide, StoryElement } from '@/types';

interface StoriesToolbarProps {
  slide: StorySlide;
  selectedElement: string | null;
  onElementStyleChange: (elementId: string, updates: Partial<StoryElement>) => void;
  onBackgroundChange: (background: StorySlide['background']) => void;
  onDurationChange: (duration: number) => void;
}

const PRESET_COLORS = [
  '#ffffff', '#000000', '#ff6b6b', '#4ecdc4', '#45b7d1', 
  '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'
];

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
];

export function StoriesToolbar({
  slide,
  selectedElement,
  onElementStyleChange,
  onBackgroundChange,
  onDurationChange
}: StoriesToolbarProps) {
  const selectedElementData = selectedElement 
    ? slide.elements.find(el => el.id === selectedElement)
    : null;

  return (
    <div className="w-80 border-l bg-muted/20 p-4 overflow-y-auto">
      <div className="space-y-6">
        {/* Фон слайда */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Фон слайда
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Тип фона */}
            <div>
              <Label className="text-xs">Тип фона</Label>
              <Select
                value={slide.background.type}
                onValueChange={(type: 'color' | 'gradient' | 'image') => 
                  onBackgroundChange({ ...slide.background, type })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">Цвет</SelectItem>
                  <SelectItem value="gradient">Градиент</SelectItem>
                  <SelectItem value="image">Изображение</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Цвета */}
            {slide.background.type === 'color' && (
              <div>
                <Label className="text-xs">Цвет</Label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded border-2 ${
                        slide.background.value === color ? 'border-primary' : 'border-border'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => onBackgroundChange({ type: 'color', value: color })}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={slide.background.value}
                  onChange={(e) => onBackgroundChange({ type: 'color', value: e.target.value })}
                  className="mt-2 h-8"
                />
              </div>
            )}

            {/* Градиенты */}
            {slide.background.type === 'gradient' && (
              <div>
                <Label className="text-xs">Градиент</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {GRADIENT_PRESETS.map((gradient, index) => (
                    <button
                      key={index}
                      className={`w-full h-8 rounded border-2 ${
                        slide.background.value === gradient ? 'border-primary' : 'border-border'
                      }`}
                      style={{ background: gradient }}
                      onClick={() => onBackgroundChange({ type: 'gradient', value: gradient })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Изображение */}
            {slide.background.type === 'image' && (
              <div>
                <Label className="text-xs">URL изображения</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={slide.background.value}
                  onChange={(e) => onBackgroundChange({ type: 'image', value: e.target.value })}
                  className="mt-2 h-8"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Настройки слайда */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Настройки слайда
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs">Длительность: {slide.duration}с</Label>
              <Slider
                value={[slide.duration]}
                onValueChange={([value]) => onDurationChange(value)}
                min={1}
                max={15}
                step={1}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Настройки выбранного элемента */}
        {selectedElementData && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brush className="h-4 w-4" />
                Элемент: {selectedElementData.type}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Настройки текста */}
              {selectedElementData.type === 'text' && (
                <>
                  <div>
                    <Label className="text-xs">Размер шрифта</Label>
                    <Slider
                      value={[selectedElementData.style?.fontSize || 24]}
                      onValueChange={([fontSize]) => 
                        onElementStyleChange(selectedElementData.id, {
                          style: { ...selectedElementData.style, fontSize }
                        })
                      }
                      min={12}
                      max={72}
                      step={2}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Цвет текста</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${
                            selectedElementData.style?.color === color ? 'border-primary' : 'border-border'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => 
                            onElementStyleChange(selectedElementData.id, {
                              style: { ...selectedElementData.style, color }
                            })
                          }
                        />
                      ))}
                    </div>
                    <Input
                      type="color"
                      value={selectedElementData.style?.color || '#ffffff'}
                      onChange={(e) => 
                        onElementStyleChange(selectedElementData.id, {
                          style: { ...selectedElementData.style, color: e.target.value }
                        })
                      }
                      className="mt-2 h-8"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Выравнивание</Label>
                    <Select
                      value={selectedElementData.style?.textAlign || 'center'}
                      onValueChange={(textAlign: 'left' | 'center' | 'right') => 
                        onElementStyleChange(selectedElementData.id, {
                          style: { ...selectedElementData.style, textAlign }
                        })
                      }
                    >
                      <SelectTrigger className="h-8 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Слева</SelectItem>
                        <SelectItem value="center">По центру</SelectItem>
                        <SelectItem value="right">Справа</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Начертание</Label>
                    <Select
                      value={selectedElementData.style?.fontWeight || 'bold'}
                      onValueChange={(fontWeight: 'normal' | 'bold') => 
                        onElementStyleChange(selectedElementData.id, {
                          style: { ...selectedElementData.style, fontWeight }
                        })
                      }
                    >
                      <SelectTrigger className="h-8 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Обычный</SelectItem>
                        <SelectItem value="bold">Жирный</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Фон текста</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      <button
                        className="w-6 h-6 rounded border-2 border-border bg-transparent relative"
                        onClick={() => 
                          onElementStyleChange(selectedElementData.id, {
                            style: { ...selectedElementData.style, backgroundColor: 'transparent' }
                          })
                        }
                      >
                        <div className="absolute inset-0 bg-red-500 transform rotate-45 w-px left-1/2 top-0"></div>
                      </button>
                      {PRESET_COLORS.slice(0, 4).map((color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${
                            selectedElementData.style?.backgroundColor === color ? 'border-primary' : 'border-border'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => 
                            onElementStyleChange(selectedElementData.id, {
                              style: { ...selectedElementData.style, backgroundColor: color }
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Общие настройки */}
              <Separator />
              <div>
                <Label className="text-xs">Прозрачность</Label>
                <Slider
                  value={[selectedElementData.style?.opacity || 1]}
                  onValueChange={([opacity]) => 
                    onElementStyleChange(selectedElementData.id, {
                      style: { ...selectedElementData.style, opacity }
                    })
                  }
                  min={0}
                  max={1}
                  step={0.1}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Информация */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Элементов на слайде: {slide.elements.length}</div>
              <div>Длительность: {slide.duration}с</div>
              {selectedElementData && (
                <div className="pt-2 border-t">
                  Выбран: {selectedElementData.type}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}