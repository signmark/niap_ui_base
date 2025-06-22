import React, { useState } from 'react';
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
  onOpenChange: (open: boolean) => void;
  element: StoryElement | null;
  onSave: (elementData: Partial<StoryElement>) => void;
}

export default function ElementDialog({ isOpen, onOpenChange, element, onSave }: ElementDialogProps) {
  const [elementData, setElementData] = useState<Partial<StoryElement>>(element || {});

  const handleSave = () => {
    onSave(elementData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактирование элемента</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {element?.type === 'text' && (
            <div>
              <Label htmlFor="text-content">Текст</Label>
              <Textarea
                id="text-content"
                value={elementData.content?.text || ''}
                onChange={(e) => setElementData({
                  ...elementData,
                  content: { ...elementData.content, text: e.target.value }
                })}
              />
            </div>
          )}
          
          {element?.type === 'image' && (
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
          
          <div className="flex gap-2">
            <Button onClick={handleSave}>Сохранить</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}