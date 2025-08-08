import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Image, 
  Layers,
  Wand2,
  Plus,
  ArrowRight
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useCampaignStore } from '@/lib/campaignStore';

interface StoriesTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StoriesTypeDialog({ isOpen, onClose }: StoriesTypeDialogProps) {
  const [, setLocation] = useLocation();
  const selectedCampaign = useCampaignStore(state => state.selectedCampaign);
  const campaignId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";

  const storiesTypes = [
    {
      id: 'simple',
      title: 'Простая Stories',
      description: 'Одно изображение - быстро и просто',
      icon: Image,
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      features: ['Одно изображение', 'AI генерация картинок', 'Быстрое создание'],
      route: `/stories/simple`
    },
    {
      id: 'multi',
      title: 'Многослайдовые Stories',
      description: 'Несколько слайдов с интерактивными элементами',
      icon: Layers,
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      features: ['Множественные слайды', 'Интерактивные элементы', 'Опросы и викторины', 'Расширенное редактирование'],
      route: `/stories/new?campaign=${campaignId}`
    }
  ];

  const handleSelect = (route: string) => {
    setLocation(route);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            Выберите тип Instagram Stories
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 py-6">
          {storiesTypes.map((type) => {
            const IconComponent = type.icon;
            
            return (
              <Card 
                key={type.id}
                className={`cursor-pointer transition-all duration-200 ${type.color} hover:shadow-md`}
                onClick={() => handleSelect(type.route)}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Иконка и заголовок */}
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-white shadow-sm">
                        <IconComponent className="w-6 h-6 text-gray-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{type.title}</h3>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>

                    {/* Список возможностей */}
                    <div className="space-y-2">
                      {type.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Plus className="w-3 h-3 text-green-600" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Кнопка действия */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500">
                        {type.id === 'simple' ? 'Рекомендуется для начинающих' : 'Для опытных пользователей'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center pt-4 border-t">
          <p className="text-sm text-gray-500">
            💡 Совет: Начните с простой Stories, чтобы быстро освоиться с функционалом
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}