import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Upload } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';
import { getCdnUrl } from '@/lib/cdnHelper';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "black";
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  className = '',
  size = "icon",
  variant = "outline"
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive",
      });
      return;
    }
    
    // Проверка размера файла (не больше 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Ошибка",
        description: "Размер файла не должен превышать 10MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Создаем объект FormData для отправки файла
      const formData = new FormData();
      formData.append('image', file);
      
      // Отправляем запрос на загрузку файла
      const response = await axios.post('/api/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Если загрузка успешна, вызываем callback с URL изображения
      if (response.data.success && response.data.file) {
        // Получаем URL изображения через CDN
        const cdnUrl = getCdnUrl(response.data.file.path);
        
        // Вызываем callback с URL изображения
        onImageUpload(cdnUrl);
        
        toast({
          title: "Успех",
          description: "Изображение успешно загружено",
        });
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить изображение. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Очищаем input, чтобы можно было загрузить тот же файл повторно
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <Button
        type="button"
        onClick={handleClick}
        className={className}
        size={size}
        variant={variant}
        disabled={isUploading}
      >
        {isUploading ? (
          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
    </>
  );
};

export { ImageUploader };