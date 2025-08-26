import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Image, 
  Video, 
  Layers,
  Calendar
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface ContentTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'text' | 'text-image' | 'image' | 'video' | 'story') => void;
}

export default function ContentTypeDialog({ isOpen, onClose, onSelectType }: ContentTypeDialogProps) {
  const { featureFlags, isEnabled } = useFeatureFlags();
  
  const contentTypes = [
    {
      id: 'text',
      title: 'Текст',
      description: 'Только текстовый контент без изображений',
      icon: FileText,
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      id: 'text-image',
      title: 'Текст с картинкой',
      description: 'Текстовая публикация с изображениями',
      icon: Image,
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    {
      id: 'image',
      title: 'Только картинка',
      description: 'Публикация только изображения без текста',
      icon: Image,
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
    },
    {
      id: 'video',
      title: 'Видео',
      description: 'Видео контент для YouTube, VK, Telegram',
      icon: Video,
      color: 'bg-red-50 border-red-200 hover:bg-red-100'
    },
    {
      id: 'story',
      title: 'Instagram Stories',
      description: 'Создание интерактивных историй для Instagram',
      icon: Layers,
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    }
  ];

  const handleSelect = (type: 'text' | 'text-image' | 'image' | 'video' | 'story') => {
    onSelectType(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите тип контента</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {contentTypes.map((type) => {
            const IconComponent = type.icon;
            
            // Check if Instagram Stories is disabled
            if (type.id === 'story' && !isEnabled('instagramStories')) {
              return (
                <Card key={type.id} className="opacity-50 cursor-not-allowed bg-gray-50 border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100">
                        <IconComponent className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-500">{type.title}</h3>
                        <p className="text-sm text-gray-400">
                          Функция временно отключена
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            
            return (
              <Card 
                key={type.id}
                className={`cursor-pointer transition-colors ${type.color}`}
                onClick={() => handleSelect(type.id as 'text' | 'text-image' | 'image' | 'video' | 'story')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{type.title}</h3>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}