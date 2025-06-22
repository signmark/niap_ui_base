import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface StoryElement {
  id: string;
  type: 'text' | 'image' | 'video' | 'poll' | 'quiz' | 'ai-image';
  position: { x: number; y: number };
  rotation: number;
  zIndex: number;
  content: any;
  style?: any;
}

interface ElementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  element: StoryElement | null;
  onSave: (elementData: Partial<StoryElement>) => void;
}

export default function ElementDialog({ isOpen, onClose, element, onSave }: ElementDialogProps) {
  const [elementData, setElementData] = useState<Partial<StoryElement>>({});

  useEffect(() => {
    if (element) {
      setElementData(element);
    }
  }, [element]);

  const handleSave = () => {
    onSave(elementData);
    onClose();
  };

  const handleClose = () => {
    setElementData({});
    onClose();
  };

  if (!element) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактирование элемента</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {element.type === 'text' && (
            <div>
              <Label htmlFor="text-content">Текст</Label>
              <Textarea
                id="text-content"
                value={elementData.content?.text || ''}
                onChange={(e) => setElementData({
                  ...elementData,
                  content: { ...elementData.content, text: e.target.value }
                })}
                placeholder="Введите текст"
              />
            </div>
          )}
          
          {element.type === 'image' && (
            <div>
              <Label htmlFor="image-url">URL изображения</Label>
              <Input
                id="image-url"
                value={elementData.content?.url || ''}
                onChange={(e) => setElementData({
                  ...elementData,
                  content: { ...elementData.content, url: e.target.value }
                })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}