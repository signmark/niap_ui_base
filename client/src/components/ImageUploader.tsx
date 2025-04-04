import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ImageUploaderProps {
  onImageUploaded: (imageUrl: string) => void;
  buttonText?: string;
  className?: string;
}

export function ImageUploader({ onImageUploaded, buttonText = 'Загрузить изображение', className = '' }: ImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обработчик изменения файла
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Ошибка',
        description: `Неподдерживаемый тип файла. Допустимые форматы: ${allowedTypes.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    // Проверяем размер файла (не более 10 МБ)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      toast({
        title: 'Ошибка',
        description: 'Размер файла не должен превышать 10 МБ',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsUploading(true);

      // Создаем URL для превью
      const localPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(localPreviewUrl);

      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('image', file);

      // Отправляем файл на сервер
      const result = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!result.ok) {
        throw new Error(`Ошибка загрузки файла: ${result.statusText}`);
      }

      const data = await result.json();
      
      if (data.success && data.data?.url) {
        onImageUploaded(data.data.url);
        toast({
          title: 'Успешно',
          description: 'Изображение успешно загружено'
        });
      } else {
        throw new Error(data.error || 'Не удалось загрузить изображение');
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Произошла ошибка при загрузке изображения',
        variant: 'destructive'
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Сбрасываем input, чтобы можно было загрузить тот же файл повторно
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Обработчик клика на кнопку загрузки
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Обработчик отмены/очистки превью
  const handleCancelPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        
        <Button 
          type="button" 
          onClick={handleButtonClick}
          disabled={isUploading}
          variant="outline"
          className="w-full"
        >
          {isUploading ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-r-transparent"></span>
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {buttonText}
            </>
          )}
        </Button>
      </div>

      {previewUrl && (
        <div className="relative mt-2 rounded-md border border-border overflow-hidden">
          <div className="absolute top-2 right-2 z-10">
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleCancelPreview}
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <img 
            src={previewUrl} 
            alt="Предпросмотр" 
            className="w-full h-auto max-h-[200px] object-contain"
          />
        </div>
      )}
    </div>
  );
}