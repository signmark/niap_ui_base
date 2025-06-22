import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Link, Sparkles, Plus, Trash2 } from 'lucide-react';

interface ElementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  elementType: 'text' | 'image' | 'video' | 'poll' | 'quiz' | 'ai-image';
  onAddElement: (content: any) => void;
}

export default function ElementDialog({ isOpen, onClose, elementType, onAddElement }: ElementDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<any>({});

  const resetForm = () => {
    setFormData({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    let content;

    switch (elementType) {
      case 'text':
        if (!formData.text) {
          toast({
            title: "Ошибка",
            description: "Введите текст",
            variant: "destructive"
          });
          return;
        }
        content = {
          text: formData.text,
          fontSize: formData.fontSize || 24,
          color: formData.color || '#ffffff',
          fontWeight: formData.fontWeight || 'normal'
        };
        break;

      case 'image':
        if (!formData.url) {
          toast({
            title: "Ошибка", 
            description: "Укажите URL изображения",
            variant: "destructive"
          });
          return;
        }
        content = {
          url: formData.url,
          alt: formData.alt || ''
        };
        break;

      case 'video':
        if (!formData.url) {
          toast({
            title: "Ошибка",
            description: "Укажите URL видео",
            variant: "destructive"
          });
          return;
        }
        content = {
          url: formData.url
        };
        break;

      case 'poll':
        if (!formData.question || !formData.options || formData.options.length < 2) {
          toast({
            title: "Ошибка",
            description: "Введите вопрос и минимум 2 варианта ответа",
            variant: "destructive"
          });
          return;
        }
        content = {
          question: formData.question,
          options: formData.options.filter((opt: string) => opt.trim())
        };
        break;

      case 'quiz':
        if (!formData.question || !formData.options || formData.options.length < 2 || formData.correctAnswer === undefined) {
          toast({
            title: "Ошибка",
            description: "Заполните все поля викторины",
            variant: "destructive"
          });
          return;
        }
        content = {
          question: formData.question,
          options: formData.options.filter((opt: string) => opt.trim()),
          correctAnswer: formData.correctAnswer
        };
        break;

      case 'ai-image':
        if (!formData.prompt) {
          toast({
            title: "Ошибка",
            description: "Введите описание для генерации изображения",
            variant: "destructive"
          });
          return;
        }
        generateAIImage(formData.prompt);
        return;

      default:
        return;
    }

    onAddElement(content);
    handleClose();
  };

  const generateAIImage = async (prompt: string) => {
    try {
      const response = await fetch('/api/fal-ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prompt })
      });

      if (response.ok) {
        const result = await response.json();
        onAddElement({
          url: result.image_url,
          prompt,
          generated: true
        });
        handleClose();
      } else {
        toast({
          title: "Ошибка генерации",
          description: "Не удалось сгенерировать изображение",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при генерации изображения",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setFormData(prev => ({ ...prev, url: result.url }));
      } else {
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить файл",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке файла",
        variant: "destructive"
      });
    }
  };

  const addPollOption = () => {
    const currentOptions = formData.options || ['', ''];
    setFormData(prev => ({
      ...prev,
      options: [...currentOptions, '']
    }));
  };

  const removePollOption = (index: number) => {
    const currentOptions = formData.options || [];
    setFormData(prev => ({
      ...prev,
      options: currentOptions.filter((_, i) => i !== index)
    }));
  };

  const updatePollOption = (index: number, value: string) => {
    const currentOptions = formData.options || [];
    const updatedOptions = [...currentOptions];
    updatedOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: updatedOptions
    }));
  };

  const getTitle = () => {
    switch (elementType) {
      case 'text': return 'Добавить текст';
      case 'image': return 'Добавить изображение';
      case 'video': return 'Добавить видео';
      case 'poll': return 'Создать опрос';
      case 'quiz': return 'Создать викторину';
      case 'ai-image': return 'Сгенерировать изображение';
      default: return 'Добавить элемент';
    }
  };

  const renderContent = () => {
    switch (elementType) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label>Текст</Label>
              <Textarea
                value={formData.text || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Введите текст"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Размер шрифта</Label>
                <Input
                  type="number"
                  value={formData.fontSize || 24}
                  onChange={(e) => setFormData(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Цвет</Label>
                <Input
                  type="color"
                  value={formData.color || '#ffffff'}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>URL изображения</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
            <div>
              <Label>Описание (alt)</Label>
              <Input
                value={formData.alt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, alt: e.target.value }))}
                placeholder="Описание изображения"
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <Label>URL видео</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/video.mp4"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          </div>
        );

      case 'poll':
        return (
          <div className="space-y-4">
            <div>
              <Label>Вопрос</Label>
              <Input
                value={formData.question || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Ваш вопрос?"
              />
            </div>
            <div>
              <Label>Варианты ответов</Label>
              <div className="space-y-2">
                {(formData.options || ['', '']).map((option: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                    />
                    {(formData.options?.length || 0) > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePollOption(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPollOption}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить вариант
                </Button>
              </div>
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="space-y-4">
            <div>
              <Label>Вопрос викторины</Label>
              <Input
                value={formData.question || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Вопрос викторины?"
              />
            </div>
            <div>
              <Label>Варианты ответов</Label>
              <div className="space-y-2">
                {(formData.options || ['', '']).map((option: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                    />
                    <Button
                      variant={formData.correctAnswer === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                    >
                      ✓
                    </Button>
                    {(formData.options?.length || 0) > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePollOption(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPollOption}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить вариант
                </Button>
              </div>
            </div>
          </div>
        );

      case 'ai-image':
        return (
          <div className="space-y-4">
            <div>
              <Label>Описание для генерации</Label>
              <Textarea
                value={formData.prompt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="Опишите, какое изображение вы хотите создать"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {renderContent()}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>
            {elementType === 'ai-image' ? 'Сгенерировать' : 'Добавить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}