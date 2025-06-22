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

interface ContentTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'post' | 'story') => void;
}

export default function ContentTypeDialog({ isOpen, onClose, onSelectType }: ContentTypeDialogProps) {
  const contentTypes = [
    {
      id: 'post',
      title: 'Обычный пост',
      description: 'Текстовый контент с изображениями и видео',
      icon: FileText,
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      id: 'story',
      title: 'Stories',
      description: 'Интерактивные истории со слайдами',
      icon: Layers,
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    }
  ];

  const handleSelect = (type: 'post' | 'story') => {
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
            return (
              <Card 
                key={type.id}
                className={`cursor-pointer transition-colors ${type.color}`}
                onClick={() => handleSelect(type.id as 'post' | 'story')}
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