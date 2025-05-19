import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface SimpleImageUploaderProps {
  onImageUploaded: (url: string) => void;
  multiple?: boolean;
  className?: string;
}

export function SimpleImageUploader({ 
  onImageUploaded, 
  multiple = false, 
  className = ""
}: SimpleImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  // Обработка загрузки файла
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    
    try {
      console.log('Отправка запроса на загрузку файла...');
      const response = await axios.post('/api/imgur/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Ответ от сервера:', response.data);
      
      // Определяем URL из ответа
      const imageUrl = response.data.url || response.data.link || 
                      (response.data.data && (response.data.data.url || response.data.data.link));
      
      if (imageUrl) {
        console.log('Получен URL изображения:', imageUrl);
        onImageUploaded(imageUrl);
        
        toast({
          title: 'Успешно',
          description: 'Изображение загружено'
        });
        
        // Очищаем поле выбора файла
        e.target.value = '';
      } else {
        console.error('Не удалось извлечь URL изображения из ответа сервера');
        toast({
          title: 'Ошибка',
          description: 'Не удалось получить URL загруженного изображения',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке файла:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Ошибка при загрузке изображения',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`${className}`}>
      <div className="relative inline-block">
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          onChange={handleFileUpload}
          disabled={isUploading}
          aria-label="Загрузить изображение"
        />
        <Button 
          type="button" 
          variant="outline" 
          className="relative flex items-center gap-2"
          disabled={isUploading}
        >
          {isUploading ? (
            <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>Загрузить изображение</span>
        </Button>
      </div>
    </div>
  );
}