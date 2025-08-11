import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageIcon, Layers3, Type, Sticker, MapPin, Clock } from 'lucide-react';

export type StoryMode = 'simple' | 'video';

interface StoryModeSelectorProps {
  onModeSelect: (mode: StoryMode) => void;
}

export default function StoryModeSelector({ onModeSelect }: StoryModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<StoryMode | null>(null);

  const handleModeSelect = (mode: StoryMode) => {
    setSelectedMode(mode);
    onModeSelect(mode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Создание Stories</h1>
          <p className="text-gray-600">Выберите режим создания Stories для вашего контента</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Простой режим */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-6 w-6 text-blue-500" />
                  <CardTitle>Простой режим</CardTitle>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700">Рекомендуется</Badge>
              </div>
              <CardDescription>
                Одна картинка с настраиваемым текстом поверх
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Type className="h-4 w-4" />
                <span>Настраиваемый текст с выбором цвета и шрифта</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <ImageIcon className="h-4 w-4" />
                <span>Одно фоновое изображение</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>Точное позиционирование текста</span>
              </div>
              
              <Button 
                onClick={() => handleModeSelect('simple')}
                className="w-full"
                variant="outline"
              >
                Выбрать простой режим
              </Button>
            </CardContent>
          </Card>

          {/* Видео режим */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-purple-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-6 w-6 text-purple-500" />
                  <CardTitle>Видео Stories</CardTitle>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700">Видео контент</Badge>
              </div>
              <CardDescription>
                Создание видео Stories с текстом и эффектами
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Layers3 className="h-4 w-4" />
                <span>Загрузка видео</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Type className="h-4 w-4" />
                <span>Наложение текста на видео</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>До 30 секунд</span>
              </div>
              
              <Button 
                onClick={() => handleModeSelect('advanced')}
                className="w-full"
                variant="outline"
              >
                Выбрать видео режим
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Вы всегда можете переключиться между режимами в процессе создания
          </p>
        </div>
      </div>
    </div>
  );
}