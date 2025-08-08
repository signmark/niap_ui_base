import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SimpleTestPage() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Тест простой Stories</h1>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Левая панель */}
          <Card>
            <CardHeader>
              <CardTitle>Управление</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">URL изображения:</label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Введите URL изображения"
                />
              </div>
              
              <Button 
                onClick={() => setImageUrl('https://i.ibb.co/67MznnkR/1754567298358-672451295.jpg')}
                variant="outline"
              >
                Установить тестовое изображение
              </Button>
              
              <div className="text-sm text-gray-600">
                Текущий URL: {imageUrl}
              </div>
            </CardContent>
          </Card>

          {/* Правая панель - превью */}
          <Card>
            <CardHeader>
              <CardTitle>Превью Stories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-sm mx-auto">
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-lg bg-gray-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Stories preview"
                      className="w-full h-full object-cover"
                      onLoad={() => console.log('✅ Изображение загружено')}
                      onError={() => console.log('❌ Ошибка загрузки изображения')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📱</div>
                        <p>Загрузите изображение</p>
                        <p className="text-xs">Рекомендуемые размеры:</p>
                        <p className="text-xs">1080x1920 пикселей</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}